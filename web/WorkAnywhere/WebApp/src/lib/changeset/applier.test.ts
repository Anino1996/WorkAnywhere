import { describe, it, expect } from "vitest";
import { ChangeSetApplier } from "@/lib/changeset/applier";
import type { DataPlaneClient, DirEntry, FileRead, FileWriteResult } from "@/lib/api/types";
import { ApiCallError } from "@/lib/api/types";
import type { ChangeSet, FileEdit } from "@/lib/changeset/types";
import { STASH_CAP_BYTES } from "@/lib/changeset/types";
import { etagFor } from "@/lib/api/etag";

// In-memory data plane for tests — implements the same DataPlaneClient
// interface as the mock/HTTP impls so the applier can exercise ETag CAS,
// precondition failures, and partial-apply rollback walk-back.
class TestDP implements DataPlaneClient {
  files = new Map<string, { content: Uint8Array; etag: string }>();
  failNextPutIfMatch: boolean = false;

  constructor(seed?: Record<string, string>) {
    if (seed) {
      for (const [k, v] of Object.entries(seed)) {
        this.set(k, new TextEncoder().encode(v));
      }
    }
  }
  private set(path: string, content: Uint8Array) {
    this.files.set(path, { content, etag: etagFor(content) });
  }
  async getFile(path: string): Promise<FileRead> {
    const f = this.files.get(path);

    if (!f) throw new ApiCallError({ code: "NOT_FOUND", message: path, request_id: "t" }, 404);
    return { content: f.content.slice(), etag: f.etag, contentType: "text" };
  }
  async putFile(path: string, content: Uint8Array, ifMatch?: string): Promise<FileWriteResult> {
    const existing = this.files.get(path);

    if (this.failNextPutIfMatch) {
      this.failNextPutIfMatch = false;
      throw new ApiCallError({ code: "ETAG_MISMATCH", message: "demo", request_id: "t" }, 412);
    }

    if (ifMatch != null && (!existing || existing.etag !== ifMatch)) {
      throw new ApiCallError({ code: "ETAG_MISMATCH", message: "", request_id: "t" }, 412);
    }

    const created = !existing;
    this.set(path, content);
    return { etag: etagFor(content), created };
  }
  async deleteFile(path: string): Promise<void> {
    if (!this.files.delete(path)) {
      throw new ApiCallError({ code: "NOT_FOUND", message: path, request_id: "t" }, 404);
    }
  }
  async listDir(_path: string): Promise<DirEntry[]> {
    return [];
  }
  content(path: string): string {
    return new TextDecoder().decode(this.files.get(path)?.content ?? new Uint8Array());
  }
  etag(path: string): string {
    return this.files.get(path)?.etag ?? "";
  }
}

const enc = new TextEncoder();
const uid = () => `cs_${Math.random().toString(36).slice(2, 8)}`;
const make = (edits: FileEdit[]): ChangeSet => ({ id: uid(), status: "pending", edits });

describe("ChangeSetApplier.applyAll", () => {
  it("applies a SEARCH/REPLACE block and sets postApplyETag", async () => {
    const dp = new TestDP({ "auth.py": "def authenticate(user):\n    return user.token\n" });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "auth.py",
        op: {
          kind: "searchReplace",
          blocks: [
            {
              search: "def authenticate(user):\n    return user.token",
              replace:
                "def authenticate(user):\n    if not user.token: raise AuthError()\n    return user.token",
            },
          ],
        },
        undoable: false,
      },
    ]);
    const result = await applier.applyAll(cs.edits);
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual(["auth.py"]);
    expect(dp.content("auth.py")).toContain("if not user.token");
    expect(cs.edits[0].postApplyETag).toBeTruthy();
    // S/R without replaceAll is undoable from the edit itself (swap search↔replace).
    expect(cs.edits[0].oldContent).toBeUndefined();
    expect(cs.edits[0].undoable).toBe(true);
  });

  it("rejects ambiguous search and rolls back nothing (no files applied)", async () => {
    const dp = new TestDP({ "auth.py": "user. user. user." });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "auth.py",
        op: { kind: "searchReplace", blocks: [{ search: "user.", replace: "actor." }] },
        undoable: false,
      },
    ]);
    const result = await applier.applyAll(cs.edits);
    expect(result.ok).toBe(false);
    expect(result.failed.length).toBe(1);
    expect(result.applied.length).toBe(0);
    expect(result.rolledBack.length).toBe(0);
    expect(dp.content("auth.py")).toBe("user. user. user.");
  });

  it("walks back already-applied edits on partial failure (single-block inverses)", async () => {
    const dp = new TestDP({
      "a.txt": "alpha",
      "b.txt": "beta",
      "c.txt": "gamma",
    });
    const applier = new ChangeSetApplier(dp);

    // Edit 2 (c.txt) uses an ambiguous search -> apply fails after a & b succeeded.
    const cs = make([
      { path: "a.txt", op: { kind: "searchReplace", blocks: [{ search: "alpha", replace: "ALPHA" }] }, undoable: false },
      { path: "b.txt", op: { kind: "searchReplace", blocks: [{ search: "beta", replace: "BETA" }] }, undoable: false },
      { path: "c.txt", op: { kind: "searchReplace", blocks: [{ search: "m", replace: "M" }] }, undoable: false }, // 'm' appears in "gamma" once; make it ambiguous
    ]);
    // Force c.txt to have ambiguous match by editing gamma to gammam
    dp.files.set("c.txt", { content: enc.encode("gammam"), etag: etagFor(enc.encode("gammam")) });

    const result = await applier.applyAll(cs.edits);
    expect(result.ok).toBe(false);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0].path).toBe("c.txt");
    expect(result.rolledBack).toEqual(["b.txt", "a.txt"]);
    // Files restored to original content.
    expect(dp.content("a.txt")).toBe("alpha");
    expect(dp.content("b.txt")).toBe("beta");
  });

  it("surfaces 412 ETag mismatch on Apply (If-Match vs current etag)", async () => {
    const dp = new TestDP({ "a.txt": "alpha" });
    // Mutate out-of-band, so the read-time ETag no longer matches.
    // We do this by intercepting getFile to return a stale ETag.
    const original = dp.getFile.bind(dp);
    dp.getFile = async (path: string) => {
      const f = await original(path);
      return { ...f, etag: '"staleetag12345678"' };
    };

    const applier = new ChangeSetApplier(dp);
    const cs = make([
      { path: "a.txt", op: { kind: "searchReplace", blocks: [{ search: "alpha", replace: "ALPHA" }] }, undoable: false },
    ]);
    const result = await applier.applyAll(cs.edits);
    expect(result.ok).toBe(false);
    expect(result.failed[0].reason).toContain("ETAG_MISMATCH");
  });
});

describe("ChangeSetApplier.undoAll", () => {
  it("undoes a single S/R edit by swapping search <-> replace", async () => {
    const dp = new TestDP({ "auth.py": "def authenticate(user):\n    return user.token\n" });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "auth.py",
        op: {
          kind: "searchReplace",
          blocks: [
            {
              search: "def authenticate(user):\n    return user.token",
              replace:
                "def authenticate(user):\n    if not user.token: raise AuthError()\n    return user.token",
            },
          ],
        },
        undoable: false,
      },
    ]);
    await applier.applyAll(cs.edits);
    expect(dp.content("auth.py")).toContain("AuthError");
    const undo = await applier.undoAll(cs.edits);
    expect(undo.ok).toBe(true);
    expect(dp.content("auth.py")).toBe("def authenticate(user):\n    return user.token\n");
  });

  it("replaceAll undo restores from stashed oldContent (not symmetric block inversion)", async () => {
    const before = "old bar new bar comment";
    const dp = new TestDP({ "a.txt": before });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "a.txt",
        op: {
          kind: "searchReplace",
          blocks: [{ search: "bar", replace: "foo", replaceAll: true }],
        },
        undoable: false,
      },
    ]);
    await applier.applyAll(cs.edits);
    expect(dp.content("a.txt")).toBe("old foo new foo comment");
    expect(cs.edits[0].oldContent).toBe(before); // stashed
    // Symmetric inversion would corrupt: "old foo new foo comment" → swap each block's search/replace
    // → "old foo new foo comment".replaceAll("foo","bar") would over-replace if "bar" already existed.
    // Restore via stashed oldContent is the safe path (see Diff doc's inverse table).
    const undo = await applier.undoAll(cs.edits);
    expect(undo.ok).toBe(true);
    expect(dp.content("a.txt")).toBe(before);
  });

  it("delete -> create inverse restores the file from stashed oldContent", async () => {
    const dp = new TestDP({ "x.txt": "the original\nsecond line" });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "x.txt",
        op: { kind: "delete", oldContent: "" },
        undoable: false,
      },
    ]);
    await applier.applyAll(cs.edits);
    expect(dp.files.has("x.txt")).toBe(false);
    expect(cs.edits[0].oldContent).toBe("the original\nsecond line"); // stashed from disk
    const undo = await applier.undoAll(cs.edits);
    expect(undo.ok).toBe(true);
    expect(dp.content("x.txt")).toBe("the original\nsecond line");
  });

  it("rewrite -> rewrite inverse (newContent <-> oldContent) restores the file", async () => {
    const before = "old content";
    const dp = new TestDP({ "y.txt": before });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "y.txt",
        op: { kind: "rewrite", oldContent: before, newContent: "new content" },
        undoable: false,
      },
    ]);
    await applier.applyAll(cs.edits);
    expect(dp.content("y.txt")).toBe("new content");
    // maybeStash copies the actual disk-pre-Apply content into edit.oldContent.
    expect(cs.edits[0].oldContent).toBe(before);
    const undo = await applier.undoAll(cs.edits);
    expect(undo.ok).toBe(true);
    // Undo restores to the stashed content (the real disk-pre-Apply bytes),
    // not the AI-declared oldContent (which happened to be the same here).
    expect(dp.content("y.txt")).toBe(before);
  });

  it("rewrite undo prefers the *actual* stashed content over the AI-declared oldContent", async () => {
    // Disk has "ACTUAL_DISK_CONTENT"; the AI's rewrite op declares a wrong
    // oldContent ("WRONG_GUESS"). Apply succeeds writing "NEW". Undo must
    // restore "ACTUAL_DISK_CONTENT" (the stashed real bytes), not "WRONG_GUESS".
    const dp = new TestDP({ "y.txt": "ACTUAL_DISK_CONTENT" });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "y.txt",
        op: { kind: "rewrite", oldContent: "WRONG_GUESS", newContent: "NEW" },
        undoable: false,
      },
    ]);
    await applier.applyAll(cs.edits);
    expect(dp.content("y.txt")).toBe("NEW");
    expect(cs.edits[0].oldContent).toBe("ACTUAL_DISK_CONTENT"); // stashed, not declared
    const undo = await applier.undoAll(cs.edits);
    expect(undo.ok).toBe(true);
    expect(dp.content("y.txt")).toBe("ACTUAL_DISK_CONTENT");
  });

  

  it("surfaces ETag 412 on Undo as 'file modified since edit — cannot undo cleanly'", async () => {
    const dp = new TestDP({ "z.txt": "z" });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      { path: "z.txt", op: { kind: "searchReplace", blocks: [{ search: "z", replace: "Z" }] }, undoable: false },
    ]);
    await applier.applyAll(cs.edits);
    // Out-of-band modification between Apply and Undo.
    dp.files.set("z.txt", {
      content: enc.encode("mod out of band"),
      etag: etagFor(enc.encode("mod out of band")),
    });
    const undo = await applier.undoAll(cs.edits);
    expect(undo.skipped.length).toBe(1);
    expect(undo.skipped[0].reason).toContain("file modified since edit");
  });

  it("marks edits over the 1MB cap as undoable:false (Apply still proceeds)", async () => {
    const big = "x".repeat(STASH_CAP_BYTES + 10);
    const dp = new TestDP({ "big.txt": big });
    const applier = new ChangeSetApplier(dp);
    const cs = make([
      {
        path: "big.txt",
        op: { kind: "rewrite", oldContent: big, newContent: "small" },
        undoable: false,
      },
    ]);
    const result = await applier.applyAll(cs.edits);
    expect(result.ok).toBe(true);
    expect(dp.content("big.txt")).toBe("small");
    expect(cs.edits[0].undoable).toBe(false);
    expect(cs.edits[0].undoableReason).toMatch(/too large to undo/i);
    // Undo now skips this file.
    const undo = await applier.undoAll(cs.edits);
    expect(undo.skipped.length).toBe(1);
    expect(dp.content("big.txt")).toBe("small"); // untouched
  });
});
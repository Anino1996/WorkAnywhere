// ChangeSetApplier: applies a ChangeSet to a workspace via the data plane and
// rolls back partial failures. Mirrors the algorithm and inverse table in
// "AGENTS/Diff Application Strategy.md".

import type { DataPlaneClient } from "@/lib/api/types";
import { ApiCallError } from "@/lib/api/types";
import type { EditBlock, FileEdit, FileEditOp } from "./types";
import { STASH_CAP_BYTES } from "./types";
import { applyBlock, BlockApplyError } from "./blockMatch";

const enc = new TextEncoder();

export interface ApplyOutcome {
  ok: boolean;
  applied: string[]; // paths that applied
  failed: { path: string; reason: string }[];
  rolledBack: string[];
  note?: string;
}

export interface UndoOutcome {
  ok: boolean;
  undone: string[];
  skipped: { path: string; reason: string }[];
  note?: string;
}

function textContent(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// Compute the new content for a single FileEdit from the current on-disk content.
// Throws BlockApplyError on bad matches.
function computeNewContent(current: string, op: FileEditOp): string {
  switch (op.kind) {
    case "searchReplace":
      let acc = current;
      for (const block of op.blocks) {
        acc = applyBlock(acc, block);
      }
      return acc;
    case "create":
      return op.content;
    case "rewrite":
      return op.newContent;
    case "delete":
      return ""; // delete handled by DELETE, not a content write
  }
}

// Whether `oldContent` must be stashed for safe Undo of this op.
function opNeedsOldContentStash(op: FileEditOp): boolean {
  switch (op.kind) {
    case "searchReplace":
      return op.blocks.some((b) => b.replaceAll === true);
    case "rewrite":
    case "delete":
      return true;
    case "create":
      return false;
  }
}

// Inverse table from the Diff doc.
type InverseOp = FileEditOp;
function inverseOf(edit: FileEdit): InverseOp | null {
  if (!edit.undoable) return null;
  const op = edit.op;
  switch (op.kind) {
    case "searchReplace": {
      // Each non-replaceAll block -> swap search <-> replace.
      // Any replaceAll block -> full-file restore from stashed oldContent (a rewrite).
      if (op.blocks.some((b) => b.replaceAll === true)) {
        if (!edit.oldContent) return null;
        return { kind: "rewrite", oldContent: "", newContent: edit.oldContent };
      }
      const swapped: EditBlock[] = op.blocks.map((b) => ({
        search: b.replace,
        replace: b.search,
        replaceAll: false,
      }));
      return { kind: "searchReplace", blocks: swapped };
    }
    case "create":
      // Inverse is delete; carried out as a delete with oldContent.
      return { kind: "delete", oldContent: "" };
    case "rewrite":
      // Restore the actual disk-pre-Apply content if it was stashed (preferred
      // over the AI-declared oldContent, which may have been inaccurate).
      return {
        kind: "rewrite",
        oldContent: op.newContent,
        newContent: edit.oldContent ?? op.oldContent,
      };
    case "delete":
      // Inverse is create with the *stashed* oldContent (set on Apply).
      return { kind: "create", content: edit.oldContent ?? op.oldContent };
  }
}

export class ChangeSetApplier {
  constructor(private readonly dp: DataPlaneClient) {}

  async apply(edit: FileEdit): Promise<void> {
    const transfer: void = await this.applyOne(edit);
    void transfer;
  }

  async applyAll(edits: FileEdit[]): Promise<ApplyOutcome> {
    const applied: string[] = [];
    const failed: { path: string; reason: string }[] = [];
    const rolledBack: string[] = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      try {
        await this.applyOne(edit);
        applied.push(edit.path);
      } catch (err) {
        failed.push({ path: edit.path, reason: this.describe(err) });
        // Walk back already-applied edits via their inverses (best-effort).
        for (let j = applied.length - 1; j >= 0; j--) {
          const done = edits.find((e) => e.path === applied[j]);
          if (!done) continue;
          try {
            await this.undoOne(done);
            rolledBack.push(done.path);
          } catch {
            // Swallow rollback errors; we surface partial-failure as a whole.
          }
        }
        return {
          ok: false,
          applied,
          failed,
          rolledBack,
          note: `Apply failed at ${edit.path}: ${this.describe(err)}. Rolled back ${rolledBack.length} file(s).`,
        };
      }
    }
    return { ok: true, applied, failed, rolledBack };
  }

  private async applyOne(edit: FileEdit): Promise<void> {
    const op = edit.op;
    let currentContent = "";
    let readETag: string | undefined;
    // For all ops except create we need the current content + read-time ETag.
    if (op.kind !== "create") {
      const cur = await this.dp.getFile(edit.path);
      currentContent = textContent(cur.content);
      readETag = cur.etag;
    }

    if (op.kind === "delete") {
      // Stash oldContent if needed and within cap.
      this.maybeStash(edit, currentContent);
      await this.dp.deleteFile(edit.path);
      // No post-apply ETag for delete; use readETag as the inverse guard.
      edit.postApplyETag = readETag;
      return;
    }

    const newContent = computeNewContent(currentContent, op);
    const newBytes = enc.encode(newContent);
    // Stash oldContent for Undo if needed.
    this.maybeStash(edit, currentContent);

    const result = await this.dp.putFile(edit.path, newBytes, readETag);
    edit.postApplyETag = result.etag;
  }

  private maybeStash(edit: FileEdit, currentContent: string) {
    if (!opNeedsOldContentStash(edit.op)) {
      // S/R without replaceAll + `create` — inverse is derivable from the edit
      // itself, so Undo works without a stashed backup.
      edit.undoable = true;
      return;
    }
    const bytes = enc.encode(currentContent);
    if (bytes.length > STASH_CAP_BYTES) {
      edit.undoable = false;
      edit.undoableReason = `too large to undo locally (${(bytes.length / 1_000_000).toFixed(1)} MB > 1 MB cap)`;
      return;
    }
    edit.undoable = true;
    edit.oldContent = currentContent;
  }

  async undoAll(edits: FileEdit[]): Promise<UndoOutcome> {
    const undone: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    // Reverse order.
    for (let i = edits.length - 1; i >= 0; i--) {
      const edit = edits[i];
      if (!edit.undoable) {
        skipped.push({ path: edit.path, reason: edit.undoableReason ?? "not undoable" });
        continue;
      }
      try {
        await this.undoOne(edit);
        undone.push(edit.path);
      } catch (err) {
        if (err instanceof ApiCallError && err.status === 412) {
          skipped.push({ path: edit.path, reason: "file modified since edit — cannot undo cleanly" });
        } else {
          skipped.push({ path: edit.path, reason: this.describe(err) });
        }
      }
    }
    return {
      ok: skipped.length === 0,
      undone,
      skipped,
      note:
        skipped.length > 0
          ? `Undid ${undone.length} of ${edits.length} file(s).`
          : undefined,
    };
  }

  private async undoOne(edit: FileEdit): Promise<void> {
    const inv = inverseOf(edit);
    if (!inv) throw new BlockApplyError("search_ambiguous", `no inverse for ${edit.path}`);
    const guard = edit.postApplyETag; // If-Match guard for undo.
    switch (inv.kind) {
      case "create": {
        // Inverse of original `delete`. The file no longer exists post-Apply,
        // so the If-Match guard has nothing to compare against — we omit it.
        // An out-of-band recreation is an edge case (the doc's "file modified
        // since edit" path is exercised via the searchReplace/rewrite inverses).
        const bytes = enc.encode(inv.content);
        await this.dp.putFile(edit.path, bytes);
        return;
      }
      case "delete": {
        await this.dp.deleteFile(edit.path);
        return;
      }
      case "rewrite": {
        const bytes = enc.encode(inv.newContent);
        await this.dp.putFile(edit.path, bytes, guard);
        return;
      }
      case "searchReplace": {
        // need current content + read-time guard
        const cur = await this.dp.getFile(edit.path);
        if (guard && cur.etag !== guard) {
          throw new ApiCallError({ code: "ETAG_MISMATCH", message: "undo precondition failed", request_id: "local" }, 412);
        }
        let content = textContent(cur.content);
        for (const block of inv.blocks) {
          content = applyBlock(content, block);
        }
        const bytes = enc.encode(content);
        await this.dp.putFile(edit.path, bytes, cur.etag);
        return;
      }
    }
  }

  private describe(err: unknown): string {
    if (err instanceof BlockApplyError) return `${err.code}: ${err.message}`;
    if (err instanceof ApiCallError) return `${err.detail.code}: ${err.detail.message}`;
    if (err instanceof Error) return err.message;
    return String(err);
  }
}

// Test-only helper: dry-run new-content computation without touching the data plane.
export function computeNewContentPure(current: string, op: FileEditOp): string {
  return computeNewContent(current, op);
}
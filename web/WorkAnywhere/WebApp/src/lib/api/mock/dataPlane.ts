// In-browser mock Data Plane. Implements DataPlaneClient with the documented
// raw-byte + ETag CAS contract (the dev mock mirrors the wire format quoted
// hex exactly). State is per-workspace, persisted to localStorage under a
// namespaced key so multiple mock workspaces each have an isolated FS.

import type {
  DataPlaneClient,
  DirEntry,
  FileRead,
  FileWriteResult,
} from "@/lib/api/types";
import { ApiCallError } from "@/lib/api/types";
import { etagFor } from "@/lib/api/etag";
import { seedFs } from "./fixtures";
import { useDemoStore, demoDelay } from "@/lib/api/demo";

const root = "/workspace";

interface FsFile {
  content: Uint8Array;
  etag: string;
  modifiedAt: string;
}
type FsTree = Map<string, FsFile>;

const stores = new Map<string, FsTree>();

function makeKey(workspaceId: string) {
  return `caw.mock.dp.${workspaceId}.v1`;
}

function load(workspaceId: string): FsTree {
  if (stores.has(workspaceId)) return stores.get(workspaceId)!;
  const tree: FsTree = new Map();
  try {
    const raw = localStorage.getItem(makeKey(workspaceId));
    if (raw) {
      const data = JSON.parse(raw) as Record<string, { c: number[]; m: string }>;
      for (const [k, v] of Object.entries(data)) {
        const bytes = Uint8Array.from(v.c);
        tree.set(k, { content: bytes, etag: etagFor(bytes), modifiedAt: v.m });
      }
    }
  } catch {}
  if (tree.size === 0) {
    for (const f of seedFs) {
      const bytes = new TextEncoder().encode(f.content);
      tree.set(f.path, {
        content: bytes,
        etag: etagFor(bytes),
        modifiedAt: f.modified_at,
      });
    }
  }
  stores.set(workspaceId, tree);
  return tree;
}

function persist(workspaceId: string, tree: FsTree) {
  const obj: Record<string, { c: number[]; m: string }> = {};
  for (const [k, v] of tree.entries()) {
    obj[k] = { c: Array.from(v.content), m: v.modifiedAt };
  }
  localStorage.setItem(makeKey(workspaceId), JSON.stringify(obj));
}

function isTextPath(path: string): boolean {
  return /\.(py|txt|md|js|ts|tsx|jsx|json|yml|yaml|toml|html|css|sh|env|cfg|ini)$/i.test(path);
}

function cleanJoin(rel: string): string {
  const joined = (root + "/" + rel).replace(/\\/g, "/");
  const parts: string[] = [];
  for (const seg of joined.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return "/" + parts.join("/");
}

function ensureInside(abs: string): string {
  if (!abs.startsWith(root + "/") && abs !== root) {
    throw failure("PATH_OUTSIDE_ROOT", "Resolved path is outside the workspace root", 403);
  }
  return abs.slice(root.length + 1) || "";
}

function failure(code: string, message: string, status: number): ApiCallError {
  return new ApiCallError(
    { code, message, request_id: `req_${Math.random().toString(36).slice(2, 8)}` },
    status,
  );
}

export class MockDataPlane implements DataPlaneClient {
  constructor(private readonly workspaceId: string) {}

  private tree() {
    return load(this.workspaceId);
  }

  async getFile(path: string): Promise<FileRead> {
    await demoDelay(40);
    const rel = ensureInside(cleanJoin(path));
    const tree = this.tree();
    const f = tree.get(rel);
    if (!f) throw failure("NOT_FOUND", `No file at ${path}`, 404);
    return {
      content: f.content.slice(),
      etag: f.etag,
      contentType: isTextPath(rel) ? "text" : "binary",
    };
  }

  async putFile(path: string, content: Uint8Array, ifMatch?: string): Promise<FileWriteResult> {
    await demoDelay(60);
    const rel = ensureInside(cleanJoin(path));
    const tree = this.tree();
    const existing = tree.get(rel);
    const demo = useDemoStore.getState();
    if (demo.consumePreconditionFail()) {
      throw failure("ETAG_MISMATCH", "Demo: precondition failed", 412);
    }
    if (ifMatch != null) {
      if (!existing) throw failure("ETAG_MISMATCH", "If-Match supplied but file does not exist", 412);
      if (existing.etag !== ifMatch) {
        throw failure("ETAG_MISMATCH", "ETag mismatch — file was modified", 412);
      }
    }
    const etag = etagFor(content);
    tree.set(rel, { content: content.slice(), etag, modifiedAt: new Date().toISOString() });
    persist(this.workspaceId, tree);
    return { etag, created: !existing };
  }

  async deleteFile(path: string): Promise<void> {
    await demoDelay(40);
    const rel = ensureInside(cleanJoin(path));
    if (rel === "") throw failure("INVALID", "Cannot delete workspace root", 400);
    const tree = this.tree();
    if (!tree.delete(rel)) throw failure("NOT_FOUND", `No file at ${path}`, 404);
    persist(this.workspaceId, tree);
  }

  async listDir(path: string): Promise<DirEntry[]> {
    await demoDelay(40);
    const rel = ensureInside(cleanJoin(path));
    const tree = this.tree();
    const prefix = rel === "" ? "" : rel + "/";
    const seen = new Map<string, DirEntry>();
    for (const [fpath, f] of tree.entries()) {
      if (!fpath.startsWith(prefix)) continue;
      const rest = fpath.slice(prefix.length);
      if (rest === "") continue;
      const slash = rest.indexOf("/");
      if (slash === -1) {
        seen.set(rest, {
          name: rest,
          type: "file",
          size: f.content.length,
          modified_at: f.modifiedAt,
        });
      } else {
        const dir = rest.slice(0, slash);
        if (!seen.has(dir)) {
          seen.set(dir, { name: dir, type: "directory", size: 0, modified_at: f.modifiedAt });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
}

export function resetMockDataPlane(workspaceId: string): void {
  stores.delete(workspaceId);
  localStorage.removeItem(makeKey(workspaceId));
}
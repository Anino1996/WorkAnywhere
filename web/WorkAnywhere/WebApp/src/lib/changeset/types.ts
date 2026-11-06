// ChangeSet data model — a 1:1 TS port of the Swift model documented in
// "AGENTS/Diff Application Strategy.md". The mock AI emits ChangeSets; the
// applier consumes them; the diff renderer visualizes them.

export interface EditBlock {
  search: string;
  replace: string;
  replaceAll?: boolean; // default false
}

export type FileEditOp =
  | { kind: "searchReplace"; blocks: EditBlock[] }
  | { kind: "create"; content: string }
  | { kind: "rewrite"; oldContent: string; newContent: string }
  | { kind: "delete"; oldContent: string };

export interface FileEdit {
  path: string;
  op: FileEditOp;
  postApplyETag?: string;
  oldContent?: string; // populated at Apply if op needs it for Undo
  undoable: boolean; // false if oldContent was needed but exceeded the 1MB cap
  undoableReason?: string; // user-visible note when undoable === false
}

export type ChangeSetStatus =
  | "pending"
  | "applied"
  | "undone"
  | "failed"
  | "partiallyUndone";

export interface ChangeSet {
  id: string;
  edits: FileEdit[];
  status: ChangeSetStatus;
  // Walkback note set when apply partially succeeds then fails.
  applyNote?: string;
  undoNote?: string;
}

// 1 MB cap on stashed oldContent (see "1 MB Stash Cap" in the Diff doc).
export const STASH_CAP_BYTES = 1_000_000;
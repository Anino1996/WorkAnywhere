// Computes the before/after content for a FileEdit. Returns null when the
// "before" can't be determined without a data plane round-trip (in which case
// the caller is expected to fetch the file first and pass its content in).

import type { FileEdit } from "./types";
import { applyBlock } from "./blockMatch";
import { diffLines, type DiffLine } from "./unifiedDiff";

export interface DiffForEditResult {
  before: string;
  after: string;
  lines: DiffLine[];
  // If the search would reject (ambiguous/not found), this carries the error
  // so the review sheet can surface it instead of crashing.
  applyError?: { code: string; message: string };
}

// Given the current disk content for the file (or null/undefined when the
// file doesn't exist), compute the projected after-content and diff lines.
export function diffForEdit(
  edit: FileEdit,
  // Before-content if already fetched. undefined ⇒ caller must supply.
  currentContent: string | undefined,
): DiffForEditResult {
  const op = edit.op;
  let before = currentContent ?? "";
  let after = "";
  let applyError: { code: string; message: string } | undefined;

  switch (op.kind) {
    case "create":
      before = "";
      after = op.content;
      break;
    case "delete":
      // Before is whatever's on disk; after is empty (the file is removed).
      after = "";
      break;
    case "rewrite":
      after = op.newContent;
      break;
    case "searchReplace": {
      let acc = before;

      try {
        for (const block of op.blocks) {
          acc = applyBlock(acc, block);
        }

        after = acc;
      } catch (err) {
        if (err instanceof Error) {
          applyError = { code: "block_apply_error", message: err.message };
        } else {
          applyError = { code: "block_apply_error", message: String(err) };
        }

        after = before; // no change
      }

      break;
    }
  }

  const lines = diffLines(before, after);
  return { before, after, lines, applyError };
}
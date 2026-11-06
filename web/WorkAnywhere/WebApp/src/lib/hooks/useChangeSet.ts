// ChangeSet hook. Holds the per-workspace current ChangeSet and exposes
// apply()/undo() that drive the ChangeSetApplier against the workspace's data
// plane. CRUD-style message-style results live in component state.

import { useState } from "react";
import { getDataPlane } from "@/lib/api";
import { ChangeSetApplier } from "@/lib/changeset/applier";
import type { ApplyOutcome, UndoOutcome } from "@/lib/changeset/applier";
import type { ChangeSet } from "@/lib/changeset/types";

export function useChangeSet(
  workspaceId: string,
  changeSet: ChangeSet | undefined,
): {
  applying: boolean;
  undoing: boolean;
  lastApply: ApplyOutcome | null;
  lastUndo: UndoOutcome | null;
  error: string | null;
  apply: (onApplied?: () => void) => Promise<ApplyOutcome | null>;
  undo: (onUndone?: () => void) => Promise<UndoOutcome | null>;
} {
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [lastApply, setLastApply] = useState<ApplyOutcome | null>(null);
  const [lastUndo, setLastUndo] = useState<UndoOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (onApplied?: () => void): Promise<ApplyOutcome | null> => {
    if (!changeSet || changeSet.edits.length === 0) return null;
    setApplying(true);
    setError(null);

    try {
      const dp = getDataPlane(workspaceId);
      const applier = new ChangeSetApplier(dp);
      const result = await applier.applyAll(changeSet.edits);
      setLastApply(result);
      onApplied?.();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setApplying(false);
    }
  };

  const undo = async (onUndone?: () => void): Promise<UndoOutcome | null> => {
    if (!changeSet || changeSet.edits.length === 0) return null;
    setUndoing(true);
    setError(null);

    try {
      const dp = getDataPlane(workspaceId);
      const applier = new ChangeSetApplier(dp);
      const result = await applier.undoAll(changeSet.edits);
      setLastUndo(result);
      onUndone?.();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setUndoing(false);
    }
  };

  return { applying, undoing, lastApply, lastUndo, error, apply, undo };
}
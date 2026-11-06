// Diff Review full-screen modal. Implements the documented Apply/Undo UX:
// per-file unified diff, syntax-style +/− coloring, optional `undoable` badge
// (e.g. "too large to undo locally" when oldContent > 1 MB cap),
// Apply (with If-Match = read-time ETag) and Undo (per inverse table,
// If-Match = postApplyETag). Errors (ETag mismatch / ambiguous search /
// partial-Apply rollback walk-back) surface inline with the `note` field.

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Card";
import { getDataPlane } from "@/lib/api";
import { useChangeSet } from "@/lib/hooks/useChangeSet";
import { diffForEdit } from "@/lib/changeset/preview";
import { diffStat } from "@/lib/changeset/unifiedDiff";
import type { ChangeSet, FileEdit } from "@/lib/changeset/types";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  changeSet: ChangeSet | undefined;
  // Notify the parent that the changeSet's status/edits mutated (post-Apply/Undo).
  onConsumed?: (cs: ChangeSet | undefined) => void;
}

interface FilePreview {
  edit: FileEdit;
  before: string;
  after: string;
  lines: { type: "context" | "added" | "removed"; text: string }[];
  applyError?: { code: string; message: string };
  stat: { adds: number; dels: number };
  bareBadge?: "create" | "delete" | "rewrite";
}

export function DiffReviewSheet({ open, onClose, workspaceId, changeSet, onConsumed }: Props): JSX.Element {
  // When open: fetch each file's current content (except `create`), compute preview.
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open || !changeSet) return;
    let cancelled = false;
    setLoadingPreviews(true);
    setPreviewError(null);
    (async () => {
      const dp = getDataPlane(workspaceId);
      const out: FilePreview[] = [];

      try {
        for (const edit of changeSet.edits) {
          let before: string | undefined;

          if (edit.op.kind !== "create") {
            try {
              const file = await dp.getFile(edit.path);
              before = new TextDecoder("utf-8", { fatal: false }).decode(file.content);
            } catch (err) {
              // 404 means the file doesn't exist yet — preview as empty.
              before = "";
              void err;
            }
          }

          const p = diffForEdit(edit, before);
          out.push({
            edit,
            before: p.before,
            after: p.after,
            lines: p.lines,
            applyError: p.applyError,
            stat: diffStat(p.lines),
            bareBadge:
              edit.op.kind === "create"
                ? "create"
                : edit.op.kind === "delete"
                  ? "delete"
                  : edit.op.kind === "rewrite"
                    ? "rewrite"
                    : undefined,
          });
        }

        if (!cancelled) {
          setPreviews(out);
          setActiveIndex(0);
        }
      } catch (err) {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoadingPreviews(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, changeSet, workspaceId]);

  if (!changeSet) return null;

  const { apply, undo, applying, undoing, lastApply, lastUndo, error } = useChangeSet(
    workspaceId,
    changeSet,
  );

  // Determine current overall status: pending / applied / undone / failed / partial.
  const status: "pending" | "applied" | "undone" | "failed" | "partial" = useMemo(() => {
    if (lastApply && !lastApply.ok) return lastApply.failed.length > 0 && lastApply.applied.length > 0 ? "partial" : "failed";

    if (lastApply?.ok) return "applied";

    if (lastUndo) return lastUndo.ok ? "undone" : "partial";
    return "pending";
  }, [lastApply, lastUndo]);

  const onApplyClick = async () => {
    const result = await apply(() => {
      onConsumed?.({ ...changeSet, status: "applied" });
    });

    if (result && result.ok) {
      onConsumed?.({ ...changeSet, status: "applied" });
    } else if (result) {
      onConsumed?.({
        ...changeSet,
        status: result.applied.length > 0 ? "partiallyUndone" : "failed",
      });
    }
  };

  const onUndoClick = async () => {
    const result = await undo(() => {
      onConsumed?.({ ...changeSet, status: "undone" });
    });

    if (result && result.ok) {
      onConsumed?.({ ...changeSet, status: "undone" });
    } else if (result) {
      onConsumed?.({ ...changeSet, status: "partiallyUndone" });
    }
  };

  const activePreview = previews[activeIndex];

  return (
    <Sheet open={open} onClose={onClose} variant="full" labelledBy="diff-title">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b-2 brutal-border bg-bg px-4 py-3 safe-pad-top">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-text hover:text-fg">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Back
        </button>
        <div id="diff-title" className="label-caps text-sm">
          Review Changes
        </div>
        {status === "applied" ? (
          <span className="flex items-center gap-1.5 border-2 brutal-border bg-plus-bg px-2 py-1 text-xs font-bold uppercase tracking-label text-plus">
            <Check className="h-4 w-4" strokeWidth={2.5} /> Applied
          </span>
        ) : (
          <Button onClick={onApplyClick} loading={applying} disabled={!previews.length} className="px-3 py-1.5">
            Apply
          </Button>
        )}
      </div>

      {/* File tabs */}
      <div className="border-b-2 brutal-border bg-bg px-4 py-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {previews.map((p, i) => (
            <button
              key={p.edit.path}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "shrink-0 border-2 px-3 py-1 text-xs uppercase tracking-label font-bold transition",
                i === activeIndex
                  ? "brutal-border-accent bg-accent text-black"
                  : "brutal-border bg-muted text-muted-text hover:text-fg",
              )}
            >
              {p.edit.path.split("/").pop()}
              <span className="ml-1.5 opacity-80">
                +{p.stat.adds} −{p.stat.dels}
              </span>
            </button>
          ))}
          {previews.length === 0 && !previewError && loadingPreviews && (
            <span className="text-xs uppercase tracking-label text-muted-text">Loading…</span>
          )}
          {previews.length === 0 && !previewError && !loadingPreviews && (
            <span className="text-xs uppercase tracking-label text-muted-text">No proposed edits.</span>
          )}
          {previewError && (
            <span className="text-xs text-minus">Failed to load: {previewError}</span>
          )}
        </div>
      </div>

      {/* Diff body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activePreview && <FileDiffView preview={activePreview} />}
      </div>

      {/* Error toast */}
      {(error || (activePreview?.applyError && status === "pending")) && (
        <div className="mx-4 mb-2 border-2 brutal-border bg-minus-bg p-3 text-xs text-minus">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
            <div>
              <div className="font-bold uppercase tracking-label">
                {activePreview?.applyError ? `Preview blocked for ${activePreview.edit.path}` : "Apply error"}
              </div>
              <div className="mt-0.5">
                {activePreview?.applyError?.message ?? error}
              </div>
              <button
                onClick={onClose}
                className="mt-1 text-minus underline underline-offset-2 hover:no-underline"
              >
                Ask the AI to re-emit with more context
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk-back / partial-apply note */}
      {lastApply && !lastApply.ok && (
        <div className="mx-4 mb-2 border-2 brutal-border bg-muted p-3 text-xs text-fg">
          <div className="font-bold uppercase tracking-label text-minus">Apply failed at {lastApply.failed[0]?.path}</div>
          <div className="mt-0.5 text-muted-text">{lastApply.note}</div>
          {lastApply.rolledBack.length > 0 && (
            <div className="mt-1 text-muted-text">
              Rolled back: {lastApply.rolledBack.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Undo outcome note */}
      {lastUndo && (
        <div
          className={cn(
            "mx-4 mb-2 border-2 p-3 text-xs",
            lastUndo.ok
              ? "brutal-border bg-plus-bg text-plus"
              : "brutal-border bg-muted text-fg",
          )}
        >
          <div className="font-bold uppercase tracking-label">
            {lastUndo.ok ? "Undone" : `Undid ${lastUndo.undone.length} of ${lastUndo.skipped.length + lastUndo.undone.length} files`}
          </div>
          {lastUndo.note && <div className="mt-0.5 text-muted-text">{lastUndo.note}</div>}
          {lastUndo.skipped.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-muted-text">
              {lastUndo.skipped.map((s) => (
                <li key={s.path}>
                  {s.path}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bottom sticky actions */}
      <div className="border-t-2 brutal-border bg-bg px-4 py-3 safe-pad-bottom">
        {status === "applied" || status === "undone" || status === "partial" ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Done
            </Button>
            {(status === "applied" || (lastUndo && !lastUndo.ok)) && (
              <Button
                onClick={onUndoClick}
                loading={undoing}
                disabled={previews.every((p) => !p.edit.undoable)}
                variant="secondary"
                className="flex-1"
              >
                {previews.every((p) => !p.edit.undoable)
                  ? "Undo (none undoable)"
                  : `Undo (${previews.filter((p) => p.edit.undoable).length} of ${previews.length} files)`}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Reject
            </Button>
            <Button onClick={onApplyClick} loading={applying} disabled={!previews.length} className="flex-1">
              Apply Changes
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function FileDiffView({ preview }: { preview: FilePreview }) {
  const { edit, lines, stat, applyError, bareBadge } = preview;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-sm font-bold">{edit.path}</div>
          <div className="mt-0.5 text-xs uppercase tracking-label text-muted-text">
            {bareBadge === "create"
              ? "new file"
              : bareBadge === "delete"
                ? "deleted"
                : bareBadge === "rewrite"
                  ? "rewrite"
                  : `+${stat.adds} −${stat.dels}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!edit.undoable && (
            <Badge className="border-minus bg-minus-bg text-minus">
              <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
              {edit.undoableReason ?? "not undoable"}
            </Badge>
          )}
        </div>
      </div>
      {applyError ? (
        <div className="border-2 brutal-border bg-minus-bg p-3 text-sm text-minus">
          <div className="font-bold uppercase tracking-label">Block apply rejected</div>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">
{applyError.message}
          </pre>
        </div>
      ) : (
        <pre className="overflow-x-auto border-2 brutal-border bg-bg p-3 text-xs leading-relaxed">
          <code className="font-mono">
            {lines.map((l, i) => (
              <Line key={i} type={l.type} text={l.text} />
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}

function Line({ type, text }: { type: "context" | "added" | "removed"; text: string }) {
  const cls =
    type === "added"
      ? "block bg-plus-bg text-plus"
      : type === "removed"
        ? "block bg-minus-bg text-minus"
        : "block";
  const prefix = type === "added" ? "+" : type === "removed" ? "−" : " ";
  return (
    <span className={cls}>
      <span className="select-none font-bold">{prefix} </span>
      {text || " "}
    </span>
  );
}
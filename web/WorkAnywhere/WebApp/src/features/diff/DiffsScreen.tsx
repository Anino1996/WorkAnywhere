import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Card, Badge } from "@/components/Card";
import { useChatStore } from "@/lib/store/chat";
import { useUIStore } from "@/lib/store/ui";
import { DiffReviewSheet } from "@/features/diff/DiffReviewSheet";
import { ScrollText } from "lucide-react";
import { STASH_CAP_BYTES } from "@/lib/changeset/types";

export function DiffsScreen(): JSX.Element {
  const [params] = useSearchParams();
  const wsId = params.get("ws") ?? useUIStore.getState().activeWorkspaceId ?? "ws_demo_active";
  const navigate = useNavigate();
  const cs = useChatStore((s) => s.currentChangeSetByWorkspace[wsId]);
  const [review, setReview] = useState(false);

  return (
    <Screen
      header={
        <div className="border-b-2 brutal-border pb-4">
          <h1 className="text-2xl font-extrabold uppercase tracking-label">Diffs</h1>
          <p className="mt-1 text-sm text-muted-text">
            Review proposed changes from AI before they touch the workspace.
          </p>
        </div>
      }
    >
      {!cs || cs.edits.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center text-sm text-muted-text">
          <ScrollText className="mb-3 h-10 w-10 opacity-40" strokeWidth={1.5} />
          No proposed changes yet.
          <Button
            variant="secondary"
            onClick={() => navigate(`/chat?ws=${wsId}`)}
            className="mt-4"
          >
            Chat with the AI to generate changes
          </Button>
          <p className="mt-3 text-xs uppercase tracking-label text-muted-text/70">
            Try asking about "auth" or "test" — the stub returns canned ChangeSets.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-caps text-xs text-muted-text">
                {cs.edits.length} file{cs.edits.length === 1 ? "" : "s"} · {cs.status}
              </span>
              <Badge className="border-border">{cs.status}</Badge>
            </div>
            <ul className="flex flex-col gap-2">
              {cs.edits.map((e) => (
                <li key={e.path} className="flex items-center justify-between border-b-2 brutal-border pb-2 text-sm last:border-b-0">
                  <span className="font-mono">{e.path}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-label text-muted-text">
                      {e.op.kind === "create"
                        ? "create"
                        : e.op.kind === "delete"
                          ? "delete"
                          : e.op.kind === "rewrite"
                            ? "rewrite"
                            : `${e.op.blocks.length} block${e.op.blocks.length === 1 ? "" : "s"}`}
                    </span>
                    {!e.undoable && (
                      <span className="text-xs uppercase tracking-label font-bold text-minus">⚠ not undoable</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs uppercase tracking-label text-muted-text/70">
              Undo is enabled per-file unless the stashed original content
              exceeds {(STASH_CAP_BYTES / 1_000_000).toFixed(0)} MB.
            </p>
          </Card>
          <Button onClick={() => setReview(true)}>Open Review</Button>
        </div>
      )}

      <DiffReviewSheet
        open={review}
        onClose={() => setReview(false)}
        workspaceId={wsId}
        changeSet={cs}
        onConsumed={(updated) => {
          useChatStore.getState().setCurrentChangeSet(wsId, updated);
        }}
      />
    </Screen>
  );
}
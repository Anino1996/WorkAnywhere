import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Screen } from "@/components/Screen";
import { WorkspaceBar } from "@/components/WorkspaceBar";
import { WorkspaceInfoDrawer } from "./WorkspaceInfoDrawer";
import { Input } from "@/components/Input";
import { useUIStore } from "@/lib/store/ui";
import { useChatStore, makeMessage } from "@/lib/store/chat";
import { stubReply } from "@/lib/ai/stub";
import type { ChangeSet } from "@/lib/changeset/types";
import { ScrollText, Plus, ArrowUp, Play, FlaskConical, Hammer } from "lucide-react";
import { DiffReviewSheet } from "@/features/diff/DiffReviewSheet";
import { ActionButton } from "@/components/ActionButton";

export function ChatScreen(): JSX.Element {
  const [params] = useSearchParams();
  const wsId = params.get("ws") ?? useUIStore.getState().activeWorkspaceId ?? "";
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace);
  useEffect(() => {
    if (wsId) setActiveWorkspace(wsId);
  }, [wsId, setActiveWorkspace]);

  const messages = useChatStore((s) => s.messagesByWorkspace[wsId] ?? []);
  const addMessage = useChatStore((s) => s.addMessage);
  const currentChangeSet = useChatStore((s) => s.currentChangeSetByWorkspace[wsId]);
  const setCurrentChangeSet = useChatStore((s) => s.setCurrentChangeSet);

  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const openBuildSheet = useUIStore((s) => s.openBuildSheet);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, thinking]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    addMessage(wsId, makeMessage("user", text));
    setDraft("");
    setThinking(true);
    setTimeout(() => {
      const reply = stubReply(text);
      addMessage(wsId, makeMessage("ai", reply.text, reply.changeSet));
      if (reply.changeSet) setCurrentChangeSet(wsId, reply.changeSet);
      setThinking(false);
    }, 700);
  };

  return (
    <Screen
      header={
        <div className="pt-1">
          <WorkspaceBar workspaceId={wsId} />
        </div>
      }
      bodyClassName="flex flex-col"
    >
      <div
        ref={listRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4"
      >
        {messages.length === 0 && !thinking && <EmptyState ws={wsId} />}
        {messages.map((m) => (
          <Message key={m.id} message={m} onViewChanges={() => setReviewOpen(true)} />
        ))}
        {thinking && <ThinkingBubble />}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t-2 brutal-border bg-bg px-4 pb-2 pt-2">
        <div className="mb-2 flex gap-2">
          <ActionButton icon={<Play className="h-4 w-4" />} label="Run" onClick={openBuildSheet} />
          <ActionButton icon={<FlaskConical className="h-4 w-4" />} label="Test" onClick={openBuildSheet} />
          <ActionButton icon={<Hammer className="h-4 w-4" />} label="Build" onClick={openBuildSheet} />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-9 w-9 items-center justify-center border-2 brutal-border bg-muted text-muted-text hover:text-fg">
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type what you want to build…"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="flex h-9 w-9 items-center justify-center border-2 brutal-border-accent bg-accent text-black shadow-none transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm disabled:opacity-40 disabled:transform-none"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <DiffReviewSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        workspaceId={wsId}
        changeSet={currentChangeSet}
        onConsumed={(cs) => setCurrentChangeSet(wsId, cs)}
      />
      <WorkspaceInfoDrawer workspaceId={wsId} />
    </Screen>
  );
}

function EmptyState({ ws }: { ws: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center border-2 brutal-border bg-muted text-muted-text">
        <ScrollText className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-sm text-muted-text">
        Conversation with the workspace. Try:{" "}
        <span className="text-accent">"add auth validation"</span>,{" "}
        <span className="text-accent">"write tests"</span>,{" "}
        <span className="text-accent">"rewrite the weights file"</span>, or{" "}
        <span className="text-accent">"ambiguous rename"</span>.
      </p>
      <p className="mt-2 text-xs text-muted-text/70">
        Workspace: <span className="font-mono">{ws.slice(0, 12)}…</span>
      </p>
    </div>
  );
}

interface Props {
  message: ReturnType<typeof makeMessage>;
  onViewChanges: () => void;
}

function Message({ message, onViewChanges }: Props) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] border-2 brutal-border-accent bg-accent px-3.5 py-2 text-sm font-medium text-black">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[88%] border-2 brutal-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
        {message.text}
      </div>
      {message.changeSet && (
        <div className="flex flex-col gap-2">
          <ChangeCard changeset={message.changeSet} onViewChanges={onViewChanges} />
          <div className="flex gap-2">
            <button
              onClick={onViewChanges}
              className="border-2 brutal-border bg-muted px-3 py-1 text-xs uppercase tracking-label font-bold text-accent transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm"
            >
              View Changes
            </button>
            <button
              onClick={() => useUIStore.getState().openBuildSheet()}
              className="border-2 brutal-border bg-muted px-3 py-1 text-xs uppercase tracking-label font-bold text-muted-text transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm"
            >
              View Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeCard({ changeset, onViewChanges }: { changeset: ChangeSet; onViewChanges: () => void }) {
  return (
    <button
      onClick={onViewChanges}
      className="w-full border-2 brutal-border bg-muted p-3 text-left transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-label font-bold text-muted-text">
          {changeset.edits.length} file{changeset.edits.length === 1 ? "" : "s"} · {changeset.status}
        </span>
        <span className="border-2 brutal-border-accent bg-accent px-2 py-0.5 text-[10px] uppercase tracking-label font-bold text-black">
          Review
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {changeset.edits.map((e, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="font-mono">{e.path}</span>
            <span className="text-muted-text">
              {e.op.kind === "create"
                ? "create"
                : e.op.kind === "delete"
                  ? "delete"
                  : e.op.kind === "rewrite"
                    ? "rewrite"
                    : `${e.op.blocks.length} block${e.op.blocks.length === 1 ? "" : "s"}`}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-1">
      <span className="h-2.5 w-2.5 animate-bounce bg-muted-text [animation-delay:-0.3s]" />
      <span className="h-2.5 w-2.5 animate-bounce bg-muted-text [animation-delay:-0.15s]" />
      <span className="h-2.5 w-2.5 animate-bounce bg-muted-text" />
    </div>
  );
}
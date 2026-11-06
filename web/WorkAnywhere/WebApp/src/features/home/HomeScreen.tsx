import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "@/components/Screen";
import { Card, StatusDot, Badge } from "@/components/Card";
import { ListItem } from "@/components/ListItem";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Input } from "@/components/Input";
import { useWorkspaces } from "@/lib/hooks/useWorkspaces";
import { useOperationPoll } from "@/lib/hooks/useOperationPoll";
import { useUIStore } from "@/lib/store/ui";
import { useAuthStore } from "@/lib/store/auth";
import { getControlPlane } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Server,
  Laptop,
  ChevronRight,
  Clock,
  GitBranch,
} from "lucide-react";
import { formatRelative } from "@/lib/format";

const MODEL_OPTIONS = [
  { value: "gpt-4", label: "GPT-4", descriptor: "Fast & broad" },
  { value: "claude", label: "Claude", descriptor: "Careful & long-form" },
  { value: "gemini", label: "Gemini", descriptor: "Multimodal" },
] as const;

export function HomeScreen(): JSX.Element {
  const { data, isLoading } = useWorkspaces();
  const navigate = useNavigate();
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace);
  const createOpen = useUIStore((s) => s.createOpen);
  const openCreate = useUIStore((s) => s.openCreate);
  const closeCreate = useUIStore((s) => s.closeCreate);
  const aiModel = useUIStore((s) => s.aiModel);
  const setAiModel = useUIStore((s) => s.setAiModel);
  const openModelSelector = useUIStore((s) => s.openModelSelector);
  const session = useAuthStore((s) => s.session);

  const workspaces = data?.workspaces ?? [];
  const firstName = (session?.email ?? "Alex").split("@")[0];

  const openWorkspace = (id: string, _status: string) => {
    setActiveWorkspace(id);
    navigate(`/chat?ws=${id}`);
  };

  return (
    <Screen
      header={
        <div className="border-b-2 brutal-border px-4 pb-4">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-text">
            Let's start coding with AI assistance.
          </p>
        </div>
      }
    >
      <section className="mt-6">
        <h2 className="label-caps mb-3 text-xs text-muted-text">
          Your Workspaces
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            {workspaces.map((w) => (
              <WorkspaceCard
                key={w.workspace_id}
                id={w.workspace_id}
                name={w.name}
                status={w.status}
                lastActiveAt={w.last_active_at}
                onClick={() => openWorkspace(w.workspace_id, w.status)}
              />
            ))}
            <button
              onClick={openCreate}
              className="flex min-w-[220px] shrink-0 flex-col items-start gap-2 rounded-sm border-2 brutal-border bg-muted p-4 text-left transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
            >
              <div className="flex h-10 w-10 items-center justify-center border-2 brutal-border-accent bg-accent text-black">
                <Laptop className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-sm font-bold uppercase tracking-label">Start New</div>
              <div className="text-xs text-muted-text">Launch a cloud dev env</div>
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center border-2 brutal-border-accent bg-accent text-black">
                <Plus className="h-4 w-4" strokeWidth={2} />
              </span>
            </button>
          </div>
        )}
      </section>

      <div className="my-6 border-t-2 brutal-border" />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="label-caps text-xs text-muted-text">
            Recent Projects
          </h2>
          <button className="text-xs uppercase tracking-label font-bold text-accent hover:underline">See all</button>
        </div>
        {workspaces.length === 0 ? (
          <Card className="p-6 text-sm text-muted-text">
            No workspaces yet — create one to see it here.
          </Card>
        ) : (
          <Card className="divide-y-2 divide-border">
            {workspaces.slice(0, 3).map((w) => (
              <ListItem
                key={w.workspace_id}
                icon={
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 brutal-border bg-bg text-accent">
                    <GitBranch className="h-4 w-4" strokeWidth={2} />
                  </div>
                }
                title={w.name}
                subtitle={`Updated ${formatRelative(w.last_active_at)}`}
                onClick={() => openWorkspace(w.workspace_id, w.status)}
              />
            ))}
          </Card>
        )}
      </section>

      <div className="my-6 border-t-2 brutal-border" />

      <section>
        <h2 className="label-caps mb-3 text-xs text-muted-text">
          AI Model
        </h2>
        <button onClick={openModelSelector} className="block w-full text-left">
          <Card className="flex items-center justify-between px-4 py-3 transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm">
            <div>
              <div className="text-sm font-bold uppercase tracking-label">
                {MODEL_OPTIONS.find((o) => o.value === aiModel)?.label}
              </div>
              <div className="text-xs text-muted-text">
                {MODEL_OPTIONS.find((o) => o.value === aiModel)?.descriptor}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-text" strokeWidth={2} />
          </Card>
        </button>
      </section>

      <section className="mt-6 flex flex-col gap-3">
        <Button
          onClick={() =>
            workspaces[0] && openWorkspace(workspaces[0].workspace_id, workspaces[0].status)
          }
          disabled={workspaces.length === 0}
          className="w-full"
        >
          {"<> Start Coding"}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/diffs")} className="w-full">
          View Diffs
        </Button>
      </section>

      <CreateWorkspaceSheet open={createOpen} onClose={closeCreate} />
    </Screen>
  );
}

function WorkspaceCard({
  name,
  status,
  lastActiveAt,
  onClick,
}: {
  id: string;
  name: string;
  status: string;
  lastActiveAt: string;
  onClick: () => void;
}) {
  const label =
    status === "ACTIVE" ? "Active" : status === "SAVED" ? "Saved" : status;
  return (
    <button
      onClick={onClick}
      className="flex min-w-[220px] shrink-0 flex-col gap-2 rounded-sm border-2 brutal-border bg-muted p-4 text-left transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center border-2 brutal-border bg-bg text-accent">
          <Server className="h-4 w-4" strokeWidth={2} />
        </div>
        <StatusDot status={status} />
      </div>
      <div>
        <div className="text-sm font-bold">{name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs uppercase tracking-label text-muted-text">
          <span>{label}</span>
          <span aria-hidden>·</span>
          <Clock className="h-3 w-3" />
          {formatRelative(lastActiveAt)}
        </div>
      </div>
      <Badge className="mt-1 w-fit border-border">{status}</Badge>
    </button>
  );
}

function SkeletonCard() {
  return <div className="h-[120px] animate-pulse rounded-sm border-2 brutal-border bg-muted" />;
}

function CreateWorkspaceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [pendingOpId, setPendingOpId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace);
  const qc = useQueryClient();

  useOperationPoll(pendingOpId, (op) => {
    if (op.status === "COMPLETED") {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      const id = op.workspace_id;
      setPendingOpId(null);
      onClose();
      setActiveWorkspace(id);
      navigate(`/chat?ws=${id}`);
    }
  });

  const create = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await getControlPlane().createWorkspace({ name: name.trim() });
      setActiveWorkspace(res.workspace_id);
      setPendingOpId(res.operation_id);
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setName("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} variant="bottom" labelledBy="create-ws-title">
      <div className="safe-pad">
        <div id="create-ws-title" className="label-caps mb-1 text-base">
          New Workspace
        </div>
        <p className="mb-4 text-xs text-muted-text">
          A fresh container will be provisioned. VCS branch import is deferred —
          for now we just create from scratch.
        </p>
        <div className="flex flex-col gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-workspace"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={create}
              loading={submitting}
              disabled={!name.trim()}
              className="flex-1"
            >
              {pendingOpId ? "Provisioning…" : "Create"}
            </Button>
          </div>
          {pendingOpId && (
            <div className="mt-1 text-xs uppercase tracking-label text-accent">
              Polling operation {pendingOpId} every 500ms… card will flip when ACTIVE.
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
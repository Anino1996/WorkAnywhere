import { ChevronDown, Server } from "lucide-react";
import { useWorkspace } from "@/lib/hooks/useWorkspaces";
import { useUIStore } from "@/lib/store/ui";
import { StatusDot } from "@/components/Card";

export function WorkspaceBar({ workspaceId }: { workspaceId: string }): JSX.Element {
  const { data: ws } = useWorkspace(workspaceId);
  const toggleDrawer = useUIStore((s) => s.toggleWorkspaceDrawer);
  return (
    <button
      onClick={toggleDrawer}
      className="mx-0 flex w-full items-center justify-between border-2 brutal-border bg-muted px-3 py-2 transition hover:bg-muted/80"
    >
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-text" strokeWidth={2} />
        <span className="text-sm font-bold uppercase tracking-label">
          {ws?.name ?? "Loading…"}
        </span>
        {ws && <StatusDot status={ws.status} />}
        {ws?.name && (
          <span className="text-xs text-muted-text uppercase tracking-label">Python</span>
        )}
      </div>
      <ChevronDown className="h-4 w-4 text-muted-text" strokeWidth={2} />
    </button>
  );
}
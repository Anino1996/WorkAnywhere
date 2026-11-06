import { Sheet } from "@/components/Sheet";
import { useUIStore } from "@/lib/store/ui";
import { useWorkspace } from "@/lib/hooks/useWorkspaces";
import { StatusDot } from "@/components/Card";
import { Cpu, MemoryStick, GitBranch, CheckCircle2 } from "lucide-react";
import "./WorkspaceInfoDrawer.css";

export function WorkspaceInfoDrawer({ workspaceId }: { workspaceId: string }): JSX.Element {
  const open = useUIStore((s) => s.workspaceDrawerOpen);
  const close = useUIStore((s) => s.closeWorkspaceDrawer);
  const { data: ws } = useWorkspace(workspaceId);

  return (
    <Sheet open={open} onClose={close} variant="bottom" labelledBy="ws-drawer-title">
      <div className="safe-pad flex flex-col gap-3 text-sm">
        <div id="ws-drawer-title" className="label-caps text-base">
          Workspace Info
        </div>
        <p className="text-xs text-muted-text">
          Metrics and config details are stubbed for this build — the panel
          shape and motion are wired to the documented UI but values are
          illustrative only.
        </p>
        <div className="border-2 brutal-border bg-muted">
          <div className="px-4 py-2">
            <Row label="Name" value={ws?.name ?? "—"} />
            <Row label="Language" value="Python (mock)" />
            <Row
              label="Status"
              value={
                <span className="flex items-center gap-1.5">
                  <StatusDot status={ws?.status ?? "PROVISIONING"} />
                  {ws?.status ?? "—"}
                </span>
              }
            />
          </div>
          <div className="border-t-2 brutal-border px-4 py-2">
            <div className="label-caps mb-2 text-[11px] text-muted-text">Usage</div>
            <UsageBar icon={<Cpu className="h-3.5 w-3.5" strokeWidth={2} />} label="CPU" value={0.18} />
            <UsageBar icon={<MemoryStick className="h-3.5 w-3.5" strokeWidth={2} />} label="RAM" value={0.42} />
          </div>
          <div className="border-t-2 brutal-border px-4 py-2">
            <Row
              label="Git branch"
              value={
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" strokeWidth={2} /> main
                </span>
              }
            />
            <Row
              label="Last build"
              value={
                <span className="flex items-center gap-1.5 text-plus">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Success
                </span>
              }
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-text uppercase tracking-label text-xs font-bold">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function UsageBar({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-label font-bold">
        <span className="flex items-center gap-1.5 text-muted-text">
          {icon}
          {label}
        </span>
        <span className="text-muted-text">{pct}%</span>
      </div>
      <div className="h-2 border-2 brutal-border bg-bg">
        <div
          className="h-full bg-accent usage-fill"
          style={{ "--usage-pct": `${pct}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/lib/store/auth";
import { useUIStore } from "@/lib/store/ui";
import { resetMockControlPlane, resetMockDataPlane } from "@/lib/api";
import { useDemoStore } from "@/lib/api/demo";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ChevronRight, Sparkles, Trash2, AlertTriangle, Gauge } from "lucide-react";

export function SettingsScreen(): JSX.Element {
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const aiModel = useUIStore((s) => s.aiModel);
  const openModelSelector = useUIStore((s) => s.openModelSelector);
  const navigate = useNavigate();

  const slowMs = useDemoStore((s) => s.slowMs);
  const setSlow = useDemoStore((s) => s.setSlow);
  const queuePreconditionFail = useDemoStore((s) => s.queuePreconditionFail);
  const queuePartialFail = useDemoStore((s) => s.queuePartialFailOnIndex);
  const resetDemo = useDemoStore((s) => s.reset);
  const [resetFlash, setResetFlash] = useState<string | null>(null);

  const reset = () => {
    resetMockControlPlane();

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);

      if (k?.startsWith("caw.mock.dp.")) {
        const wsId = k.replace("caw.mock.dp.", "").replace(".v1", "");

        if (wsId) resetMockDataPlane(wsId);
      }
    }

    useUIStore.getState().setActiveWorkspace(null);
    resetDemo();
    setResetFlash("Demo data reset. Reloading…");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <Screen
      header={
        <div className="border-b-2 brutal-border pb-4">
          <h1 className="text-2xl font-extrabold uppercase tracking-label">Settings</h1>
        </div>
      }
    >
      <section className="mt-6">
        <h2 className="label-caps mb-3 text-xs text-muted-text">Account</h2>
        <Card className="p-4">
          <div className="text-sm">
            <div className="uppercase tracking-label text-xs text-muted-text">Signed in as</div>
            <div className="mt-1 font-mono text-sm">{session?.email ?? "—"}</div>
            <div className="mt-1 text-xs uppercase tracking-label text-muted-text">
              Account ID: <span className="font-mono">{session?.accountId}</span>
            </div>
          </div>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              signOut();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </Button>
        </Card>
      </section>

      <div className="my-6 border-t-2 brutal-border" />

      <section>
        <h2 className="label-caps mb-3 text-xs text-muted-text">AI Model</h2>
        <button onClick={openModelSelector} className="block w-full text-left">
          <Card className="flex items-center justify-between p-4 transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={2} />
              <div>
                <div className="text-sm font-bold uppercase tracking-label">{aiModel}</div>
                <div className="text-xs uppercase tracking-label text-muted-text">Locally stored preference</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-text" strokeWidth={2} />
          </Card>
        </button>
      </section>

      <div className="my-6 border-t-2 brutal-border" />

      <section>
        <h2 className="label-caps mb-3 flex items-center gap-1.5 text-xs text-muted-text">
          <Gauge className="h-3 w-3" strokeWidth={2} /> Demo Controls
          <span className="border-2 brutal-border-accent bg-accent px-1.5 text-[10px] text-black">
            dev only
          </span>
        </h2>
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <div className="label-caps mb-1.5 flex items-center justify-between text-xs">
              <span>Slow ops (added latency)</span>
              <span className="font-mono text-muted-text">{slowMs}ms</span>
            </div>
            <input
              type="range"
              min={0}
              max={3000}
              step={100}
              value={slowMs}
              onChange={(e) => setSlow(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div className="flex flex-col gap-2 border-t-2 brutal-border pt-3">
            <div className="label-caps text-xs text-muted-text">Inject failures into next Apply</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={queuePreconditionFail} className="flex-1 text-xs">
                ETag 412 once
              </Button>
              <Button variant="secondary" onClick={() => queuePartialFail(1)} className="flex-1 text-xs">
                Partial fail at file #2
              </Button>
            </div>
            <p className="text-xs uppercase tracking-label text-muted-text/70">
              Go ask the AI to propose changes (e.g. "auth") and Apply — these
              flags will trigger the corresponding error paths once and self-clear.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t-2 brutal-border pt-3">
            <div className="label-caps flex items-center gap-1.5 text-sm text-minus">
              <AlertTriangle className="h-4 w-4" strokeWidth={2.5} /> Reset demo data
            </div>
            <p className="text-xs uppercase tracking-label text-muted-text/70">
              Wipes localStorage: workspaces, mock FS, sessions, AI-model
              preference. Reloads the app with the seed fixtures.
            </p>
            <Button variant="danger" onClick={reset} className="w-full">
              <Trash2 className="h-4 w-4" strokeWidth={2} /> Reset
            </Button>
            {resetFlash && <div className="text-xs uppercase tracking-label text-plus">{resetFlash}</div>}
          </div>
        </Card>
      </section>

      <div className="my-6 border-t-2 brutal-border" />

      <section className="text-center text-xs uppercase tracking-label text-muted-text/60">
        Demo build · mock backend only · no remote calls.
      </section>
    </Screen>
  );
}
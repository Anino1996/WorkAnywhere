import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useUIStore } from "@/lib/store/ui";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle } from "lucide-react";

const MOCK_LOG = `[2026-07-05 10:12:01] starting build
[2026-07-05 10:12:03] building targets
[2026-07-05 10:12:09] collecting artifacts
[2026-07-05 10:12:14] FAILED: tests/test_auth.py::test_authenticate_rejects_empty
  │ AuthError was not raised
  │   at /workspace/tests/test_auth.py:34
[2026-07-05 10:12:14] === 1 failed, 2 passed in 18.4s ===
[2026-07-05 10:12:14] build complete (exit 1)
`;

export function BuildRunTestSheet(): JSX.Element {
  const open = useUIStore((s) => s.buildSheetOpen);
  const close = useUIStore((s) => s.closeBuildSheet);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ws = params.get("ws") ?? useUIStore.getState().activeWorkspaceId ?? "ws_demo_active";

  return (
    <Sheet open={open} onClose={close} variant="bottom" labelledBy="build-title">
      <div className="safe-pad">
        <div className="mb-1 flex items-center justify-between">
          <div id="build-title" className="label-caps text-base">
            Test Results
          </div>
          <button onClick={close} className="text-muted-text hover:text-fg">×</button>
        </div>
        <div className="mb-3 flex items-center gap-2 border-2 brutal-border bg-minus/10 px-3 py-2 text-sm font-bold uppercase tracking-label text-minus">
          <XCircle className="h-5 w-5" strokeWidth={2.5} />
          <span>1 failed · 2 passed</span>
        </div>
        <pre className="mb-3 max-h-[40vh] overflow-y-auto border-2 brutal-border bg-bg p-3 text-xs leading-relaxed">
          <code className="font-mono">{MOCK_LOG}</code>
        </pre>
        <Button
          variant="secondary"
          onClick={() => {
            close();
            navigate(`/chat?ws=${ws}`);
          }}
          className="w-full"
        >
          Fix with AI
        </Button>
      </div>
    </Sheet>
  );
}
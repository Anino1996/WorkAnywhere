import { Sheet } from "@/components/Sheet";
import { useUIStore } from "@/lib/store/ui";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

const OPTIONS = [
  { value: "gpt-4", label: "GPT-4", descriptor: "Fast & broad" },
  { value: "claude", label: "Claude", descriptor: "Careful & long-form" },
  { value: "gemini", label: "Gemini", descriptor: "Multimodal" },
] as const;

export function ModelSelectionModal() {
  const open = useUIStore((s) => s.modelSelectorOpen);
  const close = useUIStore((s) => s.closeModelSelector);
  const aiModel = useUIStore((s) => s.aiModel);
  const setAiModel = useUIStore((s) => s.setAiModel);

  return (
    <Sheet open={open} onClose={close} variant="modal" labelledBy="model-title">
      <div className="safe-pad">
        <div id="model-title" className="label-caps mb-1 text-base">
          Select Model
        </div>
        <p className="mb-4 text-xs text-muted-text">
          Stored locally for this demo — no real provider wired up.
        </p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((o) => {
            const active = o.value === aiModel;
            return (
              <button
                key={o.value}
                onClick={() => {
                  setAiModel(o.value);
                  close();
                }}
                className={cn(
                  "flex items-center justify-between border-2 p-3 text-left transition",
                  active
                    ? "brutal-border-accent bg-accent/10 brutal-shadow-sm"
                    : "brutal-border bg-muted hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm",
                )}
              >
                <div>
                  <div className="text-sm font-bold uppercase tracking-label">{o.label}</div>
                  <div className="text-xs text-muted-text">{o.descriptor}</div>
                </div>
                {active && <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
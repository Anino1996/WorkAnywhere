import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

export function ActionButton({ icon, label, onClick, className }: ActionButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-sm border-2 brutal-border bg-muted py-1.5 text-xs uppercase tracking-label font-bold text-muted-text transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm hover:text-fg active:translate-x-0 active:translate-y-0 active:shadow-none",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

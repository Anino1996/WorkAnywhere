import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn("bg-muted brutal-border", className)}
        {...rest}
      />
    );
  },
);

export function StatusDot({ status }: { status: string }): JSX.Element {
  const color =
    status === "ACTIVE"
      ? "bg-plus"
      : status === "PROVISIONING" || status === "RESUMING" || status === "SAVING"
        ? "bg-accent animate-pulse"
        : status === "SAVED"
          ? "bg-muted-text"
          : status === "DELETING" || status === "DELETED"
            ? "bg-minus"
            : "bg-muted-text";
  return <span className={cn("inline-block h-2.5 w-2.5", color)} />;
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-2 px-2 py-0.5 text-[10px] uppercase tracking-label font-bold text-muted-text",
        className,
      )}
    >
      {children}
    </span>
  );
}
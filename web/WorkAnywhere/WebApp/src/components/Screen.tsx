import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Screen({
  children,
  className,
  bodyClassName,
  header,
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  header?: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        "mx-auto min-h-dvh w-full max-w-md flex flex-col safe-pad-top",
        className,
      )}
    >
      {header && <header className="px-4 pb-2">{header}</header>}
      <main className={cn("flex-1 px-4 pb-24", bodyClassName)}>{children}</main>
    </div>
  );
}
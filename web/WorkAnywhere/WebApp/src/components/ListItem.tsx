import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronRight } from "lucide-react";

interface ListItemProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  onClick?: () => void;
  className?: string;
  chevron?: boolean;
}

export function ListItem({ icon, title, subtitle, onClick, className, chevron = true }: ListItemProps): JSX.Element {
  const content = (
    <>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{title}</div>
        {subtitle && <div className="text-xs uppercase tracking-label text-muted-text truncate">{subtitle}</div>}
      </div>
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-text" strokeWidth={2} />}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg", className)}
      >
        {content}
      </button>
    );
  }

  return <div className={cn("flex w-full items-center gap-3 px-4 py-3", className)}>{content}</div>;
}

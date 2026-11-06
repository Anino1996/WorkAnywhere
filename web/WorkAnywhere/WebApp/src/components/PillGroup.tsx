import { cn } from "@/lib/cn";

interface PillGroupProps<T extends string> {
  options: readonly { value: T; label: string; descriptor?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  className,
}: PillGroupProps<T>): JSX.Element {
  return (
    <div className={cn("flex border-2 brutal-border bg-muted", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs uppercase tracking-label font-bold transition",
              i !== 0 && "border-l-2 border-border",
              active
                ? "bg-accent text-black"
                : "text-muted-text hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
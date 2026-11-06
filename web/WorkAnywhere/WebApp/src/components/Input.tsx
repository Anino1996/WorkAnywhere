import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full bg-muted brutal-border px-4 py-3 text-sm text-fg placeholder:text-muted-text/70 focus:outline-none focus:border-accent focus:ring-0",
          className,
        )}
        {...rest}
      />
    );
  },
);
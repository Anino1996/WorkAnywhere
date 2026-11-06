import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: "bottom" | "modal" | "full";
  labelledBy?: string;
}

import { cn } from "@/lib/cn";

export function Sheet({ open, onClose, children, variant = "bottom", labelledBy }: SheetProps): JSX.Element {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/70 z-10"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={
              variant === "bottom"
                ? { y: "100%" }
                : variant === "modal"
                  ? { scale: 0.96, opacity: 0 }
                  : { y: "100%", opacity: 0 }
            }
            animate={
              variant === "bottom"
                ? { y: 0 }
                : variant === "modal"
                  ? { scale: 1, opacity: 1 }
                  : { y: 0, opacity: 1 }
            }
            exit={
              variant === "bottom"
                ? { y: "100%" }
                : variant === "modal"
                  ? { scale: 0.96, opacity: 0 }
                  : { y: "100%", opacity: 0 }
            }
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
             className={cn(
              variant === "bottom" &&
                "relative z-20 w-full max-w-md border-t-2 brutal-border-b bg-bg max-h-[80vh] overflow-y-auto",
              variant === "modal" &&
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md brutal-border bg-muted z-20",
              variant === "full" &&
                "absolute inset-0 bg-bg z-20",
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
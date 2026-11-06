// Operation polling hook. Mirrors the documented client-side convention:
// 500ms interval, stop on COMPLETED || FAILED, recommended 1-min client cap.

import { useEffect, useRef, useState } from "react";
import { getControlPlane } from "@/lib/api";
import type { Operation } from "@/lib/api/types";

const POLL_INTERVAL_MS = 500;
const CLIENT_TIMEOUT_MS = 60_000;

export interface PollState {
  operation: Operation | null;
  error: Error | null;
  done: boolean; // true after terminal status reached
}

export function useOperationPoll(
  operationId: string | null,
  onUpdate?: (op: Operation) => void,
): PollState {
  const [state, setState] = useState<PollState>({
    operation: null,
    error: null,
    done: false,
  });
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!operationId) return;
    let cancelled = false;
    let timerId: number | null = null;
    const stopAt = Date.now() + CLIENT_TIMEOUT_MS;

    const tick = async () => {
      if (cancelled) return;

      if (Date.now() > stopAt) {
        setState((s) => ({
          ...s,
          done: true,
          error: new Error("Polling timed out (client-side 60s cap)"),
        }));
        return;
      }

      try {
        const op = await getControlPlane().getOperation(operationId);

        if (cancelled) return;
        onUpdateRef.current?.(op);
        setState({ operation: op, error: null, done: op.status === "COMPLETED" || op.status === "FAILED" });

        if (op.status !== "COMPLETED" && op.status !== "FAILED") {
          timerId = window.setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setState({ operation: null, error: err as Error, done: true });
      }
    };

    void tick();
    return () => {
      cancelled = true;

      if (timerId != null) clearTimeout(timerId);
    };
  }, [operationId]);

  return state;
}
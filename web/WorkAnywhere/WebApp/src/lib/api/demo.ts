// Dev-only mock control for injecting failures/slowdowns into the mock
// backend. The Demo Controls panel writes here; the mock clients read here.
// All keys are temporary and live in sessionStorage so they reset on tab close.

import { create } from "zustand";

export interface DemoState {
  slowMs: number;
  nextApplyPreconditionFail: boolean;
  nextApplyPartialFailOnIndex: number | null; // 0-based FileEdit index
  forcePartialFailOnce: boolean;
  setSlow: (ms: number) => void;
  queuePreconditionFail: () => void;
  queuePartialFailOnIndex: (index: number | null) => void;
  consumePreconditionFail: () => boolean;
  consumePartialFail: () => boolean;
  reset: () => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  slowMs: 0,
  nextApplyPreconditionFail: false,
  nextApplyPartialFailOnIndex: null,
  forcePartialFailOnce: false,
  setSlow: (ms) => set({ slowMs: ms }),
  queuePreconditionFail: () => set({ nextApplyPreconditionFail: true }),
  queuePartialFailOnIndex: (index) => set({ nextApplyPartialFailOnIndex: index, forcePartialFailOnce: true }),
  consumePreconditionFail: () => {
    const v = get().nextApplyPreconditionFail;
    if (v) set({ nextApplyPreconditionFail: false });
    return v;
  },
  consumePartialFail: () => {
    const v = get().forcePartialFailOnce;
    if (v) set({ forcePartialFailOnce: false, nextApplyPartialFailOnIndex: null });
    return v;
  },
  reset: () =>
    set({
      slowMs: 0,
      nextApplyPreconditionFail: false,
      nextApplyPartialFailOnIndex: null,
      forcePartialFailOnce: false,
    }),
}));

export const demoDelay = async (ms: number = 0): Promise<void> => {
  const demo = useDemoStore.getState();
  const total = ms + demo.slowMs;
  if (total > 0) await new Promise((r) => setTimeout(r, total));
};
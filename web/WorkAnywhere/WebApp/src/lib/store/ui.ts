// UI state store. Holds the per-screen ephemeral: AI model selection, build
// sheet visibility, workspace info drawer visibility, currentChangset pointer.

import { create } from "zustand";

export type AiModel = "gpt-4" | "claude" | "gemini";

const MODEL_KEY = "caw.aiModel.v1";

export interface UIState {
  aiModel: AiModel;
  modelSelectorOpen: boolean;
  buildSheetOpen: boolean;
  workspaceDrawerOpen: boolean;
  activeWorkspaceId: string | null; // selection carried between Home → Chat/Files
  createOpen: boolean;
  setAiModel: (m: AiModel) => void;
  openModelSelector: () => void;
  closeModelSelector: () => void;
  openBuildSheet: () => void;
  closeBuildSheet: () => void;
  toggleWorkspaceDrawer: () => void;
  closeWorkspaceDrawer: () => void;
  setActiveWorkspace: (id: string | null) => void;
  openCreate: () => void;
  closeCreate: () => void;
}

function loadModel(): AiModel {
  try {
    const v = localStorage.getItem(MODEL_KEY) as AiModel | null;
    if (v === "gpt-4" || v === "claude" || v === "gemini") return v;
  } catch {}
  return "claude";
}

export const useUIStore = create<UIState>((set, get) => ({
  aiModel: loadModel(),
  modelSelectorOpen: false,
  buildSheetOpen: false,
  workspaceDrawerOpen: false,
  activeWorkspaceId: null,
  createOpen: false,
  setAiModel: (m) => {
    localStorage.setItem(MODEL_KEY, m);
    set({ aiModel: m });
  },
  openModelSelector: () => set({ modelSelectorOpen: true }),
  closeModelSelector: () => set({ modelSelectorOpen: false }),
  openBuildSheet: () => set({ buildSheetOpen: true }),
  closeBuildSheet: () => set({ buildSheetOpen: false }),
  toggleWorkspaceDrawer: () => set({ workspaceDrawerOpen: !get().workspaceDrawerOpen }),
  closeWorkspaceDrawer: () => set({ workspaceDrawerOpen: false }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
}));
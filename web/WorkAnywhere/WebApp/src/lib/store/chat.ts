// Chat store: per-workspace message thread + the currently-attached ChangeSet.

import { create } from "zustand";
import type { ChangeSet } from "@/lib/changeset/types";

export type Role = "user" | "ai";

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  changeSet?: ChangeSet; // attached when the AI returns proposed edits
  createdAt: number;
}

interface ChatState {
  messagesByWorkspace: Record<string, ChatMessage[]>;
  currentChangeSetByWorkspace: Record<string, ChangeSet | undefined>;
  addMessage: (ws: string, m: ChatMessage) => void;
  setCurrentChangeSet: (ws: string, cs: ChangeSet | undefined) => void;
  clear: (ws: string) => void;
}

const uid = () => `m_${Math.random().toString(36).slice(2, 10)}`;
export const makeMessage = (role: Role, text: string, changeSet?: ChangeSet): ChatMessage => ({
  id: uid(),
  role,
  text,
  changeSet,
  createdAt: Date.now(),
});

export const useChatStore = create<ChatState>((set) => ({
  messagesByWorkspace: {},
  currentChangeSetByWorkspace: {},
  addMessage: (ws, m) =>
    set((s) => ({
      messagesByWorkspace: {
        ...s.messagesByWorkspace,
        [ws]: [...(s.messagesByWorkspace[ws] ?? []), m],
      },
    })),
  setCurrentChangeSet: (ws, cs) =>
    set((s) => ({
      currentChangeSetByWorkspace: { ...s.currentChangeSetByWorkspace, [ws]: cs },
    })),
  clear: (ws) =>
    set((s) => {
      const m = { ...s.messagesByWorkspace };
      const ccs = { ...s.currentChangeSetByWorkspace };
      delete m[ws];
      delete ccs[ws];
      return { messagesByWorkspace: m, currentChangeSetByWorkspace: ccs };
    }),
}));
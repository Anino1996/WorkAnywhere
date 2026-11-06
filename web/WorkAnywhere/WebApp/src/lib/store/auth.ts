// Auth/session store. Buckets a single signed-in user. In mock mode, the demo
// account is auto-created on first load (auto-login UX confirmed with you).

import { create } from "zustand";

const SESSION_KEY = "caw.session.v1";

export interface Session {
  email: string;
  accountId: string;
}

export interface AuthState {
  session: Session | null;
  signIn: (email: string) => void;
  signOut: () => void;
  restore: () => void;
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);

    if (raw) return JSON.parse(raw) as Session;
  } catch {}

  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: load(),
  signIn: (email: string) => {
    const session: Session = {
      email,
      accountId: `acc_${email.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "demo"}`,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    set({ session });
  },
  signOut: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ session: null });
  },
  restore: () => set({ session: load() }),
}));

const DEMO_EMAIL = "alex@workanywhere.dev";

export function ensureDemoSession(): void {
  if (!useAuthStore.getState().session) {
    useAuthStore.getState().signIn(DEMO_EMAIL);
  }
}
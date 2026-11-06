import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ensureDemoSession, useAuthStore } from "@/lib/store/auth";

export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  // In mock mode, we auto-login the demo account so the UI is immediately playable.
  ensureDemoSession();
  const session = useAuthStore((s) => s.session);
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
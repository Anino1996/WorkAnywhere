// API factory. Picks the mock implementation by default; flips to HTTP when
// VITE_USE_MOCKS is "0". The HTTP clients are stubbed but typed against the
// documented JSON contract so the swap is purely a wiring change.

import type {
  ControlPlaneClient,
  DataPlaneClient,
} from "@/lib/api/types";
import { MockControlPlane } from "./mock/controlPlane";
import { MockDataPlane } from "./mock/dataPlane";

export { resetMockControlPlane } from "./mock/controlPlane";
export { resetMockDataPlane } from "./mock/dataPlane";

const useMocks = (import.meta.env.VITE_USE_MOCKS ?? "1") !== "0";

// Singleton control plane client (mock or HTTP).
let cp: ControlPlaneClient | null = null;
export function getControlPlane(): ControlPlaneClient {
  if (cp) return cp;

  if (useMocks) {
    cp = new MockControlPlane();
    return cp;
  }

  throw new Error(
    "HTTP ControlPlaneClient not yet implemented. Set VITE_USE_MOCKS=1 (default).",
  );
}

// Per-workspace data plane client. Caller passes the workspace_id; in mock mode
// this is enough. When the real HTTP client is implemented, callers will fetch
// the data_plane_url and data_plane_token from getWorkspace() first.
export function getDataPlane(workspaceId: string): DataPlaneClient {
  if (useMocks) {
    return new MockDataPlane(workspaceId);
  }

  throw new Error(
    "HTTP DataPlaneClient not yet implemented. Set VITE_USE_MOCKS=1 (default).",
  );
}

export const isMockMode = useMocks;
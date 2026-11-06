// Seed fixtures for the mock backend. Mirrors the JSON shapes documented in
// Architecture.md. Keep these deliberately small so localStorage stays light.

import type { Operation, OperationType, Workspace, WorkspaceStatus } from "@/lib/api/types";

const nowISO = (offsetSeconds: number = 0) =>
  new Date(Date.now() + offsetSeconds * 1000).toISOString();

export const seededWorkspaces: Workspace[] = [
  {
    workspace_id: "ws_demo_active",
    name: "Dev Server 1",
    status: "ACTIVE",
    created_at: "2026-06-20T09:14:22Z",
    last_active_at: nowISO(-120),
    data_plane_url: "https://workspace-ws_demo_active.data.local.dev",
    data_plane_token: "mock-jwt-and-not-a-real-token",
    data_plane_token_expires_at: nowISO(3600),
  },
  {
    workspace_id: "ws_demo_saved",
    name: "API Backend",
    status: "SAVED",
    created_at: "2026-05-30T16:00:00Z",
    last_active_at: nowISO(-4 * 3600),
  },
  {
    workspace_id: "ws_demo_building",
    name: "Portfolio Site",
    status: "PROVISIONING",
    created_at: "2026-04-15T11:00:00Z",
    last_active_at: nowISO(-30),
  },
];

// Seeded data-plane filesystem for the ACTIVE workspace.
export interface SeedFile {
  path: string;
  content: string;
  modified_at: string;
}

export const seedFs: SeedFile[] = [
  {
    path: "README.md",
    content:
      "# Dev Server 1\n\nA demo workspace. Connect to the workspace agent at /.workanywhere/agent.\n",
    modified_at: "2026-06-20T09:14:30Z",
  },
  {
    path: "app.py",
    content:
      "from auth import authenticate\n\n\ndef app():\n    user = current_user()\n    token = authenticate(user)\n    return {'token': token}\n\n\nif __name__ == '__main__':\n    print(app())\n",
    modified_at: "2026-06-20T09:14:30Z",
  },
  {
    path: "auth.py",
    content:
      "def authenticate(user):\n    return user.token\n\n\ndef revoke(user):\n    user.token = None\n    return True\n",
    modified_at: "2026-06-20T09:14:30Z",
  },
  {
    path: "requirements.txt",
    content: "fastapi==0.110.0\nuvicorn[standard]>=0.29.0\nrequests>=2.31\n",
    modified_at: "2026-06-20T09:14:30Z",
  },
  {
    path: "tests/__init__.py",
    content: "",
    modified_at: "2026-06-20T09:14:30Z",
  },
  {
    path: "tests/test_smoke.py",
    content:
      "from app import app\n\n\ndef test_app_returns_token():\n    assert app()['token'] == 'mock-token'\n",
    modified_at: "2026-06-20T09:14:30Z",
  },
];

export const initialOperationsFor = (workspace_id: string): Operation[] => [
  {
    operation_id: "op_seed_001",
    type: "PROVISION" as OperationType,
    status: "COMPLETED",
    workspace_id,
    started_at: "2026-06-20T09:14:22Z",
    completed_at: "2026-06-20T09:15:30Z",
    error: null,
  },
];

export const anyStatus = (): WorkspaceStatus | undefined => undefined;
// In-browser mock Control Plane. Implements ControlPlaneClient with the
// documented JSON contract. State persists to localStorage (keyed by the demo
// account) and async operations advance on timers so the polling loop in the
// UI is exercised against real transitions (PROVISIONING → ACTIVE, etc.).

import type {
  ControlPlaneClient,
  CreateWorkspaceInput,
  CreateWorkspaceResponse,
  ListOperationsParams,
  ListOperationsResponse,
  ListWorkspacesParams,
  ListWorkspacesResponse,
  Operation,
  OperationResponse,
  OperationStatus,
  OperationType,
  SaveWorkspaceInput,
  Workspace,
  WorkspaceStatus,
} from "@/lib/api/types";
import { ApiCallError } from "@/lib/api/types";
import { seededWorkspaces } from "./fixtures";
import { demoDelay } from "../demo";

const STORAGE_KEY = "caw.mock.cp.v1";

interface Stored {
  workspaces: Workspace[];
  operations: Operation[];
  // In-flight op timers are not persisted; pending transitions across reloads
  // are simply advanced by the elapsed time on next fetch.
  startedAt: number; // ms epoch, baseline for op duration accounting
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {}
  return { workspaces: seededWorkspaces, operations: [], startedAt: Date.now() };
}

function save(s: Stored) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let state: Stored = load();

const iso = (d: Date) => d.toISOString();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

function failureExpected(code: string, message: string): ApiCallError {
  return new ApiCallError(
    { code, message, request_id: uid("req") },
    code === "WORKSPACE_NOT_FOUND" ? 404 : 500,
  );
}

// Op completion durations (ms) per op type.
const OP_DURATIONS: Record<OperationType, number> = {
  PROVISION: 1500,
  SAVE: 1200,
  RESUME: 1200,
  DELETE: 800,
};

// Workspace status transitions on op completion.
const STATUS_AFTER_OP: Record<OperationType, WorkspaceStatus> = {
  PROVISION: "ACTIVE",
  SAVE: "SAVED",
  RESUME: "ACTIVE",
  DELETE: "DELETED",
};

function scheduleOperation(
  workspace_id: string,
  type: OperationType,
  pendingStatus: WorkspaceStatus,
  startedAt: Date,
): string {
  const op_id = uid("op");
  state.workspaces = state.workspaces.map((w) =>
    w.workspace_id === workspace_id ? { ...w, status: pendingStatus } : w,
  );
  state.operations = [
    {
      operation_id: op_id,
      type,
      status: "IN_PROGRESS",
      workspace_id,
      started_at: iso(startedAt),
      completed_at: null,
      error: null,
    },
    ...state.operations,
  ];
  save(state);
  const dur = OP_DURATIONS[type];
  setTimeout(() => {
    const s = load();
    s.operations = s.operations.map((o) =>
      o.operation_id === op_id
        ? { ...o, status: "COMPLETED" as OperationStatus, completed_at: iso(new Date()) }
        : o,
    );
    const targetWs = STATUS_AFTER_OP[type];
    s.workspaces = s.workspaces.map((w) =>
      w.workspace_id === workspace_id
        ? {
            ...w,
            status: targetWs,
            data_plane_url:
              targetWs === "ACTIVE"
                ? `https://workspace-${workspace_id}.data.local.dev`
                : undefined,
            data_plane_token: targetWs === "ACTIVE" ? "mock-jwt-and-not-a-real-token" : undefined,
            data_plane_token_expires_at:
              targetWs === "ACTIVE" ? iso(new Date(Date.now() + 3600_000)) : undefined,
            last_active_at: targetWs === "ACTIVE" ? iso(new Date()) : w.last_active_at,
          }
        : w,
    );
    save(s);
    state = s;
  }, dur);
  return op_id;
}

export class MockControlPlane implements ControlPlaneClient {
  async listWorkspaces(params?: ListWorkspacesParams): Promise<ListWorkspacesResponse> {
    await demoDelay(80);
    let ws = [...state.workspaces];
    if (params?.status) ws = ws.filter((w) => w.status === params.status);
    const limit = params?.limit ?? 20;
    const start =
      params?.cursor != null
        ? ws.findIndex((w) => w.workspace_id === params.cursor)
        : -1;
    const fromIndex = start >= 0 ? start + 1 : 0;
    const slice = ws.slice(fromIndex, fromIndex + limit);
    const next_cursor =
      fromIndex + limit < ws.length ? ws[fromIndex + limit]?.workspace_id ?? null : null;
    return { workspaces: slice, next_cursor };
  }

  async getWorkspace(id: string): Promise<Workspace> {
    await demoDelay(60);
    const w = state.workspaces.find((x) => x.workspace_id === id);
    if (!w) throw failureExpected("WORKSPACE_NOT_FOUND", `No workspace found with id ${id}`);
    return { ...w };
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResponse> {
    await demoDelay(120);
    const ws: Workspace = {
      workspace_id: uid("ws"),
      name: input.name,
      status: "PROVISIONING",
      created_at: iso(new Date()),
      last_active_at: iso(new Date()),
    };
    state.workspaces = [ws, ...state.workspaces];
    save(state);
    const op_id = scheduleOperation(ws.workspace_id, "PROVISION", "PROVISIONING", new Date());
    return {
      workspace_id: ws.workspace_id,
      status: "PROVISIONING",
      operation_id: op_id,
      created_at: ws.created_at,
    };
  }

  async saveWorkspace(id: string, _input: SaveWorkspaceInput): Promise<OperationResponse> {
    await demoDelay(120);
    const w = state.workspaces.find((x) => x.workspace_id === id);
    if (!w) throw failureExpected("WORKSPACE_NOT_FOUND", `No workspace found with id ${id}`);
    if (w.status !== "ACTIVE") {
      throw new ApiCallError(
        { code: "WRONG_STATE", message: `Workspace must be ACTIVE to save (was ${w.status})`, request_id: uid("req") },
        422,
      );
    }
    const op_id = scheduleOperation(id, "SAVE", "SAVING", new Date());
    return { workspace_id: id, status: "SAVING", operation_id: op_id };
  }

  async resumeWorkspace(id: string): Promise<OperationResponse> {
    await demoDelay(120);
    const w = state.workspaces.find((x) => x.workspace_id === id);
    if (!w) throw failureExpected("WORKSPACE_NOT_FOUND", `No workspace found with id ${id}`);
    if (w.status !== "SAVED") {
      throw new ApiCallError(
        { code: "WRONG_STATE", message: `Workspace must be SAVED to resume (was ${w.status})`, request_id: uid("req") },
        422,
      );
    }
    const op_id = scheduleOperation(id, "RESUME", "RESUMING", new Date());
    return { workspace_id: id, status: "RESUMING", operation_id: op_id };
  }

  async deleteWorkspace(id: string, force?: boolean): Promise<OperationResponse> {
    await demoDelay(120);
    const w = state.workspaces.find((x) => x.workspace_id === id);
    if (!w) throw failureExpected("WORKSPACE_NOT_FOUND", `No workspace found with id ${id}`);
    if (w.status === "ACTIVE" && !force) {
      throw new ApiCallError(
        { code: "WORKSPACE_ACTIVE", message: "Workspace is ACTIVE; pass force=true to delete", request_id: uid("req") },
        422,
      );
    }
    const op_id = scheduleOperation(id, "DELETE", "DELETING", new Date());
    return { workspace_id: id, status: "DELETING", operation_id: op_id };
  }

  async getOperation(id: string): Promise<Operation> {
    await demoDelay(40);
    const o = state.operations.find((x) => x.operation_id === id);
    if (!o) throw failureExpected("OPERATION_NOT_FOUND", `No operation found with id ${id}`);
    return { ...o };
  }

  async listOperations(params?: ListOperationsParams): Promise<ListOperationsResponse> {
    await demoDelay(80);
    let ops = [...state.operations];
    if (params?.workspace_id) ops = ops.filter((o) => o.workspace_id === params.workspace_id);
    if (params?.status) ops = ops.filter((o) => o.status === params.status);
    const limit = params?.limit ?? 20;
    return { operations: ops.slice(0, limit) };
  }

  // ---- Demo-only helpers (not part of the interface) ----
  resetToSeed() {
    state = { workspaces: seededWorkspaces, operations: [], startedAt: Date.now() };
    save(state);
  }
}

export function resetMockControlPlane(): void {
  localStorage.removeItem(STORAGE_KEY);
  state = load();
}
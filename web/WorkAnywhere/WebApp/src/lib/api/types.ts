// API contract types — mirror the documented JSON shapes from Architecture.md.
// Used both by the mock client and the (future) real HTTP client.

export type WorkspaceStatus =
  | "PROVISIONING"
  | "ACTIVE"
  | "SAVING"
  | "SAVED"
  | "RESUMING"
  | "DELETING"
  | "DELETED";

export type OperationType = "PROVISION" | "SAVE" | "RESUME" | "DELETE";
export type OperationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface Workspace {
  workspace_id: string;
  name: string;
  status: WorkspaceStatus;
  created_at: string;
  last_active_at: string;
  data_plane_url?: string;
  data_plane_token?: string;
  data_plane_token_expires_at?: string;
}

export interface Operation {
  operation_id: string;
  type: OperationType;
  status: OperationStatus;
  workspace_id: string;
  started_at: string;
  completed_at: string | null;
  error: OperationError | null;
}

export interface OperationError {
  code: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  request_id: string;
}

export class ApiCallError extends Error {
  constructor(public readonly detail: ApiError, public readonly status: number) {
    super(detail.message);
    this.name = "ApiCallError";
  }
}

export interface ListWorkspacesParams {
  status?: WorkspaceStatus;
  limit?: number;
  cursor?: string;
}

export interface ListWorkspacesResponse {
  workspaces: Workspace[];
  next_cursor: string | null;
}

export interface CreateWorkspaceInput {
  name: string;
}

export interface CreateWorkspaceResponse {
  workspace_id: string;
  status: WorkspaceStatus;
  operation_id: string;
  created_at: string;
}

export interface SaveWorkspaceInput {
  note?: string;
}

export interface OperationResponse {
  workspace_id: string;
  status: WorkspaceStatus;
  operation_id: string;
}

export interface ListOperationsParams {
  workspace_id?: string;
  status?: OperationStatus;
  limit?: number;
}

export interface ListOperationsResponse {
  operations: Operation[];
}

// ---- Data plane ----

export interface DirEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modified_at: string;
}

export interface FileRead {
  content: Uint8Array;
  etag: string;
  contentType: "text" | "binary";
}

export interface FileWriteResult {
  etag: string;
  created: boolean;
}

export interface ControlPlaneClient {
  listWorkspaces(params?: ListWorkspacesParams): Promise<ListWorkspacesResponse>;
  getWorkspace(id: string): Promise<Workspace>;
  createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResponse>;
  saveWorkspace(id: string, input: SaveWorkspaceInput): Promise<OperationResponse>;
  resumeWorkspace(id: string): Promise<OperationResponse>;
  deleteWorkspace(id: string, force?: boolean): Promise<OperationResponse>;
  getOperation(id: string): Promise<Operation>;
  listOperations(params?: ListOperationsParams): Promise<ListOperationsResponse>;
}

export interface DataPlaneClient {
  getFile(path: string): Promise<FileRead>;
  putFile(path: string, content: Uint8Array, ifMatch?: string): Promise<FileWriteResult>;
  deleteFile(path: string): Promise<void>;
  listDir(path: string): Promise<DirEntry[]>;
}
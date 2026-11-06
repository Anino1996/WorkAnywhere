// React Query-backed hook for listing workspaces. Uses the typed
// ControlPlaneClient from the API factory so swapping mock ↔ HTTP needs no
// changes here.

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { getControlPlane } from "@/lib/api";
import type { ListWorkspacesParams, ListWorkspacesResponse, Workspace } from "@/lib/api/types";

export function useWorkspaces(params?: ListWorkspacesParams): UseQueryResult<ListWorkspacesResponse> {
  return useQuery({
    queryKey: ["workspaces", params ?? {}],
    queryFn: async () => {
      return getControlPlane().listWorkspaces(params);
    },
    refetchInterval: (q) => {
      // Re-poll more aggressively when any workspace is mid-transition.
      const data = q.state.data;

      if (!data) return 2000;
      const busy = data.workspaces.some((w) =>
        ["PROVISIONING", "SAVING", "RESUMING", "DELETING"].includes(w.status),
      );
      return busy ? 1500 : 8000;
    },
  });
}

export function useWorkspace(id: string | null): UseQueryResult<Workspace> {
  return useQuery({
    queryKey: ["workspace", id],
    queryFn: async () => {
      if (!id) throw new Error("workspace id required");
      return getControlPlane().getWorkspace(id);
    },
    enabled: id != null,
    refetchInterval: (q) => {
      const data = q.state.data;

      if (!data) return 1000;
      return ["PROVISIONING", "SAVING", "RESUMING", "DELETING"].includes(data.status)
        ? 1000
        : 15000;
    },
  });
}
// Files-hooks: list a directory, read a single file from the data plane.

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { getDataPlane } from "@/lib/api";
import type { DirEntry, FileRead } from "@/lib/api/types";

export function useDirListing(workspaceId: string | null, path: string): UseQueryResult<DirEntry[]> {
  return useQuery({
    queryKey: ["dir", workspaceId, path],
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspace required");
      return getDataPlane(workspaceId).listDir(path);
    },
    enabled: workspaceId != null,
  });
}

export function useFile(workspaceId: string | null, path: string | null): UseQueryResult<FileRead> {
  return useQuery({
    queryKey: ["file", workspaceId, path],
    queryFn: async () => {
      if (!workspaceId || !path) throw new Error("workspace + path required");
      return getDataPlane(workspaceId).getFile(path);
    },
    enabled: workspaceId != null && path != null,
  });
}
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Screen } from "@/components/Screen";
import { WorkspaceBar } from "@/components/WorkspaceBar";
import { WorkspaceInfoDrawer } from "@/features/chat/WorkspaceInfoDrawer";
import { useDirListing, useFile } from "@/lib/hooks/useFiles";
import { useUIStore } from "@/lib/store/ui";
import type { DirEntry } from "@/lib/api/types";
import { Folder, File as FileIcon, ChevronRight, ArrowLeft, FilePlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/Card";
import { ListItem } from "@/components/ListItem";

export function FilesScreen(): JSX.Element {
  const [params] = useSearchParams();
  const wsId = params.get("ws") ?? useUIStore.getState().activeWorkspaceId ?? "";
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace);

  if (wsId) setActiveWorkspace(wsId);
  const [path, setPath] = useState("");
  const listing = useDirListing(wsId, path);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const segments = path === "" ? [] : path.split("/");

  return (
    <Screen
      header={
        <div className="pt-1">
          <WorkspaceBar workspaceId={wsId} />
        </div>
      }
    >
      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold uppercase tracking-label">Files</h1>
        <button className="flex h-9 w-9 items-center justify-center border-2 brutal-border-accent bg-accent text-black transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brutal-shadow-sm">
          <FilePlus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="mb-3 mt-3 flex items-center gap-1 overflow-x-auto border-b-2 brutal-border pb-2 text-xs uppercase tracking-label text-muted-text">
        <button
          onClick={() => {
            setPath("");
            setSelectedFile(null);
          }}
          className={cn(path === "" && "text-fg")}
        >
          root
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
            <button
              onClick={() => {
                setPath(segments.slice(0, i + 1).join("/"));
                setSelectedFile(null);
              }}
              className={cn(i === segments.length - 1 && "text-fg")}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      {selectedFile ? (
        <FileViewer
          workspaceId={wsId}
          path={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      ) : (
        <FileList
          entries={listing.data ?? []}
          loading={listing.isLoading}
          onOpen={(e) => {
            const child = path ? `${path}/${e.name}` : e.name;

            if (e.type === "directory") {
              setPath(child);
              setSelectedFile(null);
            } else {
              setSelectedFile(child);
            }
          }}
        />
      )}

      <WorkspaceInfoDrawer workspaceId={wsId} />
    </Screen>
  );
}

function FileList({
  entries,
  loading,
  onOpen,
}: {
  entries: DirEntry[];
  loading: boolean;
  onOpen: (e: DirEntry) => void;
}) {
  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse border-b-2 brutal-border bg-muted" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center text-center text-sm uppercase tracking-label text-muted-text">
        <Folder className="mb-2 h-8 w-8 opacity-40" strokeWidth={1.5} />
        Empty folder.
      </div>
    );
  }

  return (
    <Card className="divide-y-2 divide-border">
      {entries.map((e) => (
        <ListItem
          key={e.name}
          icon={
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center border-2",
                e.type === "directory"
                  ? "brutal-border-accent bg-accent text-black"
                  : "brutal-border bg-muted text-fg",
              )}
            >
              {e.type === "directory" ? (
                <Folder className="h-4 w-4" strokeWidth={2} />
              ) : (
                <FileIcon className="h-4 w-4" strokeWidth={2} />
              )}
            </div>
          }
          title={<span className="font-mono">{e.name}</span>}
          subtitle={`${e.type === "directory" ? `${e.size} items` : formatSize(e.size)} · ${new Date(e.modified_at).toLocaleString()}`}
          onClick={() => onOpen(e)}
        />
      ))}
    </Card>
  );
}

function FileViewer({
  workspaceId,
  path,
  onClose,
}: {
  workspaceId: string;
  path: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useFile(workspaceId, path);
  const text =
    data?.contentType === "text" && data
      ? new TextDecoder("utf-8", { fatal: false }).decode(data.content)
      : "";

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm uppercase tracking-label font-bold text-muted-text hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Back
        </button>
        <span className="font-mono text-xs text-muted-text">{path}</span>
      </div>
      <div className="border-2 brutal-border bg-bg">
        {isLoading ? (
          <div className="min-h-[200px] animate-pulse p-4" />
        ) : error ? (
          <div className="p-4 text-sm text-minus">{(error as Error).message}</div>
        ) : data?.contentType === "binary" ? (
          <div className="p-4 text-sm uppercase tracking-label text-muted-text">
            Binary file · {data.content.length} bytes · preview not supported
          </div>
        ) : (
          <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
            <code className="font-mono">{text}</code>
          </pre>
        )}
      </div>
      <div className="text-[11px] uppercase tracking-label text-muted-text">
        ETag: <span className="font-mono">{truncate(data?.etag)}</span>
      </div>
    </div>
  );
}

function truncate(s?: string) {
  if (!s) return "—";
  return s.length > 22 ? `${s.slice(0, 22)}…` : s;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Home, FolderTree, MessageSquare, Settings } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/files", label: "Files", icon: FolderTree, end: false },
  { to: "/chat", label: "Chat", icon: MessageSquare, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

export function TabBar(): JSX.Element {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t-2 brutal-border bg-bg safe-pad-bottom-0">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-4">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-label font-bold transition",
                  i !== 0 && "border-l-2 border-border",
                  isActive ? "bg-accent text-black" : "text-muted-text hover:text-fg",
                )
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
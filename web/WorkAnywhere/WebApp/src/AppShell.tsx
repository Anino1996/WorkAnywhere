import { Outlet } from "react-router-dom";
import { TabBar } from "@/components/TabBar";
import { ModelSelectionModal } from "@/features/home/ModelSelectionModal";
import { BuildRunTestSheet } from "@/features/chat/BuildRunTestSheet";

export function AppShell(): JSX.Element {
  return (
    <div className="min-h-dvh bg-bg">
      <Outlet />
      <TabBar />
      <ModelSelectionModal />
      <BuildRunTestSheet />
    </div>
  );
}
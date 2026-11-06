import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/AppShell";
import { HomeScreen } from "@/features/home/HomeScreen";
import { ChatScreen } from "@/features/chat/ChatScreen";
import { FilesScreen } from "@/features/files/FilesScreen";
import { DiffsScreen } from "@/features/diff/DiffsScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { LoginForm } from "@/features/auth/LoginForm";
import { RequireAuth } from "@/features/auth/RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginForm />,
  },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { path: "/", element: <HomeScreen /> },
      { path: "/chat", element: <ChatScreen /> },
      { path: "/files", element: <FilesScreen /> },
      { path: "/diffs", element: <DiffsScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
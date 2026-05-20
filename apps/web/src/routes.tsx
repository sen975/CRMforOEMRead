import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmailCenterPage } from "./pages/EmailCenterPage";
import { FollowUpsPage } from "./pages/FollowUpsPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { LoginPage } from "./pages/LoginPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/new", element: <CustomersPage mode="create" /> },
      { path: "customers/:id/:tab?", element: <CustomerDetailPage /> },
      { path: "email-center/:folder?", element: <EmailCenterPage /> },
      { path: "follow-ups", element: <FollowUpsPage /> },
      { path: "knowledge/:section?", element: <KnowledgeBasePage /> },
      { path: "reports/:scope?", element: <ReportsPage /> },
      { path: "settings/:section?", element: <SettingsPage /> }
    ]
  }
]);


import { Navigate, NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  Mail,
  Settings,
  UsersRound
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "工作台", icon: BarChart3 },
  { to: "/customers", label: "客户开发", icon: Building2 },
  { to: "/email-center/inbox", label: "邮件中心", icon: Mail },
  { to: "/follow-ups", label: "跟进任务", icon: ClipboardCheck },
  { to: "/knowledge/company", label: "企业资料库", icon: BookOpen },
  { to: "/reports/management", label: "数据看板", icon: UsersRound },
  { to: "/settings/users", label: "系统设置", icon: Settings }
];

export function AppShell() {
  if (!localStorage.getItem("accessToken")) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">OEM</div>
          <div>
            <strong>客户开发CRM</strong>
            <span>外贸开发闭环</span>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="workspace">
        <Outlet />
      </main>
    </div>
  );
}

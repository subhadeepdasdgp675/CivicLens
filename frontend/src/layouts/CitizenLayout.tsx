import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import {
  Home, PlusCircle, Search, User, Bell, LogOut, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: Home, label: "Dashboard", end: true },
  { to: "/dashboard/report", icon: PlusCircle, label: "Report Issue" },
  { to: "/dashboard/search", icon: Search, label: "Search" },
  { to: "/dashboard/profile", icon: User, label: "Profile" },
];

const CitizenLayout = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="civic-container flex h-16 items-center justify-between">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">CL</span>
            </div>
            <span className="text-lg font-semibold text-foreground">Civic Lens</span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-caption font-medium transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NavLink to="/dashboard/notifications" className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </NavLink>
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-caption text-muted-foreground">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
            </div>
            <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t bg-card px-6 pb-4 pt-2 md:hidden">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-2.5 text-body", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <div className="mt-3 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2"><LogOut className="h-4 w-4" /> Sign Out</Button>
            </div>
          </div>
        )}
      </header>
      <main><Outlet /></main>
    </div>
  );
};

export default CitizenLayout;

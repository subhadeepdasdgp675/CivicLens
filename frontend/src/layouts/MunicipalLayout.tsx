import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { useMunicipalCity } from "@/contexts/MunicipalCityContext";
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  FileDown,
  Sparkles,
  Layers,
  Bell,
  LogOut,
  Menu,
  X,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { civicLens } from "@/lib/api";

const MunicipalLayout = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useSocket();
  const { selectedCity, setSelectedCity, availableCities } = useMunicipalCity();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");

  // Real-time database-backed pending reviews count for the active city
  const { data: queueData } = useQuery({
    queryKey: ["civiclens-review-queue-count", selectedCity],
    queryFn: () => civicLens.getReviewQueue({ status: "PENDING", cityName: selectedCity, limit: 1 }),
    refetchInterval: 15000,
  });

  const pendingReviewCount = queueData?.metrics?.pendingReviewItems ?? queueData?.totalCount ?? 0;

  const filteredCities = availableCities
    .filter((c) => c.toLowerCase().includes(citySearchQuery.toLowerCase()))
    .slice(0, 30);

  const navItems = [
    { to: "/municipal", label: "Overview", end: true },
    { to: "/municipal/intelligence", label: "Incident Intelligence" },
    { to: "/municipal/departments", label: "Departments" },
    { to: "/municipal/escalations", label: "Escalations" },
    { to: "/municipal/reports", label: "Reports" },
    {
      to: "/municipal/civiclens",
      label: "Review Queue",
      badgeCount: pendingReviewCount,
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 shrink-0">
            <NavLink to="/municipal" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-xs font-bold text-primary-foreground tracking-tight">CL</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground leading-tight">Civic Lens</span>
                <span className="text-[10px] text-muted-foreground leading-tight font-medium">Municipal Panel</span>
              </div>
            </NavLink>

            {/* Global City Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCitySelectorOpen(!citySelectorOpen)}
                className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary/10 hover:border-primary/40"
                title="Switch active city"
              >
                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                <span className="max-w-[100px] truncate">{selectedCity}</span>
                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
              </button>

              {citySelectorOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCitySelectorOpen(false)}
                  />
                  <div className="absolute left-0 mt-2 z-50 w-64 rounded-xl border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
                    <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Switch Real-Time City
                    </p>
                    <input
                      type="text"
                      placeholder="Type city name..."
                      value={citySearchQuery}
                      onChange={(e) => setCitySearchQuery(e.target.value)}
                      className="mb-2 w-full rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {filteredCities.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setSelectedCity(city);
                            setCitySelectorOpen(false);
                            setCitySearchQuery("");
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors text-left",
                            city === selectedCity
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span>{city}</span>
                          {city === selectedCity && <span className="text-[10px]">Active</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors relative flex items-center",
                    isActive
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <span>{item.label}</span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <NavLink
              to="/municipal/notifications"
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute 1 top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </NavLink>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex h-8 px-2 text-xs text-muted-foreground hover:text-foreground" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
            <button className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t bg-card px-6 pb-4 pt-2 md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                    isActive ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground"
                  )
                }
              >
                <span>{item.label}</span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-bold text-primary">
                    {item.badgeCount}
                  </span>
                )}
              </NavLink>
            ))}
            <div className="mt-3 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2">
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default MunicipalLayout;

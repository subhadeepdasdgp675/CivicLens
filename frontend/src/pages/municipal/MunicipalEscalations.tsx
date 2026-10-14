import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { municipal as municipalApi, issues as issuesApi, type ApiEscalation, type ApiIssue } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, MapPin, Clock, Building2, Calendar, Search, Loader2, Users, Flame, Timer, TrendingUp, ShieldAlert } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import IssueMap from "@/components/IssueMap";
import type { Issue } from "@/types";

const DEPT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

import { useMunicipalCity } from "@/contexts/MunicipalCityContext";

const MunicipalEscalations = () => {
  const { user } = useAuth();
  const { selectedCity } = useMunicipalCity();
  const [escalations, setEscalations] = useState<ApiEscalation[]>([]);
  const [allIssues, setAllIssues] = useState<ApiIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      municipalApi.escalations({ cityName: selectedCity }),
      issuesApi.list({ search: selectedCity, limit: "200" }),
    ])
      .then(([escRes, issRes]) => {
        setEscalations(escRes.escalations);
        setAllIssues(issRes.issues);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCity]);

  const allDepts = useMemo(() => ["All Departments", ...new Set(escalations.map((e) => e.department.name))], [escalations]);

  const filtered = useMemo(() => escalations.filter((e) => {
    const primary = e.issuePosts[0];
    const matchDept = deptFilter === "All Departments" || e.department.name === deptFilter;
    const matchSearch = !searchQuery || primary?.title.toLowerCase().includes(searchQuery.toLowerCase()) || primary?.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  }), [escalations, deptFilter, searchQuery]);

  // Map issues: only escalated ones
  const escalatedIssues = useMemo<Issue[]>(() => {
    return allIssues
      .filter((i) => i.status === "Escalated")
      .map((i) => ({ id: i.id, title: i.title, description: i.description, category: i.category, location: i.location, lat: i.lat, lng: i.lng, image: i.image, status: i.status, reporters: i.reporters, createdAt: i.createdAt, updatedAt: i.updatedAt }));
  }, [allIssues]);

  // Dept breakdown for charts
  const deptBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    escalations.forEach((e) => map.set(e.department.name, (map.get(e.department.name) || 0) + 1));
    return Array.from(map, ([name, value], i) => ({ name, value, color: DEPT_COLORS[i % DEPT_COLORS.length] }));
  }, [escalations]);

  // Overdue stats
  const overdueStats = useMemo(() => {
    let critical = 0, high = 0, medium = 0;
    escalations.forEach((e) => {
      const days = e.escalatedAt ? Math.floor((Date.now() - new Date(e.escalatedAt).getTime()) / 86400000) : 0;
      if (days > 14) critical++;
      else if (days > 7) high++;
      else medium++;
    });
    return { critical, high, medium };
  }, [escalations]);

  // Avg overdue days
  const avgOverdueDays = useMemo(() => {
    if (!escalations.length) return 0;
    const total = escalations.reduce((sum, e) => {
      return sum + (e.escalatedAt ? Math.floor((Date.now() - new Date(e.escalatedAt).getTime()) / 86400000) : 0);
    }, 0);
    return Math.round(total / escalations.length);
  }, [escalations]);

  // Timeline: escalations by week
  const weeklyData = useMemo(() => {
    const weeks: Record<string, number> = {};
    const now = Date.now();
    for (let w = 3; w >= 0; w--) {
      const start = now - (w + 1) * 7 * 86400000;
      const end = now - w * 7 * 86400000;
      const label = `Week ${4 - w}`;
      weeks[label] = escalations.filter((e) => {
        const t = new Date(e.escalatedAt || e.createdAt).getTime();
        return t >= start && t < end;
      }).length;
    }
    return Object.entries(weeks).map(([week, count]) => ({ week, count }));
  }, [escalations]);

  const getOverdueLabel = (dateStr?: string | null) => {
    if (!dateStr) return "Escalated";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days <= 0) return "Today";
    return `${days}d overdue`;
  };

  const getSeverity = (dateStr?: string | null) => {
    if (!dateStr) return "medium";
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days > 14) return "critical";
    if (days > 7) return "high";
    return "medium";
  };

  const severityStyles: Record<string, string> = {
    critical: "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };

  const borderStyles: Record<string, string> = {
    critical: "border-l-destructive",
    high: "border-l-orange-500",
    medium: "border-l-amber-400",
  };

  if (loading) {
    return <div className="civic-container civic-section flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const kpis = [
    { label: "Total Escalated", value: escalations.length, icon: AlertTriangle, iconColor: "text-destructive", bgColor: "bg-destructive/10" },
    { label: "Critical (14d+)", value: overdueStats.critical, icon: Flame, iconColor: "text-destructive", bgColor: "bg-destructive/10" },
    { label: "High Priority (7d+)", value: overdueStats.high, icon: ShieldAlert, iconColor: "text-orange-500", bgColor: "bg-orange-500/10" },
    { label: "Avg. Overdue", value: `${avgOverdueDays}d`, icon: Timer, iconColor: "text-amber-500", bgColor: "bg-amber-500/10" },
  ];

  return (
    <div className="civic-container civic-section space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Escalation Management</h1>
          <p className="text-body text-muted-foreground">Monitor and resolve issues exceeding the 7-day resolution window</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-destructive/5 px-4 py-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-body font-semibold text-destructive">{escalations.length} Active Escalations</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.bgColor}`}>
                <k.icon className={`h-5 w-5 ${k.iconColor}`} />
              </div>
            </div>
            <p className="text-h2 font-bold text-foreground">{k.value}</p>
            <p className="text-caption text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Map: Escalated Issues */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b p-5">
          <h3 className="text-body-lg font-semibold text-foreground">Escalated Issues Map</h3>
          <p className="text-caption text-muted-foreground mt-1">Red markers indicate escalated issues across the city</p>
        </div>
        <IssueMap
          issues={escalatedIssues}
          height="h-80"
          colorFn={() => "#ef4444"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dept Breakdown Pie */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-body-lg font-semibold text-foreground">By Department</h3>
          {deptBreakdown.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="h-48 w-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deptBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={75} strokeWidth={2} stroke="hsl(var(--card))">
                      {deptBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} issues`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {deptBreakdown.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-caption">
                    <div className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="ml-auto font-semibold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-caption text-muted-foreground">No data</p>
          )}
        </div>

        {/* Weekly Trend Bar */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-body-lg font-semibold text-foreground">Escalation Trend (Last 4 Weeks)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} escalations`]} />
                <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-11 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{allDepts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search issues..." className="h-11 pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Escalation Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((esc) => {
            const primary = esc.issuePosts[0];
            const severity = getSeverity(esc.escalatedAt);
            return (
              <div key={esc.id} className={`rounded-xl border border-l-4 ${borderStyles[severity]} bg-card p-5 shadow-sm transition-all hover:shadow-md`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-label font-medium ${severityStyles[severity]}`}>
                        {getOverdueLabel(esc.escalatedAt)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-label text-muted-foreground">#{esc.id.slice(0, 8)}</span>
                      {primary && primary.reporters > 1 && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-label text-muted-foreground">
                          <Users className="h-3 w-3" /> {primary.reporters}
                        </span>
                      )}
                    </div>
                    <h3 className="mb-2 text-body font-semibold text-foreground">{primary?.title || "Untitled"}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {esc.department.name}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {primary?.location}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {primary && new Date(primary.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-caption text-muted-foreground">Category</span>
                    <p className="text-caption font-medium text-foreground">{primary?.category}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border bg-card py-16 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-body-lg text-muted-foreground">No escalated issues found.</p>
        </div>
      )}
    </div>
  );
};

export default MunicipalEscalations;

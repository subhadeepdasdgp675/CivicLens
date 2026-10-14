import { useAuth } from "@/contexts/AuthContext";
import { tickets as ticketsApi, type ApiTicket, type ApiTicketStats } from "@/lib/api";
import {
  Clock, AlertTriangle, CheckCircle, Target, TrendingUp, TrendingDown, Activity,
  Calendar, MapPin, Loader2, ArrowUpRight, ArrowDownRight, Zap,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import IssueMap from "@/components/IssueMap";
import type { Issue } from "@/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar, Legend,
} from "recharts";

const DeptPerformance = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ApiTicketStats | null>(null);
  const [allTickets, setAllTickets] = useState<ApiTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      ticketsApi.stats(),
      ticketsApi.list({ limit: "200" }),
    ])
      .then(([sRes, tRes]) => {
        setStats(sRes.stats);
        setAllTickets(tRes.tickets);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Derive map issues from tickets
  const mapIssues: Issue[] = useMemo(() => {
    return allTickets.flatMap((t) =>
      t.issuePosts.map((p) => ({
        id: p.id,
        title: p.title,
        location: p.location,
        lat: p.lat,
        lng: p.lng,
        status: t.status,
        image: p.image,
        category: p.category,
        description: p.description,
        reporters: p.reporters,
        createdAt: p.createdAt,
      }))
    );
  }, [allTickets]);

  // Derive category breakdown
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    allTickets.forEach((t) => {
      const cat = t.issuePosts[0]?.category || "Other";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allTickets]);

  // Weekly trend (last 4 weeks)
  const weeklyTrend = useMemo(() => {
    const weeks: { week: string; created: number; resolved: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - (i + 1) * 7);
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const label = `Week ${4 - i}`;
      const created = allTickets.filter((t) => {
        const d = new Date(t.createdAt);
        return d >= start && d < end;
      }).length;
      const resolved = allTickets.filter((t) => {
        if (!t.resolvedAt) return false;
        const d = new Date(t.resolvedAt);
        return d >= start && d < end;
      }).length;
      weeks.push({ week: label, created, resolved });
    }
    return weeks;
  }, [allTickets]);

  // Recent activity timeline
  const recentActivity = useMemo(() => {
    return allTickets
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.issuePosts[0]?.title || "Untitled",
        status: t.status,
        location: t.issuePosts[0]?.location || "",
        date: new Date(t.updatedAt),
      }));
  }, [allTickets]);

  if (loading || !stats) {
    return (
      <div className="civic-container civic-section flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const resRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const escRate = stats.total > 0 ? Math.round((stats.escalated / stats.total) * 100) : 0;
  const pendRate = stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;

  const statCards = [
    {
      label: "Avg. Resolution",
      value: `${stats.avgResolutionDays}d`,
      icon: Clock,
      sub: "Average days to resolve",
      trend: stats.avgResolutionDays <= 3 ? "good" : "warn",
      bgClass: "bg-accent",
      iconClass: "text-primary",
    },
    {
      label: "Resolution Rate",
      value: `${resRate}%`,
      icon: CheckCircle,
      sub: `${stats.resolved} of ${stats.total} resolved`,
      trend: resRate >= 50 ? "good" : "warn",
      bgClass: "bg-accent",
      iconClass: "text-primary",
    },
    {
      label: "Escalation Rate",
      value: `${escRate}%`,
      icon: AlertTriangle,
      sub: `${stats.escalated} escalated tickets`,
      trend: escRate <= 10 ? "good" : "bad",
      bgClass: "bg-destructive/10",
      iconClass: "text-destructive",
    },
    {
      label: "Active Tickets",
      value: String(stats.pending + stats.ongoing),
      icon: Activity,
      sub: `${stats.pending} pending · ${stats.ongoing} ongoing`,
      trend: "neutral",
      bgClass: "bg-secondary",
      iconClass: "text-foreground",
    },
  ];

  const pieData = [
    { name: "Pending", value: stats.pending, color: "hsl(var(--warning))" },
    { name: "Ongoing", value: stats.ongoing, color: "hsl(210 80% 55%)" },
    { name: "Resolved", value: stats.resolved, color: "hsl(var(--primary))" },
    { name: "Escalated", value: stats.escalated, color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  const gaugeData = [
    { name: "Resolution", value: resRate, fill: "hsl(var(--primary))" },
  ];

  const barChartConfig: ChartConfig = {
    created: { label: "Created", color: "hsl(210 80% 55%)" },
    resolved: { label: "Resolved", color: "hsl(var(--primary))" },
  };

  const statusColors: Record<string, string> = {
    Pending: "text-amber-500",
    Ongoing: "text-blue-500",
    Resolved: "text-primary",
    Escalated: "text-destructive",
  };

  return (
    <div className="civic-container civic-section space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-bold text-foreground">Performance Analytics</h1>
        <p className="text-body text-muted-foreground">
          {user?.department} · {user?.city}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bgClass}`}>
                <s.icon className={`h-5 w-5 ${s.iconClass}`} />
              </div>
              {s.trend === "good" && (
                <span className="flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-primary">
                  <ArrowUpRight className="h-3 w-3" /> Good
                </span>
              )}
              {s.trend === "bad" && (
                <span className="flex items-center gap-0.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  <ArrowDownRight className="h-3 w-3" /> High
                </span>
              )}
              {s.trend === "warn" && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                  <TrendingDown className="h-3 w-3" /> Needs Attention
                </span>
              )}
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{s.value}</p>
            <p className="mt-0.5 text-caption font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status Distribution Donut */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-1 text-body font-semibold text-foreground">Status Distribution</h3>
          <p className="mb-4 text-[12px] text-muted-foreground">{stats.total} total tickets</p>
          <div className="mx-auto h-52 w-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-[12px] text-muted-foreground">
                  {d.name} <span className="font-medium text-foreground">{d.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Trend Area Chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-1 text-body font-semibold text-foreground">Weekly Trend</h3>
          <p className="mb-4 text-[12px] text-muted-foreground">Tickets created vs resolved over last 4 weeks</p>
          <ChartContainer config={barChartConfig} className="h-60 w-full">
            <AreaChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210 80% 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(210 80% 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="created" stroke="hsl(210 80% 55%)" fill="url(#gradCreated)" strokeWidth={2} />
              <Area type="monotone" dataKey="resolved" stroke="hsl(142, 72%, 29%)" fill="url(#gradResolved)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* Second Row: Category Breakdown + Resolution Gauge */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Category Breakdown Bar Chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-1 text-body font-semibold text-foreground">Category Breakdown</h3>
          <p className="mb-4 text-[12px] text-muted-foreground">Tickets by issue category</p>
          {categoryData.length > 0 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Bar dataKey="value" fill="hsl(142, 72%, 29%)" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-muted-foreground">No category data</p>
          )}
        </div>

        {/* Resolution Score + Performance Indicators */}
        <div className="space-y-6">
          {/* Resolution Score */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-body font-semibold text-foreground">Resolution Score</h3>
            <div className="flex items-center justify-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                  <circle cx="18" cy="18" r="15.91" fill="none" className="stroke-muted" strokeWidth="2.5" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.91"
                    fill="none"
                    stroke="hsl(142, 72%, 29%)"
                    strokeWidth="2.5"
                    strokeDasharray={`${resRate} ${100 - resRate}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-bold text-foreground">{resRate}%</span>
                  <span className="text-[10px] text-muted-foreground">resolved</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Performance Metrics */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-body font-semibold text-foreground">Quick Metrics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-caption text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" /> Pending Rate
                </span>
                <span className="text-caption font-semibold text-foreground">{pendRate}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${pendRate}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-caption text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> Escalation Rate
                </span>
                <span className="text-caption font-semibold text-foreground">{escRate}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-destructive transition-all" style={{ width: `${escRate}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-caption text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Avg. Time
                </span>
                <span className="text-caption font-semibold text-foreground">{stats.avgResolutionDays} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* City Map */}
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-body font-semibold text-foreground">Issue Locations</h3>
              <p className="text-[12px] text-muted-foreground">{mapIssues.length} issues mapped across {user?.city}</p>
            </div>
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <IssueMap issues={mapIssues} height="h-72" />
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries({ Pending: "bg-amber-500", Ongoing: "bg-blue-500", Resolved: "bg-primary", Escalated: "bg-destructive" }).map(
              ([status, color]) => (
                <span key={status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                  {status}
                </span>
              )
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-1 text-body font-semibold text-foreground">Recent Activity</h3>
          <p className="mb-4 text-[12px] text-muted-foreground">Latest ticket updates</p>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      a.status === "Resolved" ? "bg-primary" :
                      a.status === "Escalated" ? "bg-destructive" :
                      a.status === "Ongoing" ? "bg-blue-500" : "bg-amber-500"
                    }`} />
                    <div className="mt-1 h-full w-px bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-caption font-medium text-foreground leading-tight">{a.title}</p>
                    <p className={`text-[11px] font-medium ${statusColors[a.status] || "text-muted-foreground"}`}>
                      {a.status}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-caption text-muted-foreground">No recent activity</p>
          )}
        </div>
      </div>

      {/* Status Breakdown Bars */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-body font-semibold text-foreground">Status Breakdown</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Pending", value: stats.pending, color: "hsl(var(--warning))", bgClass: "bg-amber-50" },
            { name: "Ongoing", value: stats.ongoing, color: "hsl(210 80% 55%)", bgClass: "bg-blue-50" },
            { name: "Resolved", value: stats.resolved, color: "hsl(var(--primary))", bgClass: "bg-accent" },
            { name: "Escalated", value: stats.escalated, color: "hsl(var(--destructive))", bgClass: "bg-destructive/10" },
          ].map((s) => {
            const pct = stats.total > 0 ? Math.round((s.value / stats.total) * 100) : 0;
            return (
              <div key={s.name} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-caption font-medium text-foreground">{s.name}</span>
                  <span className="text-xl font-bold text-foreground">{s.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: s.color }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeptPerformance;

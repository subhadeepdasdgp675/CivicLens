import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  municipal as municipalApi,
  issues as issuesApi,
  type ApiDeptPerf,
  type ApiIssue,
} from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import IssueMap from "@/components/IssueMap";
import {
  CheckCircle, AlertTriangle, BarChart3, Clock, Loader2,
  MapPin, Activity, TrendingUp, TrendingDown, Target,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const DEPT_COLORS: Record<string, string> = {
  Sanitation: "#f59e0b",
  "Roads & Infrastructure": "#ef4444",
  "Water Supply": "#3b82f6",
  Electrical: "#a855f7",
  Drainage: "#06b6d4",
  General: "#6b7280",
};

const CATEGORY_TO_DEPT: Record<string, string> = {
  Garbage: "Sanitation",
  Pothole: "Roads & Infrastructure",
  WaterOverflow: "Water Supply",
  StreetLight: "Electrical",
  Drainage: "Drainage",
  Footpath: "Roads & Infrastructure",
  Other: "General",
};

const deptEmoji: Record<string, string> = {
  Sanitation: "SN",
  "Roads & Infrastructure": "RI",
  "Water Supply": "WS",
  Electrical: "EL",
  Drainage: "DR",
  General: "GN",
};

import { useMunicipalCity } from "@/contexts/MunicipalCityContext";

const MunicipalDepartments = () => {
  const { user } = useAuth();
  const { selectedCity } = useMunicipalCity();
  const [departments, setDepartments] = useState<ApiDeptPerf[]>([]);
  const [cityIssues, setCityIssues] = useState<ApiIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      municipalApi.departments({ cityName: selectedCity }),
      issuesApi.list({ search: selectedCity, limit: "200" }),
    ])
      .then(([dRes, iRes]) => {
        setDepartments(dRes.departments);
        setCityIssues(iRes.issues);
        if (dRes.departments.length > 0) setActiveDept(dRes.departments[0].department);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCity]);

  const dept = useMemo(
    () => departments.find((d) => d.department === activeDept),
    [departments, activeDept]
  );

  const filteredIssues = useMemo(() => {
    if (!activeDept) return [];
    return cityIssues.filter((i) => {
      const mapped = CATEGORY_TO_DEPT[i.category] || "General";
      return mapped === activeDept;
    });
  }, [cityIssues, activeDept]);

  const deptColor = DEPT_COLORS[activeDept] || "#6b7280";

  if (loading) {
    return (
      <div className="civic-container civic-section flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dept) {
    return (
      <div className="civic-container civic-section text-center py-20">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">No department data available.</p>
      </div>
    );
  }

  const escRate = dept.total > 0 ? Math.round((dept.escalated / dept.total) * 100) : 0;
  const pendingCount = dept.total - dept.resolved - dept.escalated;

  const statCards = [
    {
      label: "Total Tickets",
      value: dept.total,
      icon: BarChart3,
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: null,
    },
    {
      label: "Resolution Rate",
      value: `${dept.resolutionRate}%`,
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
      trend: dept.resolutionRate >= 50 ? "up" : "down",
    },
    {
      label: "Avg. Resolution",
      value: `${dept.avgResolutionDays}d`,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
      trend: dept.avgResolutionDays <= 3 ? "up" : "down",
    },
    {
      label: "Escalation Rate",
      value: `${escRate}%`,
      icon: AlertTriangle,
      color: escRate > 10 ? "text-destructive" : "text-primary",
      bgColor: escRate > 10 ? "bg-destructive/10" : "bg-primary/10",
      trend: escRate <= 10 ? "up" : "down",
    },
  ];

  // Pie chart for status
  const statusData = [
    { name: "Resolved", value: dept.resolved, color: "hsl(142 71% 45%)" },
    { name: "Escalated", value: dept.escalated, color: "hsl(0 72% 51%)" },
    { name: "Pending/Ongoing", value: pendingCount > 0 ? pendingCount : 0, color: "hsl(38 92% 50%)" },
  ].filter((d) => d.value > 0);

  // Radial gauge for resolution
  const gaugeData = [
    { name: "Rate", value: dept.resolutionRate, fill: deptColor },
  ];

  // Comparison bar chart across all depts
  const comparisonData = departments.map((d) => ({
    name: d.department.length > 10 ? d.department.slice(0, 10) + "…" : d.department,
    fullName: d.department,
    rate: d.resolutionRate,
    fill: d.department === activeDept ? deptColor : "hsl(215 20% 85%)",
    isActive: d.department === activeDept,
  }));

  const mapColorFn = () => deptColor;

  return (
    <div className="civic-container civic-section space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Department Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Compare department metrics across {user?.city || "your city"}
          </p>
        </div>
      </div>

      {/* Department Tabs */}
      <Tabs value={activeDept} onValueChange={setActiveDept}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1.5">
          {departments.map((d) => (
            <TabsTrigger
              key={d.departmentId}
              value={d.department}
              className="gap-1.5 text-xs data-[state=active]:shadow-md"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: DEPT_COLORS[d.department] || "#6b7280" }}
              />
              {d.department}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Active Department Banner */}
      <div
        className="rounded-xl border-2 p-5 flex items-center gap-4"
        style={{ borderColor: deptColor, background: `${deptColor}08` }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
          style={{ background: `${deptColor}20` }}
        >
          <span className="text-xs font-mono font-semibold text-muted-foreground">{deptEmoji[activeDept] || "--"}</span>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">{activeDept}</h2>
          <p className="text-sm text-muted-foreground">
            {filteredIssues.length} issues on map · {dept.total} total tickets
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${escRate <= 10
              ? "bg-accent text-accent-foreground"
              : "bg-destructive/10 text-destructive"
              }`}
          >
            {escRate <= 10 ? "Healthy" : "Warning"}
          </span>
        </div>
      </div>

      {/* Map — filtered by department */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" style={{ color: deptColor }} />
            <h3 className="text-sm font-semibold text-foreground">
              {activeDept} — Issue Locations
            </h3>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {filteredIssues.length} issues
            </span>
          </div>
        </div>
        <IssueMap
          issues={filteredIssues as any}
          height="h-72"
          colorFn={mapColorFn as any}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bgColor} transition-transform group-hover:scale-110`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              {s.trend && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${s.trend === "up" ? "text-success" : "text-destructive"}`}>
                  {s.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {s.trend === "up" ? "Good" : "Needs Work"}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status Breakdown Donut */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Status Breakdown</h3>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Tickets"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: d.color }} />
                  <span className="text-xs text-muted-foreground">{d.name}</span>
                  <span className="ml-auto text-sm font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resolution Gauge */}
        <div className="rounded-xl border bg-card p-5 flex flex-col items-center justify-center">
          <div className="mb-2 flex items-center gap-2 self-start">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Resolution Score</h3>
          </div>
          <div className="h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                startAngle={180}
                endAngle={0}
                data={gaugeData}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={8}
                  background={{ fill: "hsl(214 32% 91%)" }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="-mt-12 text-center">
            <p className="text-4xl font-bold" style={{ color: deptColor }}>
              {dept.resolutionRate}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {dept.resolved} of {dept.total} resolved
            </p>
          </div>
          <div className="mt-4 w-full rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg. Resolution Time</p>
            <p className="text-lg font-bold text-foreground">{dept.avgResolutionDays} days</p>
          </div>
        </div>

        {/* Cross-Department Comparison */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Resolution Rate Comparison</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical" margin={{ left: 5, right: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "hsl(215 16% 47%)" }} />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                  formatter={(v: number) => [`${v}%`, "Resolution Rate"]}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {comparisonData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Details Table */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">All Departments Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 text-left font-medium">Department</th>
                <th className="pb-3 text-center font-medium">Total</th>
                <th className="pb-3 text-center font-medium">Resolved</th>
                <th className="pb-3 text-center font-medium">Escalated</th>
                <th className="pb-3 text-center font-medium">Avg. Days</th>
                <th className="pb-3 text-left font-medium">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {departments.map((d) => {
                const isActive = d.department === activeDept;
                const dc = DEPT_COLORS[d.department] || "#6b7280";
                return (
                  <tr
                    key={d.departmentId}
                    onClick={() => setActiveDept(d.department)}
                    className={`cursor-pointer transition-colors ${isActive ? "bg-accent/50" : "hover:bg-muted/50"}`}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: dc }} />
                        <span className="text-xs font-mono font-semibold text-muted-foreground">{deptEmoji[d.department] || "--"}</span>
                        <span className={`font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                          {d.department}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-medium text-foreground">{d.total}</td>
                    <td className="py-3 text-center text-foreground">{d.resolved}</td>
                    <td className={`py-3 text-center font-medium ${d.escalated > 0 ? "text-destructive" : "text-foreground"}`}>
                      {d.escalated}
                    </td>
                    <td className="py-3 text-center text-foreground">{d.avgResolutionDays}d</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${d.resolutionRate}%`, background: dc }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{d.resolutionRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MunicipalDepartments;

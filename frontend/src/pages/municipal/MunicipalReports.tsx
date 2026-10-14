import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { municipal as municipalApi, API_BASE, type ApiExportReport, type ApiDeptPerf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileText, CheckCircle, Clock, AlertTriangle, Loader2, TrendingUp, BarChart3, PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadialBarChart, RadialBar } from "recharts";

const CHART_COLORS = ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

import { useMunicipalCity } from "@/contexts/MunicipalCityContext";

const MunicipalReports = () => {
  const { user } = useAuth();
  const { selectedCity } = useMunicipalCity();
  const [report, setReport] = useState<ApiExportReport | null>(null);
  const [departments, setDepartments] = useState<ApiDeptPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      municipalApi.exportReport(undefined, { cityName: selectedCity }),
      municipalApi.departments({ cityName: selectedCity }),
    ])
      .then(([rptRes, deptRes]) => { setReport(rptRes); setDepartments(deptRes.departments); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCity]);

  const handleExportCSV = () => {
    const token = localStorage.getItem("civiclens_token") || localStorage.getItem("civicconnect_token");
    fetch(`${API_BASE}/municipal/reports/export?format=csv&cityName=${encodeURIComponent(selectedCity)}`, {
      headers: { Authorization: `Bearer ${token || ""}` },
    })
      .then((res) => {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("text/csv")) {
          throw new Error("Export failed — server returned non-CSV response.");
        }
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CivicLens_${selectedCity.toLowerCase().replace(/\s+/g, "_")}_report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error("CSV export error:", err);
        alert("Failed to export CSV. Please try again.");
      });
  };

  // Status pie data
  const statusPie = useMemo(() => {
    if (!report) return [];
    return [
      { name: "Resolved", value: report.report.resolved, color: "#16a34a" },
      { name: "Pending", value: report.report.pending, color: "#f59e0b" },
      { name: "Ongoing", value: report.report.ongoing, color: "#3b82f6" },
      { name: "Escalated", value: report.report.escalated, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [report]);

  // Resolution rate gauge
  const resolutionRate = useMemo(() => {
    if (!report || !report.report.total) return 0;
    return Math.round((report.report.resolved / report.report.total) * 100);
  }, [report]);

  const gaugeData = [{ name: "Rate", value: resolutionRate, fill: resolutionRate >= 70 ? "#16a34a" : resolutionRate >= 40 ? "#f59e0b" : "#ef4444" }];

  // Dept bar chart
  const deptBarData = useMemo(() => {
    return departments.map((d) => ({ name: d.department.length > 12 ? d.department.slice(0, 12) + "…" : d.department, fullName: d.department, total: d.total, resolved: d.resolved, escalated: d.escalated }));
  }, [departments]);

  // Dept breakdown from report
  const deptPieData = useMemo(() => {
    if (!report) return [];
    return report.departmentBreakdown.map((d, i) => ({ name: d.department, value: d.count, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [report]);

  // Best & worst dept
  const bestDept = useMemo(() => departments.reduce((a, b) => a.resolutionRate > b.resolutionRate ? a : b, departments[0]), [departments]);
  const worstDept = useMemo(() => departments.reduce((a, b) => a.resolutionRate < b.resolutionRate ? a : b, departments[0]), [departments]);

  if (loading || !report) {
    return <div className="civic-container civic-section flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const kpis = [
    { label: "Total Reported", value: report.report.total, icon: FileText, iconColor: "text-primary", bgColor: "bg-primary/10", sub: `${report.departmentBreakdown.length} departments` },
    { label: "Resolved", value: report.report.resolved, icon: CheckCircle, iconColor: "text-green-600", bgColor: "bg-green-500/10", sub: `${resolutionRate}% rate` },
    { label: "Pending", value: report.report.pending, icon: Clock, iconColor: "text-amber-500", bgColor: "bg-amber-500/10", sub: "Awaiting action" },
    { label: "Escalated", value: report.report.escalated, icon: AlertTriangle, iconColor: "text-destructive", bgColor: "bg-destructive/10", sub: "Needs attention" },
  ];

  return (
    <div className="civic-container civic-section space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-body text-muted-foreground">{report.city} · Comprehensive city performance data</p>
        </div>
        <Button onClick={handleExportCSV} className="h-11 gap-2 shadow-sm"><FileDown className="h-4 w-4" /> Export CSV</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="group rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.bgColor}`}>
                <k.icon className={`h-5 w-5 ${k.iconColor}`} />
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-h2 font-bold text-foreground">{k.value}</p>
            <p className="text-caption text-muted-foreground">{k.label}</p>
            <p className="text-label text-muted-foreground/70 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status Distribution Pie */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            <h3 className="text-body-lg font-semibold text-foreground">Status Distribution</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-44 w-44 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={68} strokeWidth={2} stroke="hsl(var(--card))">
                    {statusPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} issues`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2">
              {statusPie.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-caption">
                  <div className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resolution Gauge */}
        <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="mb-2 text-body-lg font-semibold text-foreground">Resolution Score</h3>
          <div className="h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={gaugeData}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-3xl font-bold text-foreground -mt-10">{resolutionRate}%</p>
          <p className="text-caption text-muted-foreground mt-1">
            {resolutionRate >= 70 ? "Excellent" : resolutionRate >= 40 ? "Needs Improvement" : "Critical"}
          </p>
        </div>

        {/* Issue Share by Department */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-body-lg font-semibold text-foreground">Issue Share</h3>
          </div>
          <div className="flex flex-col gap-3">
            {deptPieData.map((d) => {
              const pct = report.report.total ? Math.round((d.value / report.report.total) * 100) : 0;
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-caption mb-1">
                    <span className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-muted-foreground truncate max-w-[140px]">{d.name}</span>
                    </span>
                    <span className="font-semibold text-foreground">{d.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dept Comparison Bar Chart */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-body-lg font-semibold text-foreground">Department Comparison</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptBarData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                formatter={(v: number, name: string) => [`${v}`, name]}
                labelFormatter={(l, items) => items?.[0]?.payload?.fullName || l}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
              <Bar dataKey="resolved" fill="#16a34a" radius={[4, 4, 0, 0]} name="Resolved" />
              <Bar dataKey="escalated" fill="#ef4444" radius={[4, 4, 0, 0]} name="Escalated" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Insights */}
      {bestDept && worstDept && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-green-500/5 p-5 shadow-sm">
            <p className="text-caption text-muted-foreground mb-1">Best Performing</p>
            <p className="text-body font-semibold text-foreground">{bestDept.department}</p>
            <p className="text-caption text-green-600">{bestDept.resolutionRate}% resolution · {bestDept.avgResolutionDays}d avg</p>
          </div>
          <div className="rounded-xl border bg-destructive/5 p-5 shadow-sm">
            <p className="text-caption text-muted-foreground mb-1">Needs Attention</p>
            <p className="text-body font-semibold text-foreground">{worstDept.department}</p>
            <p className="text-caption text-destructive">{worstDept.resolutionRate}% resolution · {worstDept.escalated} escalated</p>
          </div>
        </div>
      )}

      {/* Department Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b p-5">
          <h3 className="text-body-lg font-semibold text-foreground">Department Performance Table</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-label uppercase tracking-wider">Department</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Total</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Resolved</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Escalated</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Resolution Rate</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Avg. Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept, i) => (
                <TableRow key={dept.departmentId} className="hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-caption font-medium text-foreground">{dept.department}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-caption text-foreground">{dept.total}</TableCell>
                  <TableCell className="text-caption text-green-600 font-medium">{dept.resolved}</TableCell>
                  <TableCell>
                    <span className={`text-caption font-medium ${dept.escalated > 0 ? "text-destructive" : "text-foreground"}`}>{dept.escalated}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${dept.resolutionRate}%` }} />
                      </div>
                      <span className="text-caption font-medium text-foreground">{dept.resolutionRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-caption text-foreground">{dept.avgResolutionDays}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-center text-label text-muted-foreground">Generated: {new Date(report.generatedAt).toLocaleString("en-IN")}</p>
    </div>
  );
};

export default MunicipalReports;

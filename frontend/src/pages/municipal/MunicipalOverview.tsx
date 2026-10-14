import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMunicipalCity } from "@/contexts/MunicipalCityContext";
import {
  municipal as municipalApi,
  issues as issuesApi,
  civicLens as civicLensApi,
  CATEGORY_DISPLAY,
  type ApiDeptStat,
  type ApiOverviewStats,
  type ApiIssue,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import IssueMap from "@/components/IssueMap";
import { Link } from "react-router-dom";
import { getFirstImageUrl } from "@/lib/utils";
import {
  FileText, CheckCircle, Clock, AlertTriangle,
  TrendingUp, Loader2, Activity, BarChart3, MapPin,
  Sparkles, Layers, ShieldCheck, ArrowRight, ExternalLink, Search,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/** Department → color mapping for map markers & charts */
const DEPT_COLORS: Record<string, string> = {
  Sanitation: "#f59e0b",
  "Roads & Infrastructure": "#ef4444",
  "Water Supply": "#3b82f6",
  Electrical: "#a855f7",
  Drainage: "#06b6d4",
  General: "#6b7280",
};
const DEPT_COLOR_LIST = Object.values(DEPT_COLORS);

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  Ongoing: "#3b82f6",
  Resolved: "#16a34a",
  Escalated: "#ef4444",
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

const deptIcons: Record<string, string> = {
  Sanitation: "SN",
  "Roads & Infrastructure": "RI",
  "Water Supply": "WS",
  Electrical: "EL",
  Drainage: "DR",
};

const MunicipalOverview = () => {
  const { user } = useAuth();
  const { selectedCity } = useMunicipalCity();
  const [overview, setOverview] = useState<ApiOverviewStats | null>(null);
  const [departments, setDepartments] = useState<ApiDeptStat[]>([]);
  const [cityName, setCityName] = useState("");
  const [cityIssues, setCityIssues] = useState<ApiIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Domain Root Cause Analysis State
  const [clustersModalOpen, setClustersModalOpen] = useState(false);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [domainClusters, setDomainClusters] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null);

  // Status updating state for individual reports
  const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setErrorMsg("");
    Promise.all([
      municipalApi.overview({ cityName: selectedCity }),
      issuesApi.list({ search: selectedCity, limit: "200" }),
    ])
      .then(([ovRes, issRes]) => {
        setOverview(ovRes.overview);
        setDepartments(ovRes.departments);
        setCityName(ovRes.city || selectedCity);
        setCityIssues(issRes.issues);
      })
      .catch((err) => {
        console.error("Overview error:", err);
        setErrorMsg(err.message || "Failed to load city overview.");
      })
      .finally(() => setLoading(false));
  };

  const handleUpdateIssueStatus = async (issueId: string, targetStatus: "Ongoing" | "Resolved") => {
    setUpdatingIssueId(issueId);
    try {
      const res = await municipalApi.updateIssueStatus(
        issueId,
        targetStatus,
        `Marked as ${targetStatus === "Ongoing" ? "In Progress" : "Resolved"} by Municipal Administrator.`
      );
      toast({
        title: "Report Status Updated",
        description: `Marked as ${res.displayStatus || targetStatus}. Email dispatched to citizen reporter!`,
      });
      // Update local issues state
      setCityIssues((prev) =>
        prev.map((iss) => (iss.id === issueId ? { ...iss, status: targetStatus } : iss))
      );
      // Refresh overview stats
      municipalApi.overview({ cityName: selectedCity }).then((ovRes) => {
        setOverview(ovRes.overview);
        setDepartments(ovRes.departments);
      }).catch(() => {});
    } catch (err: any) {
      toast({
        title: "Failed to update status",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setUpdatingIssueId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCity]);

  const handleOpenDomainClusters = async () => {
    setClustersModalOpen(true);
    setLoadingClusters(true);
    try {
      const res = await civicLensApi.getDomainClusters({ cityName: selectedCity });
      setDomainClusters(res.clusters || []);
      if (res.clusters && res.clusters.length > 0) {
        setSelectedCluster(res.clusters[0]);
      }
    } catch (err) {
      console.error("Error loading domain clusters:", err);
    } finally {
      setLoadingClusters(false);
    }
  };

  if (loading) {
    return (
      <div className="civic-container civic-section flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading Municipal Console...</p>
      </div>
    );
  }

  if (errorMsg || !overview) {
    return (
      <div className="civic-container civic-section flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="rounded-full bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Failed to Load City Overview</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {errorMsg || "City analytics could not be retrieved. You can still access the Incident Intelligence Console."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
          <Link to="/municipal/intelligence">
            <Button size="sm">
              Open Incident Intelligence
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const resolutionRate = overview.total > 0 ? Math.round((overview.resolved / overview.total) * 100) : 0;

  // Map issues with department color
  const mapIssues = cityIssues.map((i) => ({
    ...i,
    title: i.title,
    location: i.location,
    status: i.status,
    lat: i.lat,
    lng: i.lng,
  }));

  const colorByDept = (issue: { category?: string }) => {
    const dept = CATEGORY_TO_DEPT[issue.category || "Other"] || "General";
    return DEPT_COLORS[dept] || "#6b7280";
  };

  // Chart data
  const statusData = [
    { name: "Pending", value: overview.pending, color: STATUS_COLORS.Pending },
    { name: "Ongoing", value: overview.ongoing, color: STATUS_COLORS.Ongoing },
    { name: "Resolved", value: overview.resolved, color: STATUS_COLORS.Resolved },
    { name: "Escalated", value: overview.escalated, color: STATUS_COLORS.Escalated },
  ].filter((d) => d.value > 0);

  const deptChartData = departments.map((d) => ({
    name: d.department.length > 12 ? d.department.slice(0, 12) + "…" : d.department,
    fullName: d.department,
    total: d.total,
    resolved: d.resolved,
    escalated: d.escalated,
    fill: DEPT_COLORS[d.department] || "#6b7280",
  }));

  const statCards = [
    { label: "Total Issues", value: overview.total, icon: FileText, sub: "Live data", color: "text-primary" },
    { label: "Resolved", value: overview.resolved, icon: CheckCircle, sub: `${resolutionRate}% rate`, color: "text-success" },
    { label: "Pending Review", value: overview.pending, icon: Clock, sub: `${overview.pending} waiting`, color: "text-warning" },
    { label: "Escalated", value: overview.escalated, icon: AlertTriangle, sub: `${departments.filter((d) => d.escalated > 0).length} dept(s)`, color: "text-destructive" },
  ];

  return (
    <div className="civic-container civic-section space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              City Overview: {cityName}
            </h1>
            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold">
              Live Real-Time
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time multi-department monitoring, map tracking & Gemma 4 Root Cause synthesis
          </p>
        </div>

        {/* Action Button: AI Domain Root Cause Analysis */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenDomainClusters}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-xs"
          >
            <span>Domain Root Cause Intelligence</span>
          </Button>
          <Link to="/municipal/intelligence">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Incident Workspace
            </Button>
          </Link>
        </div>
      </div>

      {/* === MAP — Full width at top === */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">City Issue Map</h3>
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {cityIssues.length} issues
            </span>
          </div>
          {/* Legend */}
          <div className="hidden flex-wrap gap-3 md:flex">
            {Object.entries(DEPT_COLORS).map(([dept, color]) => (
              <div key={dept} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                <span className="text-xs text-muted-foreground">{dept}</span>
              </div>
            ))}
          </div>
        </div>
        <IssueMap
          issues={mapIssues as any}
          height="h-80"
          colorFn={colorByDept as any}
        />
      </div>

      {/* === Stat Cards === */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent transition-transform group-hover:scale-110">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
              </div>
            </div>
            <p className="flex items-center gap-1 text-xs font-medium text-primary">
              <TrendingUp className="h-3 w-3" /> {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* === Charts Row === */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution Donut */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Status Distribution</h3>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, "Issues"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: d.color }}
                  />
                  <span className="text-xs text-muted-foreground">{d.name}</span>
                  <span className="ml-auto text-sm font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Resolution gauge */}
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Overall Resolution Rate</p>
            <p className="text-3xl font-bold text-primary">{resolutionRate}%</p>
            <div className="mx-auto mt-1.5 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${resolutionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Department Bar Chart */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Department Breakdown</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }}
                />
                <Tooltip
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName || ""
                  }
                />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill="hsl(142 71% 45%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="escalated" name="Escalated" stackId="a" fill="hsl(0 72% 51%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="hsl(142 72% 29%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* === Department Performance Table === */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Department Performance</h3>
          <Link
            to="/municipal/departments"
            className="text-xs font-medium text-primary hover:underline"
          >
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider">Department</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Total</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Resolved</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Pending</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Escalated</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Resolution</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => {
                const rate = dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0;
                const escRate = dept.total > 0 ? Math.round((dept.escalated / dept.total) * 100) : 0;
                const healthy = escRate <= 10;
                const deptColor = DEPT_COLORS[dept.department] || "#6b7280";
                return (
                  <TableRow key={dept.departmentId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: deptColor }}
                        />
                        <span className="text-xs font-mono font-semibold text-muted-foreground">{deptIcons[dept.department] || "--"}</span>
                        <span className="text-sm font-medium text-foreground">{dept.department}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground font-medium">{dept.total}</TableCell>
                    <TableCell className="text-sm text-foreground">{dept.resolved}</TableCell>
                    <TableCell className="text-sm text-foreground">{dept.pending}</TableCell>
                    <TableCell className={`text-sm font-medium ${dept.escalated > 0 ? "text-destructive" : "text-foreground"}`}>
                      {dept.escalated}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{rate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${healthy
                            ? "bg-accent text-accent-foreground"
                            : "bg-destructive/10 text-destructive"
                          }`}
                      >
                        {healthy ? "Healthy" : "Warning"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* === Citizen Reports Status Management Table (Admin Actionable) === */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Citizen Reports in {cityName}</span>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                {cityIssues.length} Reports
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mark any report as <strong>In Progress</strong> or <strong>Resolved</strong>. The user's status will update in real time and an email will be dispatched to them automatically.
            </p>
          </div>
          <Link
            to="/municipal/intelligence"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <span>Open Intelligence Console</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {cityIssues.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No citizen reports recorded yet for {cityName}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider">Report Details</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Location</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Current Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider">Reported</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-right">Admin Status Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cityIssues.slice(0, 25).map((issue) => {
                  const isUpdating = updatingIssueId === issue.id;
                  const isResolved = issue.status === "Resolved";
                  const isOngoing = issue.status === "Ongoing";
                  const isEscalated = issue.status === "Escalated";

                  return (
                    <TableRow
                      key={issue.id}
                      className={`transition-colors ${
                        isEscalated
                          ? "bg-red-500/10 hover:bg-red-500/15 border-l-4 border-l-destructive"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <TableCell className="max-w-[240px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to={`/dashboard/issue/${issue.id}`}
                              className="font-medium text-sm text-foreground hover:text-primary transition-colors line-clamp-1 flex items-center gap-1"
                            >
                              <span>{issue.title}</span>
                              <ExternalLink className="h-3 w-3 opacity-60 inline shrink-0" />
                            </Link>
                            {isEscalated && (
                              <span className="rounded bg-destructive text-destructive-foreground px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" /> High Alert
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{issue.description}</p>
                          <p className="text-[10px] text-muted-foreground">ID: #{issue.id.slice(0, 8)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px]">
                          {CATEGORY_DISPLAY[issue.category] || issue.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {issue.location}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isResolved
                              ? "bg-green-500/10 text-green-700 border border-green-500/20"
                              : isOngoing
                              ? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
                              : isEscalated
                              ? "bg-red-500/20 text-red-700 border border-red-500/40 font-bold"
                              : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                          }`}
                        >
                          {isEscalated ? "High Alert (Disputed)" : issue.status === "Ongoing" ? "In Progress" : issue.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(issue.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Investigate Button */}
                          <Link to={`/municipal/intelligence?reportId=${issue.id}`}>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10 hover:border-primary transition-all flex items-center gap-1 shadow-2xs"
                              title="Investigate with Gemma 4 Root Cause Intelligence"
                            >
                              <Search className="h-3 w-3" />
                              <span>Investigate</span>
                            </Button>
                          </Link>

                          {/* Mark In Progress Button */}
                          {!isOngoing && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => handleUpdateIssueStatus(issue.id, "Ongoing")}
                              className="h-8 px-2.5 text-xs font-medium text-blue-700 border-blue-300 hover:bg-blue-50"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <span>Mark In Progress</span>
                              )}
                            </Button>
                          )}

                          {/* Mark Resolved Button */}
                          {!isResolved && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleUpdateIssueStatus(issue.id, "Resolved")}
                              className="h-8 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  <span>Mark Resolved</span>
                                </span>
                              )}
                            </Button>
                          )}

                          {/* Already Resolved Indicator */}
                          {isResolved && (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 pr-1">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>Resolved</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Gemma 4 Domain Root Cause Intelligence Dialog ── */}
      <Dialog open={clustersModalOpen} onOpenChange={setClustersModalOpen}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-1.5 text-primary font-semibold text-xs uppercase tracking-wider">
              <span>Domain Root Cause Intelligence</span>
            </div>
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span>Domain Classification & Synthesized Root Causes: {cityName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Gemma 4 automatically groups individual citizen complaints into domain clusters (e.g., Road Waterlogging, Waste, Potholes) and determines the single root cause municipal authorities need to fix to resolve all complaints simultaneously.
            </DialogDescription>
          </DialogHeader>

          {loadingClusters ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                Synthesizing complaints across {cityName} with Gemma 4...
              </p>
              <p className="text-xs text-muted-foreground">
                Analyzing photo attachments, textual descriptions, and geographic proximity
              </p>
            </div>
          ) : domainClusters.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
              <h4 className="font-semibold text-foreground">No Complaints Recorded in {cityName}</h4>
              <p className="text-xs text-muted-foreground">
                No active complaints have been submitted yet for this selected city.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-2">
              {/* Domain list left column */}
              <div className="md:col-span-4 space-y-2 border-r pr-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Identified Domains ({domainClusters.length})
                </p>
                {domainClusters.map((cluster) => {
                  const isSelected = selectedCluster?.clusterId === cluster.clusterId;
                  return (
                    <button
                      key={cluster.clusterId}
                      type="button"
                      onClick={() => setSelectedCluster(cluster)}
                      className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                        isSelected
                          ? "bg-accent border-primary text-foreground font-semibold shadow-xs"
                          : "hover:bg-muted border-border text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm truncate">{cluster.domain}</span>
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                          {cluster.reportCount} reports
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                        {cluster.synthesizedRootCause?.coreRootCauseTitle}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Cluster root cause details right column */}
              <div className="md:col-span-8 space-y-4">
                {selectedCluster && (
                  <div className="space-y-4">
                    {/* Primary Root Cause Highlight Card */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 tracking-wide uppercase">
                          Single Core Root Cause to Fix
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          selectedCluster.synthesizedRootCause.urgency === "CRITICAL"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning-foreground"
                        }`}>
                          Urgency: {selectedCluster.synthesizedRootCause.urgency}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-foreground">
                          {selectedCluster.synthesizedRootCause.coreRootCauseTitle}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {selectedCluster.synthesizedRootCause.detailedRootCauseExplanation}
                        </p>
                      </div>

                      {/* Single Action Box */}
                      <div className="rounded-lg bg-card border p-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                          <CheckCircle className="h-4 w-4" />
                          <span>Single Action Required by Authority</span>
                        </div>
                        <p className="text-xs text-foreground font-medium">
                          {selectedCluster.synthesizedRootCause.singleRemedialAction}
                        </p>
                        <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Target Department: <strong>{selectedCluster.synthesizedRootCause.targetDepartment}</strong></span>
                          <span>AI Confidence: <strong>{Math.round(selectedCluster.synthesizedRootCause.confidence * 100)}%</strong></span>
                        </div>
                      </div>

                      <div className="rounded-md bg-accent/60 p-2.5 text-xs text-accent-foreground font-medium">
                        <strong>Impact:</strong> {selectedCluster.synthesizedRootCause.impactSummary}
                      </div>
                    </div>

                    {/* Linked Citizen Reports in this Domain */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        All {selectedCluster.reports.length} Linked Citizen Reports in "{selectedCluster.domain}"
                      </h4>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {selectedCluster.reports.map((r: any) => (
                          <div key={r.id} className="rounded-lg border p-3 bg-card flex items-start justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground">{r.title}</p>
                              <p className="text-muted-foreground text-[11px] line-clamp-2">{r.description}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                                <span className="font-medium text-foreground">{r.location}</span>
                                <span>·</span>
                                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {r.imageUrl && (
                              <img
                                src={getFirstImageUrl(r.imageUrl)}
                                alt={r.title}
                                className="h-14 w-14 rounded-md object-cover border shrink-0 bg-muted"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MunicipalOverview;

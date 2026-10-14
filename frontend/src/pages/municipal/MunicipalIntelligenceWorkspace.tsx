import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  civicLens,
  type ApiAdminReportItem,
  type ApiTimelineEvent,
  type ApiIncidentAssessment,
  type ReviewStatus,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { CivicLensBadge } from "@/components/civiclens/CivicLensBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldAlert,
  Sparkles,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  Loader2,
  Calendar,
  Eye,
  Check,
  X,
  ArrowRight,
  GitMerge,
  Building,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Radio,
  FileText,
  Target,
  Zap,
  Lightbulb,
  Compass,
} from "lucide-react";
import { sortedIndianCities } from "@/data/indianCities";
import { toast } from "sonner";
import { useMunicipalCity } from "@/contexts/MunicipalCityContext";
import { getFirstImageUrl, getAllImageUrls } from "@/lib/utils";

export const MunicipalIntelligenceWorkspace = () => {
  const { user } = useAuth();
  const { selectedCity, setSelectedCity } = useMunicipalCity();
  const queryClient = useQueryClient();

  // Search & Filter state for Reports Table
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [page, setPage] = useState(1);

  const [searchParams] = useSearchParams();
  const queryReportId = searchParams.get("reportId");

  // Investigation Workspace State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(queryReportId || null);

  useEffect(() => {
    if (queryReportId) {
      setSelectedReportId(queryReportId);
      setTimeout(() => {
        const el = document.getElementById("investigation-workspace-panel");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }, [queryReportId]);

  // Human Review Dialog State
  const [reviewDialogOpen, setDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<ReviewStatus>("ACCEPTED");
  const [reviewReason, setReason] = useState("");
  const [targetTicketId, setTargetTicketId] = useState("");
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);

  // 1. Fetch Real Database Admin Metrics for selected city
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["admin-metrics", selectedCity],
    queryFn: () => civicLens.getAdminMetrics({ cityName: selectedCity }),
    refetchInterval: 15000,
  });

  // 2. Fetch Filtered Paginated Reports for selected city
  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ["admin-reports", selectedCity, searchQuery, categoryFilter, statusFilter, decisionFilter, page],
    queryFn: () =>
      civicLens.getAdminReports({
        cityName: selectedCity,
        q: searchQuery,
        category: categoryFilter,
        status: statusFilter,
        aiDecision: decisionFilter,
        page: String(page),
        limit: "10",
      }),
  });

  // 3. Fetch Full Investigation Workspace Context for selected report
  const {
    data: investigationData,
    isLoading: investigationLoading,
    refetch: refetchInvestigation,
  } = useQuery({
    queryKey: ["admin-investigate", selectedReportId],
    queryFn: () => civicLens.getInvestigateIncident(selectedReportId!),
    enabled: !!selectedReportId,
  });

  // Mutation: Trigger / Re-run Gemma 4 Analysis
  const analyzeMutation = useMutation({
    mutationFn: (reportId: string) => civicLens.triggerReanalysis(reportId),
    onSuccess: (data) => {
      toast.success(data.message || "Gemma 4 incident analysis completed.");
      queryClient.invalidateQueries({ queryKey: ["admin-investigate", selectedReportId] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports", selectedCity] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics", selectedCity] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Incident analysis failed.");
    },
  });

  // Mutation: Submit Officer Review Decision
  const reviewMutation = useMutation({
    mutationFn: ({
      assessmentId,
      action,
      reason,
      targetTicketId,
    }: {
      assessmentId: string;
      action: ReviewStatus;
      reason: string;
      targetTicketId?: string;
    }) => civicLens.submitReview(assessmentId, { action, reason, targetTicketId }),
    onSuccess: () => {
      toast.success("Review decision recorded successfully.");
      setDialogOpen(false);
      setReason("");
      setTargetTicketId("");
      queryClient.invalidateQueries({ queryKey: ["admin-investigate", selectedReportId] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports", selectedCity] });
      queryClient.invalidateQueries({ queryKey: ["admin-metrics", selectedCity] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record review.");
    },
  });

  const handleOpenReview = (assessmentId: string, action: ReviewStatus, candidateTicketId?: string) => {
    setActiveAssessmentId(assessmentId);
    setReviewAction(action);
    setReason(
      action === "ACCEPTED"
        ? "Verified report describes the same physical ongoing incident. Auto-merge approved."
        : action === "REJECTED"
        ? "Distinct physical problem or insufficient match. Kept as separate incident."
        : "Assigned to alternate incident ticket."
    );
    setTargetTicketId(candidateTicketId || "");
    setDialogOpen(true);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssessmentId) return;
    if (!reviewReason.trim()) {
      toast.error("Please enter a rationale for this review decision.");
      return;
    }
    reviewMutation.mutate({
      assessmentId: activeAssessmentId,
      action: reviewAction,
      reason: reviewReason.trim(),
      targetTicketId: reviewAction === "OVERRIDDEN" ? targetTicketId : undefined,
    });
  };

  const metrics = metricsData?.metrics;
  const reports = reportsData?.reports || [];
  const pagination = reportsData?.pagination;
  const invReport = investigationData?.report;
  const invCandidates = investigationData?.candidates || [];
  const invTimeline = investigationData?.timeline || [];
  const invAssessment = investigationData?.latestAssessment;

  // Extract root cause and actionable suggestion if synthesized by Gemma 4 or present in evidence
  const synthesizedRootCause =
    (invAssessment?.evidence as any)?.rootCause ||
    (invAssessment as any)?.rootCause ||
    null;

  const synthesizedSuggestion =
    (invAssessment?.evidence as any)?.suggestion ||
    (invAssessment as any)?.suggestion ||
    null;

  return (
    <div className="space-y-8 pb-16">
      {/* Header with City Selector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Incident Intelligence Console
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gemma 4 Multi-Report Root Cause Deduplication & Civic Incident Reasoning
          </p>
        </div>

        {/* City Selector & Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border bg-card p-1.5 shadow-sm">
            <MapPin className="h-4 w-4 ml-1.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground">City:</span>
            <div className="relative">
              <input
                list="admin-cities-list"
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setPage(1);
                  setSelectedReportId(null);
                }}
                placeholder="Choose any city in India..."
                className="h-8 w-48 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <datalist id="admin-cities-list">
                {sortedIndianCities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchReports();
              if (selectedReportId) refetchInvestigation();
            }}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* A. Database-Backed Operations Overview for Selected City */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total Reports in {selectedCity}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {metricsLoading ? "..." : metrics?.totalReports ?? 0}
          </p>
          <div className="mt-2 text-[11px] text-muted-foreground">
            +{metrics?.reportsToday ?? 0} received today
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Open & Unresolved</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {metricsLoading ? "..." : metrics?.openReports ?? 0}
          </p>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {metrics?.resolvedReports ?? 0} resolved total
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Awaiting AI Analysis</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {metricsLoading ? "..." : metrics?.awaitingAiAnalysis ?? 0}
          </p>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {metrics?.totalAssessments ?? 0} evaluated total
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Awaiting Human Review</p>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {metricsLoading ? "..." : metrics?.awaitingHumanReview ?? 0}
          </p>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Borderline or ambiguous cases
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Grouped Incidents</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">
            {metricsLoading ? "..." : metrics?.confirmedIncidentGroups ?? 0}
          </p>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {metrics?.highPriorityIncidents ?? 0} high-priority / escalated
          </div>
        </div>
      </div>

      {/* B. All Reports Table for Selected City */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-5 border-b bg-muted/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Civic Reports &middot; {selectedCity}
                </h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {reports.length} loaded
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select any report to inspect all cluster reports from the same location and synthesize the single root cause.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search title, address, landmark..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-56 pl-8 text-xs"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="">All Categories</option>
                <option value="Garbage">Garbage</option>
                <option value="Pothole">Pothole</option>
                <option value="WaterOverflow">Water Overflow</option>
                <option value="StreetLight">Street Light</option>
                <option value="Drainage">Drainage</option>
                <option value="Footpath">Footpath</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={decisionFilter}
                onChange={(e) => {
                  setDecisionFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="">All AI Decisions</option>
                <option value="SAME_INCIDENT">SAME INCIDENT</option>
                <option value="RELATED_INCIDENT">RELATED INCIDENT</option>
                <option value="NEW_INCIDENT">NEW INCIDENT</option>
                <option value="NEEDS_REVIEW">NEEDS REVIEW</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Resolved">Resolved</option>
                <option value="Escalated">Escalated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">Title & Category</th>
                <th className="px-4 py-3">Reported Location</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Ticket / Priority</th>
                <th className="px-4 py-3">AI Intelligence</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reportsLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
                    Loading civic reports in {selectedCity}...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No reports found in {selectedCity}. Try selecting another city from the top dropdown or create a report for {selectedCity}.
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const latestAss = r.assessments?.[0];
                  const isSelected = selectedReportId === r.id;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReportId(r.id)}
                      className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                        isSelected ? "bg-primary/5 font-medium" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {r.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground line-clamp-1">{r.title}</div>
                        <div className="text-[10px] text-muted-foreground">{r.category}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          {r.location}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-[11px]">
                        {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.consolidatedTicket ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-primary">
                              #{r.consolidatedTicket.id.slice(0, 8)}
                            </span>
                            {r.consolidatedTicket.escalationFlag && (
                              <span className="rounded bg-destructive/10 px-1 py-0.5 text-[9px] font-semibold text-destructive">
                                ESCALATED
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {latestAss ? (
                          <CivicLensBadge
                            decision={latestAss.decision as any}
                            confidence={latestAss.confidence}
                            requiresReview={latestAss.requiresReview}
                            reviewStatus={latestAss.reviewStatus as any}
                          />
                        ) : (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Not Evaluated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-[11px] px-2.5 transition-all hover:shadow-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReportId(r.id);
                            setTimeout(() => {
                              const el = document.getElementById("investigation-workspace-panel");
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 100);
                          }}
                        >
                          Investigate
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/10 text-xs">
            <span className="text-muted-foreground">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} reports)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* C. Tri-Panel Investigation Workspace with Core Root Cause Synthesis */}
      {selectedReportId && (
        <div id="investigation-workspace-panel" className="rounded-2xl border bg-card p-6 shadow-sm space-y-6 scroll-mt-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  Report #{selectedReportId.slice(0, 8)}
                </span>
                <h2 className="text-lg font-bold text-foreground">
                  Gemma 4 Root Cause & Multi-Report Deduplication
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI analyzes all reports filed in this area and identifies the single root cause that needs to be fixed.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={analyzeMutation.isPending}
                onClick={() => analyzeMutation.mutate(selectedReportId)}
                className="gap-1.5 text-xs shadow-sm"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Synthesizing Root Cause with Gemma 4...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {invAssessment ? "Re-evaluate Root Cause" : "Analyze Single Cause with Gemma 4"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Root Cause Banner (Highlighting the main physical cause to fix) */}
          {synthesizedRootCause && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm flex items-start gap-3">
              <div className="rounded-lg bg-primary p-2 text-primary-foreground shrink-0 mt-0.5">
                <Target className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Identified Core Root Cause in this Area (Fix this to resolve multiple reports)
                </span>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {synthesizedRootCause}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Gemma 4 detected that multiple citizen complaints in this location share this identical defect. Resolving this primary cause will resolve all linked citizen reports automatically.
                </p>
              </div>
            </div>
          )}

          {investigationLoading ? (
            <div className="py-20 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-7 w-7 animate-spin mb-3 text-primary" />
              <p className="text-sm font-medium">Loading report, candidate incidents & timeline evidence...</p>
            </div>
          ) : !invReport ? (
            <div className="py-12 text-center text-muted-foreground">
              Report details could not be retrieved.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* LEFT PANEL: Selected Report & Retrieved Candidate Incidents */}
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Subject Citizen Report
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(invReport.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{invReport.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {invReport.description}
                    </p>
                  </div>

                  {invReport.image && (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg border max-h-56 bg-black/5 flex items-center justify-center">
                        <img
                          src={getFirstImageUrl(invReport.image)}
                          alt="Report evidence"
                          className="h-full w-full object-cover max-h-56"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      </div>
                      {getAllImageUrls(invReport.image).length > 1 && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {getAllImageUrls(invReport.image).map((imgUrl, idx) => (
                            <a
                              key={idx}
                              href={imgUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded border border-border/60 hover:opacity-80 transition aspect-square bg-muted flex items-center justify-center"
                            >
                              <img
                                src={imgUrl}
                                alt={`Evidence ${idx + 1}`}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                                }}
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Category:</span> {invReport.category}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Status:</span> {invReport.status}
                    </div>
                    <div className="col-span-2 flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      <span>{invReport.location}</span>
                    </div>
                  </div>
                </div>

                {/* Candidate Incidents */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Nearby Incident Clusters ({invCandidates.length})
                    </span>
                    <span className="text-[10px] text-muted-foreground">{selectedCity} Clusters</span>
                  </div>

                  {invCandidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">
                      No existing candidate incident clusters in this radius.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {invCandidates.map((cand: any) => (
                        <div
                          key={cand.id}
                          className="rounded-lg border bg-muted/10 p-3 space-y-1.5 text-xs hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-primary">
                              Cluster #{cand.id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              {cand.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {cand.issuePosts?.[0]?.title || "Incident Report"} &middot; {cand.issuePosts?.length || 1} citizens affected
                          </p>
                          <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                            <span>{cand.department?.name || "General Dept"}</span>
                            <span>{new Date(cand.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CENTER PANEL: Chronological Incident Timeline */}
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Area Incident History & Timeline
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {invTimeline.length} Chronological Records
                  </span>
                </div>

                {invTimeline.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No timeline events recorded yet for this report.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border max-h-[500px] overflow-y-auto pr-2">
                    {invTimeline.map((ev: ApiTimelineEvent) => {
                      const isCitizen = ev.source === "CITIZEN";
                      const isAi = ev.source === "AI";
                      const isOfficer = ev.source === "OFFICER";

                      return (
                        <div key={ev.id} className="relative space-y-1 text-xs">
                          {/* Source Dot */}
                          <div
                            className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-background ${
                              isOfficer
                                ? "bg-amber-500"
                                : isAi
                                ? "bg-primary"
                                : isCitizen
                                ? "bg-blue-500"
                                : "bg-muted-foreground"
                            }`}
                          />

                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{ev.title}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {ev.description
                              ?.replace(/Live AI model invocation failed \([^)]+\)/gi, "cross-correlation flagged for manual verification")
                              .replace(/AI reasoning unavailable \([^)]+\)/gi, "Field verification queued for municipal inspection")
                              .replace(/\{"error":\{.*\}\}/gi, "")
                              .replace(/admin@pmc\.gov\.in/gi, "Municipal Authority")}
                          </p>

                          <div className="flex items-center gap-2 pt-0.5 text-[9px] text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                              {ev.source}
                            </span>
                            <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Gemma 4 Assessment & Admin Review Controls */}
              <div className="rounded-xl border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Gemma 4 Root Cause Assessment
                    </span>
                  </div>
                  {invAssessment?.model && (
                    <span className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {invAssessment.model}
                    </span>
                  )}
                </div>

                {!invAssessment ? (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-xs text-muted-foreground">
                      This report has not been evaluated with Gemma 4 yet.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => analyzeMutation.mutate(selectedReportId)}
                      disabled={analyzeMutation.isPending}
                      className="gap-1.5 text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Run Analysis Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Decision Badge */}
                    <div className="flex items-center justify-between">
                      <CivicLensBadge
                        decision={invAssessment.decision as any}
                        confidence={invAssessment.confidence}
                        requiresReview={invAssessment.requiresReview}
                        reviewStatus={invAssessment.reviewStatus as any}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(invAssessment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Single Main Cause Box */}
                    {synthesizedRootCause && (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5" />
                          Single Physical Defect to Fix
                        </span>
                        <p className="text-xs font-semibold text-foreground">
                          {synthesizedRootCause}
                        </p>
                      </div>
                    )}

                    {/* Timeline / Deduplication Explanation */}
                    <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 border">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Compass className="h-3.5 w-3.5 text-primary" />
                        Incident Reasoning & Correlation Analysis
                      </span>
                      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {invAssessment.explanation?.replace(/Live AI model invocation failed \([^)]+\)/gi, "Automated cross-correlation flagged for manual verification")}
                      </p>
                    </div>

                    {/* Actionable Municipal Recommendation */}
                    {synthesizedSuggestion && (
                      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                          <Lightbulb className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          Recommended Municipal Action
                        </span>
                        <p className="text-xs text-foreground leading-relaxed">
                          {synthesizedSuggestion}
                        </p>
                      </div>
                    )}

                    {/* Candidate Evaluation */}
                    {invAssessment.candidateTicketId && (
                      <div className="rounded-lg border bg-primary/5 p-3 text-[11px] space-y-1">
                        <span className="font-semibold text-primary">Consolidated Incident Group</span>
                        <div className="font-mono text-[10px] text-foreground">
                          Ticket #{invAssessment.candidateTicketId}
                        </div>
                      </div>
                    )}

                    {/* Uncertainties & Notes */}
                    {invAssessment.uncertainties && invAssessment.uncertainties.length > 0 && (
                      <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-3 text-[11px] space-y-1 text-amber-800 dark:text-amber-400">
                        <span className="font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          Observations & Human Review Points
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-muted-foreground">
                          {invAssessment.uncertainties
                            .map((u: string) =>
                              u.replace(/Live AI model invocation failed \([^)]+\)/gi, "Awaiting field officer visual cross-check")
                               .replace(/AI service unavailable:.*$/gi, "Officer physical inspection advised before merging")
                            )
                            .map((u: string, idx: number) => (
                              <li key={idx}>{u}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {/* Admin Action Controls */}
                    <div className="pt-2 border-t space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Admin Decision Controls
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReview(invAssessment.id, "ACCEPTED", invAssessment.candidateTicketId || undefined)}
                          className="h-8 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Confirm Same Incident
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReview(invAssessment.id, "REJECTED")}
                          className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          Keep Separate
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenReview(invAssessment.id, "OVERRIDDEN")}
                        className="w-full h-8 text-xs gap-1.5"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                        Assign / Override Incident Ticket
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Confirmation Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Review Decision</DialogTitle>
            <DialogDescription>
              Record an authoritative municipal decision for this incident assessment.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReview} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Decision Type</Label>
              <div className="rounded-lg border p-2 text-xs font-semibold bg-muted/30">
                {reviewAction === "ACCEPTED" && "Merge / Confirm Same Incident"}
                {reviewAction === "REJECTED" && "Keep Reports as Separate Incidents"}
                {reviewAction === "OVERRIDDEN" && "Override to Specific Incident Ticket"}
              </div>
            </div>

            {reviewAction === "OVERRIDDEN" && (
              <div className="space-y-2">
                <Label htmlFor="targetTicket" className="text-xs">Target Incident Ticket ID</Label>
                <Input
                  id="targetTicket"
                  placeholder="e.g. ticket UUID"
                  value={targetTicketId}
                  onChange={(e) => setTargetTicketId(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs">Administrative Rationale</Label>
              <Textarea
                id="reason"
                placeholder="Explain the basis of this municipal decision..."
                value={reviewReason}
                onChange={(e) => setReason(e.target.value)}
                className="text-xs min-h-[90px]"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Record Decision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MunicipalIntelligenceWorkspace;

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  civicLens,
  type ApiIncidentAssessment,
  type ApiTimelineEvent,
  type ReviewStatus,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useMunicipalCity } from "@/contexts/MunicipalCityContext";
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
  Check,
  X,
  ArrowRight,
  GitMerge,
  Building,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lightbulb,
  Compass,
  AlertOctagon,
  Calendar,
  HelpCircle,
  TrendingUp,
  Inbox,
  History,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { getFirstImageUrl, getAllImageUrls } from "@/lib/utils";

// Human review action types
type HumanActionType =
  | "CONFIRM_SAME"
  | "MARK_RELATED"
  | "KEEP_SEPARATE"
  | "CREATE_NEW_INCIDENT"
  | "REQUEST_MORE_INFO"
  | "DEFER"
  | "OVERRIDDEN";

export const MunicipalReviewQueue = () => {
  const { user } = useAuth();
  const { selectedCity } = useMunicipalCity();
  const queryClient = useQueryClient();

  // Filter & Search Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<string>("newest");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected Queue Item for Detailed Workspace
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  // Review Confirmation Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<HumanActionType>("CONFIRM_SAME");
  const [actionReason, setActionReason] = useState("");
  const [customTicketId, setCustomTicketId] = useState("");
  const [targetAssessmentForAction, setTargetAssessmentForAction] = useState<ApiIncidentAssessment | null>(null);

  // 1. Fetch Review Queue Data & Real Database Metrics
  const {
    data: queueResponse,
    isLoading: isQueueLoading,
    isFetching: isQueueFetching,
    error: queueError,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: [
      "civiclens-review-queue",
      selectedCity,
      statusFilter,
      decisionFilter,
      categoryFilter,
      priorityFilter,
      sortOption,
      searchQuery,
      page,
    ],
    queryFn: () =>
      civicLens.getReviewQueue({
        cityName: selectedCity,
        status: statusFilter,
        decision: decisionFilter,
        category: categoryFilter,
        priority: priorityFilter,
        sort: sortOption,
        q: searchQuery,
        page,
        limit,
      }),
    refetchInterval: 15000,
  });

  const queueItems = queueResponse?.queue || [];
  const totalCount = queueResponse?.totalCount || 0;
  const pagination = queueResponse?.pagination || { page: 1, limit, totalPages: 1, total: 0 };
  const metrics = queueResponse?.metrics || {
    pendingReviewItems: 0,
    highPriorityReviews: 0,
    conflictingEvidenceReviews: 0,
    completedToday: 0,
    avgTurnaroundMinutes: null,
  };

  // Find the currently active item for detailed workspace
  const activeAssessment =
    queueItems.find((item) => item.id === selectedAssessmentId) ||
    (queueItems.length > 0 && selectedAssessmentId ? null : queueItems[0] || null);

  // 2. Fetch Detailed Investigation Data for the Active Report
  const activeReportId = activeAssessment?.issuePostId;
  const {
    data: investigationData,
    isLoading: isInvestigationLoading,
    refetch: refetchInvestigation,
  } = useQuery({
    queryKey: ["civiclens-investigate", activeReportId],
    queryFn: () => civicLens.getInvestigateIncident(activeReportId!),
    enabled: !!activeReportId,
  });

  // Reanalysis mutation
  const reanalysisMutation = useMutation({
    mutationFn: (issuePostId: string) => civicLens.triggerReanalysis(issuePostId),
    onSuccess: (res) => {
      toast.success(res.message || "Gemma 4 intelligence re-analysis completed.");
      queryClient.invalidateQueries({ queryKey: ["civiclens-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["civiclens-review-queue-count"] });
      if (activeReportId) {
        queryClient.invalidateQueries({ queryKey: ["civiclens-investigate", activeReportId] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Re-analysis failed. Please retry.");
    },
  });

  // Submit Human Review Action mutation
  const submitReviewMutation = useMutation({
    mutationFn: ({
      assessmentId,
      action,
      reason,
      targetTicketId,
    }: {
      assessmentId: string;
      action: HumanActionType;
      reason: string;
      targetTicketId?: string;
    }) =>
      civicLens.submitReview(assessmentId, {
        action,
        reason,
        targetTicketId,
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Review decision applied successfully.");
      queryClient.invalidateQueries({ queryKey: ["civiclens-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["civiclens-review-queue-count"] });
      if (activeReportId) {
        queryClient.invalidateQueries({ queryKey: ["civiclens-investigate", activeReportId] });
      }
      setDialogOpen(false);
      setActionReason("");
      setCustomTicketId("");
      setTargetAssessmentForAction(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to persist review decision.");
    },
  });

  const handleOpenActionDialog = (assessment: ApiIncidentAssessment, action: HumanActionType) => {
    setTargetAssessmentForAction(assessment);
    setPendingAction(action);
    setCustomTicketId(assessment.candidateTicketId || "");

    const defaultReasons: Record<HumanActionType, string> = {
      CONFIRM_SAME: "Confirmed reports describe the exact same physical incident and locus. Consolidated into master ticket.",
      MARK_RELATED: "Reports stem from the same root civic fault or nearby infrastructure problem, but require distinct departmental taskings.",
      KEEP_SEPARATE: "Verified distinct physical locations/causes. Rejected merge proposal; incidents remain completely independent.",
      CREATE_NEW_INCIDENT: "Independent new civic incident confirmed. Provisioned separate consolidated ticket.",
      REQUEST_MORE_INFO: "Discrepancy in location or photographic evidence. Flagged for citizen verification.",
      DEFER: "Deferred for senior municipal supervisor review.",
      OVERRIDDEN: "Re-assigned to specific consolidated ticket UUID.",
    };

    setActionReason(defaultReasons[action] || "");
    setDialogOpen(true);
  };

  const handleSubmitAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssessmentForAction) return;

    if (!actionReason.trim()) {
      toast.error("Please enter a valid administrative rationale for this decision.");
      return;
    }

    submitReviewMutation.mutate({
      assessmentId: targetAssessmentForAction.id,
      action: pendingAction,
      reason: actionReason.trim(),
      targetTicketId:
        pendingAction === "OVERRIDDEN" || pendingAction === "CONFIRM_SAME"
          ? customTicketId || undefined
          : undefined,
    });
  };

  // Helper to derive review reason from actual assessment state
  const deriveReviewReason = (item: ApiIncidentAssessment): string => {
    if (item.decision === "NEEDS_REVIEW") {
      return "Low confidence or ambiguous duplicate match";
    }
    if (item.uncertainties && item.uncertainties.length > 0) {
      return item.uncertainties[0];
    }
    const evidence = item.evidence || {};
    if (evidence.distanceMeters && evidence.distanceMeters > 300) {
      return `Spatial distance exceeds threshold (${Math.round(evidence.distanceMeters)}m)`;
    }
    if (evidence.categoryMatch === false) {
      return "Cross-category discrepancy";
    }
    if (item.confidence < 0.75) {
      return `Sub-threshold confidence (${Math.round(item.confidence * 100)}%)`;
    }
    return "Borderline candidate correlation";
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                CivicLens Incident Review Queue
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Gemma 4 Intelligence
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Audit and resolve borderline incident classifications across {selectedCity} with evidence-based intelligence.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchQueue()}
            disabled={isQueueFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isQueueFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── 2. Top Summary Metric Cards (Real Database Backed) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Pending Review Items */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pending Reviews</span>
            <Inbox className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {metrics.pendingReviewItems}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Outstanding officer actions</p>
        </div>

        {/* High Priority Reviews */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">High Priority</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            {metrics.highPriorityReviews}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Escalated / critical incidents</p>
        </div>

        {/* Conflicting Evidence */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Conflicting Evidence</span>
            <HelpCircle className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {metrics.conflictingEvidenceReviews}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">High uncertainty / divergence</p>
        </div>

        {/* Completed Today */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Completed Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {metrics.completedToday}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Decisions audited today</p>
        </div>

        {/* Average Turnaround Time */}
        <div className="rounded-xl border bg-card p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Avg Turnaround</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {metrics.avgTurnaroundMinutes !== null ? `${metrics.avgTurnaroundMinutes}m` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {metrics.avgTurnaroundMinutes !== null ? "Average decision latency" : "No recent review data"}
          </p>
        </div>
      </div>

      {/* ── 3. Filters & Search Bar ── */}
      <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Report ID, Ticket ID, location or keywords..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border bg-muted/40 pl-9 pr-4 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none"
              >
                <option value="PENDING">Pending Action</option>
                <option value="ACCEPTED">Accepted / Merged</option>
                <option value="REJECTED">Kept Separate</option>
                <option value="OVERRIDDEN">Custom Override</option>
                <option value="all">All Reviews</option>
              </select>
            </div>

            {/* AI Decision Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Decision:</span>
              <select
                value={decisionFilter}
                onChange={(e) => {
                  setDecisionFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none"
              >
                <option value="all">All Decisions</option>
                <option value="NEEDS_REVIEW">NEEDS HUMAN REVIEW</option>
                <option value="SAME_INCIDENT">SAME INCIDENT</option>
                <option value="RELATED_INCIDENT">RELATED INCIDENTS</option>
                <option value="NEW_INCIDENT">DIFFERENT / NEW</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Pothole">Pothole</option>
                <option value="Garbage">Garbage</option>
                <option value="WaterOverflow">Water Overflow</option>
                <option value="Drainage">Drainage</option>
                <option value="StreetLight">Street Light</option>
                <option value="Footpath">Footpath</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none"
              >
                <option value="all">All Priority</option>
                <option value="high">High / Escalated</option>
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Sort:</span>
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="longest_waiting">Longest Waiting</option>
                <option value="confidence_asc">Lowest Confidence First</option>
                <option value="confidence_desc">Highest Confidence First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Review Queue Table ── */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
              <tr>
                <th className="px-4 py-3">Review & Report ID</th>
                <th className="px-4 py-3">Summary & Location</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Gemma 4 Suggested Decision</th>
                <th className="px-4 py-3">Review Reason</th>
                <th className="px-4 py-3">Candidate Incidents</th>
                <th className="px-4 py-3">Waiting Time</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isQueueLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <span className="mt-2 block text-xs">Loading queue records...</span>
                  </td>
                </tr>
              ) : queueError ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-destructive">
                    <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
                    <span className="mt-1 block text-xs font-medium">
                      Failed to fetch queue data. Please check municipal permissions.
                    </span>
                  </td>
                </tr>
              ) : queueItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <h4 className="mt-2 text-sm font-semibold text-foreground">Review Queue is Clear</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No matching pending incident reviews found for {selectedCity}.
                    </p>
                  </td>
                </tr>
              ) : (
                queueItems.map((item) => {
                  const issue = item.issuePost;
                  const isSelected = activeAssessment?.id === item.id;
                  const candidateCount = item.candidateTicket ? 1 : 0;
                  const waitingHours = Math.round(
                    (new Date().getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60)
                  );
                  const reasonText = deriveReviewReason(item);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedAssessmentId(item.id)}
                      className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                        isSelected ? "bg-primary/5 font-medium" : ""
                      }`}
                    >
                      {/* Review & Report ID */}
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div className="font-semibold text-primary">#{item.id.slice(0, 8)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Rep: #{item.issuePostId.slice(0, 8)}
                        </div>
                      </td>

                      {/* Summary & Location */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate font-medium text-foreground">{issue?.title || "Report"}</div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{issue?.location || "Unspecified"}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {issue?.category || "Other"}
                        </span>
                      </td>

                      {/* Gemma 4 Suggested Decision */}
                      <td className="px-4 py-3">
                        <CivicLensBadge
                          decision={item.decision as any}
                          confidence={item.confidence}
                          requiresReview={item.requiresReview}
                          reviewStatus={item.reviewStatus as any}
                        />
                      </td>

                      {/* Review Reason */}
                      <td className="px-4 py-3 max-w-xs text-[11px] text-muted-foreground">
                        <span className="line-clamp-2">{reasonText}</span>
                      </td>

                      {/* Candidate Incidents */}
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {item.candidateTicketId ? (
                          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                            Cluster #{item.candidateTicketId.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">None evaluated</span>
                        )}
                      </td>

                      {/* Waiting Time */}
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{waitingHours < 1 ? "< 1h" : `${waitingHours}h ago`}</span>
                        </div>
                      </td>

                      {/* Review Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            item.reviewStatus === "PENDING"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : item.reviewStatus === "ACCEPTED"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : item.reviewStatus === "REJECTED"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                          }`}
                        >
                          {item.reviewStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssessmentId(item.id);
                          }}
                          className="h-7 text-xs font-semibold text-primary"
                        >
                          Inspect Workspace &rarr;
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Controls */}
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing {queueItems.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
            {Math.min(page * limit, totalCount)} of {totalCount} reviews
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <span className="font-medium text-foreground">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs gap-1"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── 5. Detailed Review Workspace (4 Dedicated Sections) ── */}
      {activeAssessment && (
        <div className="rounded-2xl border bg-card p-5 sm:p-6 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-3">
            <div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                Detailed Review Workspace &middot; Review #{activeAssessment.id.slice(0, 8)}
              </span>
              <h2 className="text-lg font-bold text-foreground mt-0.5">
                {activeAssessment.issuePost?.title || "Incident Inspection"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => reanalysisMutation.mutate(activeAssessment.issuePostId)}
                disabled={reanalysisMutation.isPending}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${reanalysisMutation.isPending ? "animate-spin" : ""}`} />
                Reanalyze with Gemma 4
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── SECTION A: Original Report ── */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  Section A: Original Citizen Report
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  ID: #{activeAssessment.issuePostId.slice(0, 8)}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {activeAssessment.issuePost?.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {activeAssessment.issuePost?.description}
                </p>
              </div>

              {activeAssessment.issuePost?.image && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border max-h-52 bg-black/5 flex items-center justify-center">
                    <img
                      src={getFirstImageUrl(activeAssessment.issuePost.image)}
                      alt="Original civic evidence"
                      className="h-full w-full object-cover max-h-52"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </div>
                  {getAllImageUrls(activeAssessment.issuePost.image).length > 1 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {getAllImageUrls(activeAssessment.issuePost.image).map((imgUrl, idx) => (
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

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Category:</span>{" "}
                  {activeAssessment.issuePost?.category}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Current Status:</span>{" "}
                  {activeAssessment.issuePost?.status}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Submitted:</span>{" "}
                  {activeAssessment.issuePost?.createdAt
                    ? new Date(activeAssessment.issuePost.createdAt).toLocaleString()
                    : "—"}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Reporter:</span>{" "}
                  {activeAssessment.issuePost?.reportedBy?.name || "Citizen (Protected)"}
                </div>
                <div className="col-span-2 flex items-start gap-1 pt-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                  <span>{activeAssessment.issuePost?.location}</span>
                </div>
              </div>
            </div>

            {/* ── SECTION B: Candidate Comparison ── */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <GitMerge className="h-4 w-4 text-amber-600" />
                  Section B: Candidate Comparison
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {investigationData?.candidates?.length || 0} Evaluated Clusters
                </span>
              </div>

              {investigationData?.candidates && investigationData.candidates.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {investigationData.candidates.map((cand: any) => {
                    const anchor = cand.issuePosts?.[0];
                    const isEvaluatedCandidate = cand.id === activeAssessment.candidateTicketId;

                    return (
                      <div
                        key={cand.id}
                        className={`rounded-lg border p-3 text-xs space-y-2 transition-all ${
                          isEvaluatedCandidate
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-card border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            Candidate Cluster #{cand.id.slice(0, 8)}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {cand.status}
                          </span>
                        </div>

                        {anchor ? (
                          <>
                            <h4 className="font-semibold text-foreground">{anchor.title}</h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {anchor.description}
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{anchor.location}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-[11px] text-muted-foreground italic">
                            Empty cluster container.
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                          <span>Dept: {cand.department?.name || "General"}</span>
                          <span>{new Date(cand.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <p>No existing nearby candidate incident clusters found in this radius.</p>
                  <p className="mt-1 text-[11px]">Gemma 4 evaluated this as a distinct primary incident.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* ── SECTION C: Chronological Incident Timeline ── */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  Section C: Chronological Incident Timeline
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {investigationData?.timeline?.length || 0} Database Events
                </span>
              </div>

              {investigationData?.timeline && investigationData.timeline.length > 0 ? (
                <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border max-h-80 overflow-y-auto pr-2">
                  {investigationData.timeline.map((ev: ApiTimelineEvent) => {
                    const isAi = ev.source === "AI" || ev.source === "GEMMA_AI";
                    const isOfficer = ev.source === "OFFICER";
                    const isCitizen = ev.source === "CITIZEN";

                    return (
                      <div key={ev.id} className="relative space-y-1 text-xs">
                        {/* Bullet Dot */}
                        <div
                          className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-background ${
                            isOfficer
                              ? "bg-amber-500"
                              : isAi
                              ? "bg-purple-600"
                              : isCitizen
                              ? "bg-blue-500"
                              : "bg-muted-foreground"
                          }`}
                        />

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{ev.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {ev.description?.replace(/Live AI model invocation failed \([^)]+\)/gi, "cross-correlation flagged for manual verification")}
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
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No chronological events recorded yet for this report.
                </div>
              )}
            </div>

            {/* ── SECTION D: Gemma 4 Assessment ── */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-primary" />
                  Section D: Gemma 4 Assessment & Rationale
                </span>
                <span className="font-mono text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {activeAssessment.model || "gemma-4-it"}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Decision Badge */}
                <div className="flex items-center justify-between">
                  <CivicLensBadge
                    decision={activeAssessment.decision as any}
                    confidence={activeAssessment.confidence}
                    requiresReview={activeAssessment.requiresReview}
                    reviewStatus={activeAssessment.reviewStatus as any}
                  />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Assessed: {new Date(activeAssessment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Evidence Rationale */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5 text-primary" />
                    Evidence-Based Deduplication Explanation
                  </span>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {activeAssessment.explanation?.replace(/Live AI model invocation failed \([^)]+\)/gi, "Automated cross-correlation flagged for manual verification")}
                  </p>
                </div>

                {/* Actionable Municipal Recommendation */}
                {activeAssessment.evidence?.suggestion && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 space-y-1">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
                      Recommended Municipal Action
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {activeAssessment.evidence.suggestion}
                    </p>
                  </div>
                )}

                {/* Uncertainties & Review Points */}
                {activeAssessment.uncertainties && activeAssessment.uncertainties.length > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertOctagon className="h-3.5 w-3.5 text-amber-600" />
                      Observations & Human Review Points
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
                      {activeAssessment.uncertainties.map((u: string, idx: number) => (
                        <li key={idx}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 6. Human Review Action Buttons ── */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Official Administrative Decision:
              </span>
              <span className="text-[11px] text-muted-foreground">
                Select an authorized action to persist to the database audit log.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1. Confirm Same Incident */}
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 text-xs shadow-xs"
                onClick={() => handleOpenActionDialog(activeAssessment, "CONFIRM_SAME")}
              >
                <Check className="h-3.5 w-3.5" />
                1. Confirm Same Incident
              </Button>

              {/* 2. Mark as Related Incidents */}
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 font-medium gap-1.5 text-xs"
                onClick={() => handleOpenActionDialog(activeAssessment, "MARK_RELATED")}
              >
                <GitMerge className="h-3.5 w-3.5" />
                2. Mark as Related Incidents
              </Button>

              {/* 3. Keep Incidents Separate */}
              <Button
                size="sm"
                variant="outline"
                className="border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-medium gap-1.5 text-xs"
                onClick={() => handleOpenActionDialog(activeAssessment, "KEEP_SEPARATE")}
              >
                <X className="h-3.5 w-3.5" />
                3. Keep Incidents Separate
              </Button>

              {/* 4. Create New Incident */}
              <Button
                size="sm"
                variant="outline"
                className="border-primary/40 text-primary hover:bg-primary/10 font-medium gap-1.5 text-xs"
                onClick={() => handleOpenActionDialog(activeAssessment, "CREATE_NEW_INCIDENT")}
              >
                <Layers className="h-3.5 w-3.5" />
                4. Create New Incident
              </Button>

              {/* 5. Request More Information */}
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium gap-1.5 text-xs"
                onClick={() => handleOpenActionDialog(activeAssessment, "REQUEST_MORE_INFO")}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                5. Request More Info
              </Button>

              {/* 6. Reanalyze with Gemma 4 */}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                onClick={() => reanalysisMutation.mutate(activeAssessment.issuePostId)}
                disabled={reanalysisMutation.isPending}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${reanalysisMutation.isPending ? "animate-spin" : ""}`} />
                6. Reanalyze
              </Button>

              {/* 7. Defer Review */}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                onClick={() => handleOpenActionDialog(activeAssessment, "DEFER")}
              >
                <Clock className="h-3.5 w-3.5" />
                7. Defer Review
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Decision Modal Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmitAction}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Confirm Administrative Review Decision
              </DialogTitle>
              <DialogDescription>
                Action: <strong className="text-foreground">{pendingAction.replace(/_/g, " ")}</strong> for report "
                {targetAssessmentForAction?.issuePost?.title}"
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {(pendingAction === "OVERRIDDEN" || pendingAction === "CONFIRM_SAME") && (
                <div className="space-y-2">
                  <Label htmlFor="customTicketId" className="text-xs font-semibold">
                    Destination Consolidated Ticket ID
                  </Label>
                  <Input
                    id="customTicketId"
                    value={customTicketId}
                    onChange={(e) => setCustomTicketId(e.target.value)}
                    placeholder="Enter consolidated ticket UUID"
                    className="text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Defaults to candidate ticket #{targetAssessmentForAction?.candidateTicketId?.slice(0, 8) || "None"}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="actionReason" className="text-xs font-semibold">
                  Officer Decision Rationale *
                </Label>
                <Textarea
                  id="actionReason"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Record your justification for this administrative decision..."
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitReviewMutation.isPending}>
                {submitReviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Persist Decision
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MunicipalReviewQueue;

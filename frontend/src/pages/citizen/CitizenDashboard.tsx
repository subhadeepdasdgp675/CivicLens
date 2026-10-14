import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket, SOCKET_EVENTS } from "@/contexts/SocketContext";
import { issues as issuesApi, type ApiIssue, type ApiPagination, CATEGORY_DISPLAY } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  ThumbsUp,
  PlusCircle,
  MapPin,
  MessageSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Search,
  Eye,
  Flame,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn, getFirstImageUrl } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const CitizenDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [allIssues, setAllIssues] = useState<ApiIssue[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [myIssues, setMyIssues] = useState<ApiIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [category, setCategory] = useState("All Categories");
  const [currentPage, setCurrentPage] = useState(1);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [upvoteCounts, setUpvoteCounts] = useState<Record<string, number>>({});

  const handleUpvote = async (e: React.MouseEvent, issueId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const wasUpvoted = upvotedIds.has(issueId);
    const prevCount = upvoteCounts[issueId] ?? 0;

    // Optimistic update
    setUpvotedIds((prev) => {
      const next = new Set(prev);
      wasUpvoted ? next.delete(issueId) : next.add(issueId);
      return next;
    });
    setUpvoteCounts((prev) => ({ ...prev, [issueId]: wasUpvoted ? prevCount - 1 : prevCount + 1 }));

    try {
      const res = await issuesApi.upvote(issueId);
      if (res.upvoted !== !wasUpvoted) {
        setUpvotedIds((prev) => {
          const next = new Set(prev);
          res.upvoted ? next.add(issueId) : next.delete(issueId);
          return next;
        });
        setUpvoteCounts((prev) => ({ ...prev, [issueId]: res.upvoted ? prevCount + 1 : prevCount - 1 }));
      }
      toast({ title: res.upvoted ? "Issue upvoted!" : "Upvote removed" });
    } catch {
      // Revert
      setUpvotedIds((prev) => {
        const next = new Set(prev);
        wasUpvoted ? next.add(issueId) : next.delete(issueId);
        return next;
      });
      setUpvoteCounts((prev) => ({ ...prev, [issueId]: prevCount }));
      toast({ title: "Failed to upvote", variant: "destructive" });
    }
  };

  const handleCommentClick = (e: React.MouseEvent, issueId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/dashboard/issue/${issueId}#comments`);
  };

  const loadDashboardData = useCallback(() => {
    if (!user) return;
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      page: "1",
    };
    if (user.cityId) params.cityId = user.cityId;

    Promise.all([
      issuesApi.list(params),
      issuesApi.byUser(user.id, { limit: "100" }),
    ])
      .then(([cityRes, myRes]) => {
        setAllIssues(cityRes.issues);
        setPagination(cityRes.pagination);
        setMyIssues(myRes.issues);
        setCurrentPage(1);
        const counts: Record<string, number> = {};
        cityRes.issues.forEach((i: ApiIssue) => { counts[i.id] = i._count?.upvotes ?? 0; });
        setUpvoteCounts((prev) => ({ ...prev, ...counts }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // When tab/window regains focus or navigates back, re-sync to ensure metrics are 100% accurate
  useEffect(() => {
    const handleFocus = () => loadDashboardData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadDashboardData]);

  useEffect(() => {
    if (!socket) return;
    const handleNewIssue = (issue: ApiIssue) => {
      // If reported by the current user, immediately prepend to myIssues so numbers increment dynamically!
      const isMine =
        user &&
        (issue.reportedBy?.id === user.id ||
          (issue as any).reportedById === user.id ||
          (issue as any).userId === user.id);

      if (isMine) {
        setMyIssues((prev) => {
          if (prev.some((i) => i.id === issue.id)) return prev;
          return [issue, ...prev];
        });
      }

      // Add to public feed if on page 1 and matching category filter
      if (currentPage === 1 && (category === "All Categories" || category === issue.category)) {
        setAllIssues((prev) => {
          if (prev.some((i) => i.id === issue.id)) return prev;
          return [issue, ...prev].slice(0, PAGE_SIZE);
        });
      }

      setUpvoteCounts((prev) => ({
        ...prev,
        [issue.id]: issue._count?.upvotes ?? 0,
      }));
    };

    const handleStatusChanged = (data: { issueIds?: string[]; ticketId?: string; status: string }) => {
      if (!data.status) return;
      const targetIds = data.issueIds || (data.ticketId ? [data.ticketId] : []);
      // Update my issues status dynamically
      setMyIssues((prev) =>
        prev.map((i) => (targetIds.length === 0 || targetIds.includes(i.id) ? { ...i, status: data.status } : i))
      );
      // Update feed issues list
      setAllIssues((prev) =>
        prev.map((i) => (targetIds.length === 0 || targetIds.includes(i.id) ? { ...i, status: data.status } : i))
      );
    };

    socket.on(SOCKET_EVENTS.ISSUE_CREATED, handleNewIssue);
    socket.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);
    return () => {
      socket.off(SOCKET_EVENTS.ISSUE_CREATED, handleNewIssue);
      socket.off(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);
    };
  }, [socket, currentPage, category, user]);

  const fetchPage = useCallback(
    async (page: number, cat: string) => {
      if (!user) return;
      setPageLoading(true);
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
        page: String(page),
      };
      if (user.cityId) params.cityId = user.cityId;
      if (cat !== "All Categories") {
        const apiCat = Object.entries(CATEGORY_DISPLAY).find(([, v]) => v === cat)?.[0] ?? cat;
        params.category = apiCat;
      }
      try {
        const res = await issuesApi.list(params);
        setAllIssues(res.issues);
        setPagination(res.pagination);
        setCurrentPage(page);
        const counts: Record<string, number> = {};
        res.issues.forEach((i: ApiIssue) => { counts[i.id] = i._count?.upvotes ?? 0; });
        setUpvoteCounts((prev) => ({ ...prev, ...counts }));
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user || loading) return;
    fetchPage(1, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const resolvedCount = myIssues.filter((i) => i.status === "Resolved").length;
  const pendingCount = myIssues.filter((i) => i.status === "Pending").length;
  const ongoingCount = myIssues.filter((i) => i.status === "Ongoing").length;
  const escalatedCount = myIssues.filter((i) => i.status === "Escalated").length;
  const totalUpvotes = myIssues.reduce((sum, i) => sum + (i._count?.upvotes ?? 0), 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <div className="civic-container civic-section flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="civic-container civic-section">
      {/* ── Hero greeting with quick actions ── */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {greeting()}, {user?.name?.split(" ")[0]}!
          </h1>
          <p className="mt-2 text-body text-muted-foreground">
            Here's what's happening in <span className="font-medium text-foreground">{user?.city || "your city"}</span> today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/report">
            <Button className="gap-2 shadow-sm">
              <PlusCircle className="h-4 w-4" /> Report Issue
            </Button>
          </Link>
          <Link to="/dashboard/search">
            <Button variant="outline" className="gap-2">
              <Search className="h-4 w-4" /> Search
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconBg="bg-emerald-100 text-emerald-600"
          label="Resolved"
          value={resolvedCount}
          sub="Issues closed"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          iconBg="bg-amber-100 text-amber-600"
          label="Pending"
          value={pendingCount}
          sub="Awaiting action"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-blue-100 text-blue-600"
          label="In Progress"
          value={ongoingCount}
          sub="Being worked on"
        />
        <StatCard
          icon={<ThumbsUp className="h-5 w-5" />}
          iconBg="bg-purple-100 text-purple-600"
          label="Community Impact"
          value={totalUpvotes}
          sub="Upvotes received"
        />
      </div>

      {/* ── Escalated alert banner ── */}
      {escalatedCount > 0 && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-body text-foreground">
            <span className="font-semibold">{escalatedCount} of your reports</span> have been escalated and need attention.
          </p>
          <Link to="/dashboard/search" className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
              View <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Issues feed */}
        <div className="lg:col-span-2">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">Issues Around You</h2>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-44 text-caption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["All Categories", "Garbage", "Pothole", "Water Overflow", "Street Light", "Drainage", "Footpath"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pageLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : allIssues.length > 0 ? (
            <>
              <div className="space-y-4">
                {allIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/dashboard/issue/${issue.id}`}
                    className="group flex gap-0 overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30"
                  >
                    {/* Image */}
                    <div className="relative w-36 sm:w-48 shrink-0 overflow-hidden bg-muted">
                      <img
                        src={getFirstImageUrl(issue.image)}
                        alt={issue.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to placeholder if broken
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3">
                        <StatusBadge status={issue.status} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full border bg-secondary px-2.5 py-0.5 text-label font-medium text-secondary-foreground">
                            {CATEGORY_DISPLAY[issue.category] || issue.category}
                          </span>
                          <span className="text-label text-muted-foreground">
                            {getRelativeTime(issue.createdAt)}
                          </span>
                        </div>
                        <h3 className="mb-1.5 text-body font-semibold text-foreground group-hover:text-primary transition-colors">
                          {issue.title}
                        </h3>
                        <p className="mb-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary/60" />
                          {issue.location}
                        </p>
                        <p className="line-clamp-2 text-caption text-muted-foreground/80">
                          {issue.description}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3">
                        <div className="flex items-center gap-4 text-caption">
                          <button
                            onClick={(e) => handleUpvote(e, issue.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors",
                              upvotedIds.has(issue.id)
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <ThumbsUp className={cn("h-3.5 w-3.5", upvotedIds.has(issue.id) && "fill-current")} />
                            {upvoteCounts[issue.id] ?? issue._count?.upvotes ?? 0}
                          </button>
                          <button
                            onClick={(e) => handleCommentClick(e, issue.id)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> {issue._count?.comments ?? 0}
                          </button>
                        </div>
                        <span className="flex items-center gap-1 text-caption font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          View Details <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-caption text-muted-foreground">
                    Page {currentPage} of {pagination.totalPages} &middot; {pagination.total} issues
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1 || pageLoading}
                      onClick={() => fetchPage(currentPage - 1, category)}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= pagination.totalPages || pageLoading}
                      onClick={() => fetchPage(currentPage + 1, category)}
                      className="gap-1"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border bg-card py-16 text-center">
              <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-body text-muted-foreground">No issues found in your city yet.</p>
              <Link to="/dashboard/report">
                <Button className="mt-4 gap-2">
                  <PlusCircle className="h-4 w-4" /> Be the first to report
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-6">
          {/* CTA card */}
          <div className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground">
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/5" />
            <div className="relative">
              <h3 className="mb-2 text-lg font-bold">See something wrong?</h3>
              <p className="mb-4 text-caption text-primary-foreground/80">
                Report civic issues in your area and help make your city better.
              </p>
              <Link to="/dashboard/report">
                <Button variant="secondary" className="w-full gap-2 bg-card text-foreground hover:bg-card/90 shadow-sm">
                  <PlusCircle className="h-4 w-4" />
                  Report an Issue
                </Button>
              </Link>
            </div>
          </div>

          {/* Your recent reports */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-body font-semibold text-foreground">Your Recent Reports</h3>
              <Link to="/dashboard/profile" className="text-caption font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            {myIssues.length > 0 ? (
              <div className="space-y-3">
                {myIssues.slice(0, 4).map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/dashboard/issue/${issue.id}`}
                    className="group flex items-start gap-3 rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="mt-0.5 relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {issue.image ? (
                        <img
                          src={getFirstImageUrl(issue.image)}
                          alt={issue.title}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-caption font-medium text-foreground group-hover:text-primary transition-colors">
                        {issue.title}
                      </p>
                      <p className="text-label text-muted-foreground">
                        {getRelativeTime(issue.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={issue.status} className="text-[10px] shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-caption text-muted-foreground">
                No reports yet. Start by reporting an issue!
              </p>
            )}
          </div>

          {/* Trending in city */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4 text-destructive" />
              <h3 className="text-body font-semibold text-foreground">Trending in {user?.city || "Your City"}</h3>
            </div>
            {allIssues.length > 0 ? (
              <div className="space-y-3">
                {[...allIssues]
                  .sort((a, b) => (b._count?.upvotes ?? 0) - (a._count?.upvotes ?? 0))
                  .slice(0, 3)
                  .map((issue, idx) => (
                    <Link
                      key={issue.id}
                      to={`/dashboard/issue/${issue.id}`}
                      className="group flex items-start gap-3 rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-label font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-caption font-medium text-foreground group-hover:text-primary transition-colors">
                          {issue.title}
                        </p>
                        <p className="flex items-center gap-2 text-label text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <ThumbsUp className="h-3 w-3" /> {issue._count?.upvotes ?? 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3" /> {issue._count?.comments ?? 0}
                          </span>
                        </p>
                      </div>
                    </Link>
                  ))}
              </div>
            ) : (
              <p className="py-4 text-center text-caption text-muted-foreground">
                No trending issues yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Stat card component ── */
function StatCard({ icon, iconBg, label, value, sub }: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="group rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20">
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
        <div>
          <p className="text-label font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-label text-muted-foreground/70">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "1 day ago";
  if (diffD < 7) return `${diffD} days ago`;
  if (diffD < 14) return "1 week ago";
  return `${Math.floor(diffD / 7)} weeks ago`;
}

export default CitizenDashboard;

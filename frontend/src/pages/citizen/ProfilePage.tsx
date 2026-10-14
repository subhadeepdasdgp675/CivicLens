import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket, SOCKET_EVENTS } from "@/contexts/SocketContext";
import { issues as issuesApi, CATEGORY_DISPLAY, type ApiIssue, type ApiPagination } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, FileText, ThumbsUp, MessageSquare, Search, PlusCircle, ChevronLeft, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFirstImageUrl } from "@/lib/utils";

const PAGE_SIZE = 10;

const ProfilePage = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [myIssues, setMyIssues] = useState<ApiIssue[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  // Stats: fetched once on mount (total/resolved/upvotes)
  const [totalCount, setTotalCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalUpvotes, setTotalUpvotes] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upvoted issues state
  const [upvotedIssues, setUpvotedIssues] = useState<ApiIssue[]>([]);
  const [upvotedLoading, setUpvotedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("reported");

  const fetchUpvotedIssues = useCallback(async () => {
    if (!user) return;
    setUpvotedLoading(true);
    try {
      const res = await issuesApi.upvoted();
      setUpvotedIssues(res.issues);
    } catch (err) {
      console.error("Failed to fetch upvoted issues:", err);
    } finally {
      setUpvotedLoading(false);
    }
  }, [user]);

  // Fetch upvoted issues when tab switches to "upvoted"
  useEffect(() => {
    if (activeTab === "upvoted") fetchUpvotedIssues();
  }, [activeTab, fetchUpvotedIssues]);

  const statusColors: Record<string, string> = { Pending: "bg-amber-500", Ongoing: "bg-orange-500", Resolved: "bg-emerald-500", Escalated: "bg-red-500" };

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Load first page + stat totals on mount
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Fetch first page + a small "all" fetch just for stats (max 100, fast)
    Promise.all([
      issuesApi.byUser(user.id, { page: "1", limit: String(PAGE_SIZE) }),
      issuesApi.byUser(user.id, { limit: "100" }),
    ])
      .then(([pageRes, allRes]) => {
        setMyIssues(pageRes.issues);
        setPagination(pageRes.pagination ?? null);
        setTotalCount(pageRes.pagination?.total ?? pageRes.issues.length);
        const all = allRes.issues;
        setResolvedCount(all.filter((i) => i.status === "Resolved").length);
        setTotalUpvotes(all.reduce((s, i) => s + (i._count?.upvotes ?? 0), 0));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // Real-time status update from Admin or Department
  useEffect(() => {
    if (!socket || !user) return;
    const handleStatusChanged = (data: { issueIds?: string[]; status: string }) => {
      if (!data.status) return;
      const targetIds = data.issueIds || [];
      setMyIssues((prev) =>
        prev.map((i) => (targetIds.includes(i.id) ? { ...i, status: data.status } : i))
      );
      if (data.status === "Resolved") {
        setResolvedCount((prev) => prev + 1);
      }
    };
    socket.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);
    return () => {
      socket.off(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);
    };
  }, [socket, user]);

  const fetchPage = useCallback(async (page: number, q: string, status: string) => {
    if (!user) return;
    setPageLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (q.trim()) params.search = q.trim();
    if (status !== "All Status") params.status = status;
    try {
      const res = await issuesApi.byUser(user.id, params);
      setMyIssues(res.issues);
      setPagination(res.pagination ?? null);
      setCurrentPage(page);
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  // Re-fetch when filters change
  useEffect(() => {
    if (loading) return;
    fetchPage(1, debouncedSearch, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter]);

  if (loading) {
    return <div className="civic-container civic-section flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="civic-container civic-section">
      {/* Profile header */}
      <div className="mb-8 flex flex-wrap items-center gap-6 rounded-xl border bg-card p-6">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-h2 font-semibold text-muted-foreground">{user?.name?.charAt(0)}</div>
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><CheckCircle className="h-3.5 w-3.5" /></div>
        </div>
        <div className="flex-1">
          <h1 className="text-h3 text-foreground">{user?.name}</h1>
          <p className="flex items-center gap-1 text-caption text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{user?.city}</p>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-label font-medium text-accent-foreground">Active Citizen</span>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto sm:flex-nowrap sm:gap-4">
          <div className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-center sm:flex-none sm:px-6">
            <p className="truncate text-caption text-muted-foreground">Issues Reported</p>
            <p className="text-h3 text-primary">{totalCount}</p>
          </div>
          <div className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-center sm:flex-none sm:px-6">
            <p className="truncate text-caption text-muted-foreground">Resolved</p>
            <p className="text-h3 text-foreground">{resolvedCount}</p>
          </div>
          <div className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-center sm:flex-none sm:px-6">
            <p className="truncate text-caption text-muted-foreground">Impact Score</p>
            <p className="text-h3 text-foreground">{totalUpvotes}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 h-auto gap-0 bg-transparent p-0 border-b rounded-none w-full justify-start">
              <TabsTrigger value="reported" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1.5 px-4 pb-3">
                <FileText className="h-4 w-4" /> My Reported Issues
              </TabsTrigger>
              <TabsTrigger value="upvoted" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1.5 px-4 pb-3">
                <ThumbsUp className="h-4 w-4" /> Upvoted Issues
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reported" forceMount className={activeTab !== "reported" ? "hidden" : ""}>
              <div className="mb-4 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search issues..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{["All Status", "Pending", "Ongoing", "Resolved", "Escalated"].map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                </Select>
              </div>

              {pageLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-4">
                  {myIssues.map((issue) => (
                    <div key={issue.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                      <div className="flex gap-0">
                        <div className="h-32 w-28 shrink-0 overflow-hidden bg-muted">
                          <img
                            src={getFirstImageUrl(issue.image)}
                            alt={issue.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-4">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <StatusBadge status={issue.status} />
                              <span className="text-label text-muted-foreground">Reported {getRelativeTime(issue.createdAt)}</span>
                            </div>
                            <h3 className="text-body font-semibold text-foreground">{issue.title}</h3>
                            <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">{issue.description}</p>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-caption text-muted-foreground">
                              <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {issue._count?.upvotes ?? 0}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {issue._count?.comments ?? 0}</span>
                              <span className="rounded-md border px-2 py-0.5 text-label">{CATEGORY_DISPLAY[issue.category] || issue.category}</span>
                            </div>
                            <Link to={`/dashboard/issue/${issue.id}`} className="text-caption font-medium text-primary hover:underline">View Details →</Link>
                          </div>
                        </div>
                      </div>
                      <div className={`h-1 ${statusColors[issue.status] || "bg-muted"}`} />
                    </div>
                  ))}
                  {myIssues.length === 0 && <p className="py-8 text-center text-muted-foreground">No issues found.</p>}
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-caption text-muted-foreground">
                    Page {currentPage} of {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1 || pageLoading} onClick={() => fetchPage(currentPage - 1, debouncedSearch, statusFilter)} className="gap-1">
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" disabled={currentPage >= pagination.totalPages || pageLoading} onClick={() => fetchPage(currentPage + 1, debouncedSearch, statusFilter)} className="gap-1">
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upvoted" forceMount className={activeTab !== "upvoted" ? "hidden" : ""}>
              {upvotedLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              ) : upvotedIssues.length > 0 ? (
                <div className="space-y-4">
                  {upvotedIssues.map((issue) => (
                    <div key={issue.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                      <div className="flex gap-0">
                        <div className="h-32 w-28 shrink-0 overflow-hidden bg-muted">
                          <img
                            src={getFirstImageUrl(issue.image)}
                            alt={issue.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-4">
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <StatusBadge status={issue.status} />
                              <span className="text-label text-muted-foreground">{getRelativeTime(issue.createdAt)}</span>
                            </div>
                            <h3 className="text-body font-semibold text-foreground">{issue.title}</h3>
                            <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">{issue.description}</p>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-caption text-muted-foreground">
                              <span className="flex items-center gap-1 text-primary"><ThumbsUp className="h-3.5 w-3.5 fill-current" /> {issue._count?.upvotes ?? 0}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {issue._count?.comments ?? 0}</span>
                            </div>
                            <Link to={`/dashboard/issue/${issue.id}`} className="text-caption font-medium text-primary hover:underline">View Details →</Link>
                          </div>
                        </div>
                      </div>
                      <div className={`h-1 ${statusColors[issue.status] || "bg-muted"}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border bg-card py-16 text-center">
                  <ThumbsUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-body text-muted-foreground">You haven't upvoted any issues yet.</p>
                  <p className="mt-1 text-caption text-muted-foreground">Browse issues and upvote the ones that matter to you.</p>
                  <Link to="/dashboard/search"><Button variant="outline" className="mt-4 gap-2"><Search className="h-4 w-4" /> Browse Issues</Button></Link>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl bg-primary p-6 text-primary-foreground">
            <h3 className="mb-2 text-body font-bold">Have a new issue?</h3>
            <p className="mb-4 text-caption text-primary-foreground/80">Report civic issues in your neighborhood and track their resolution.</p>
            <Link to="/dashboard/report">
              <Button variant="secondary" className="w-full gap-2 bg-card text-foreground hover:bg-card/90"><PlusCircle className="h-4 w-4" /> Report Issue</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

function getRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffD = Math.floor(diffMs / 86400000);
  if (diffD === 0) return "today";
  if (diffD === 1) return "1 day ago";
  if (diffD < 7) return `${diffD} days ago`;
  return `${Math.floor(diffD / 7)} weeks ago`;
}

export default ProfilePage;

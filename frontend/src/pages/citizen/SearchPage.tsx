import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { issues as issuesApi, CATEGORY_DISPLAY, CATEGORY_API_VALUE, type ApiIssue, type ApiPagination } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { Search, MapPin, ThumbsUp, MessageSquare, Users, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, getFirstImageUrl } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const categoryOptions = ["All Categories", "Garbage", "Pothole", "Water Overflow", "Street Light", "Drainage", "Footpath"];
const statusOptions = ["All Status", "Pending", "Ongoing", "Resolved", "Escalated"];
const PAGE_SIZE = 12;

const SearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState<ApiIssue[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [status, setStatus] = useState("All Status");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [upvoteCounts, setUpvoteCounts] = useState<Record<string, number>>({});

  const handleUpvote = async (e: React.MouseEvent, issueId: string) => {
    e.preventDefault(); e.stopPropagation();
    const wasUpvoted = upvotedIds.has(issueId);
    const prevCount = upvoteCounts[issueId] ?? 0;
    setUpvotedIds((prev) => { const next = new Set(prev); wasUpvoted ? next.delete(issueId) : next.add(issueId); return next; });
    setUpvoteCounts((prev) => ({ ...prev, [issueId]: wasUpvoted ? prevCount - 1 : prevCount + 1 }));
    try {
      const res = await issuesApi.upvote(issueId);
      if (res.upvoted !== !wasUpvoted) {
        setUpvotedIds((prev) => { const next = new Set(prev); res.upvoted ? next.add(issueId) : next.delete(issueId); return next; });
        setUpvoteCounts((prev) => ({ ...prev, [issueId]: res.upvoted ? prevCount + 1 : prevCount - 1 }));
      }
      toast({ title: res.upvoted ? "Issue upvoted!" : "Upvote removed" });
    } catch {
      setUpvotedIds((prev) => { const next = new Set(prev); wasUpvoted ? next.add(issueId) : next.delete(issueId); return next; });
      setUpvoteCounts((prev) => ({ ...prev, [issueId]: prevCount }));
      toast({ title: "Failed to upvote", variant: "destructive" });
    }
  };

  const handleCommentClick = (e: React.MouseEvent, issueId: string) => {
    e.preventDefault(); e.stopPropagation();
    navigate(`/dashboard/issue/${issueId}#comments`);
  };

  // Debounce the search input — only fire API after 350ms of no typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchIssues = useCallback(async (page: number) => {
    if (!user) return;
    setLoading(true);
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      page: String(page),
    };
    if (user.cityId) params.cityId = user.cityId;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (category !== "All Categories") {
      params.category = CATEGORY_API_VALUE[category] ?? category;
    }
    if (status !== "All Status") params.status = status;

    try {
      const res = await issuesApi.list(params);
      setIssues(res.issues);
      setPagination(res.pagination);
      setCurrentPage(page);
      const counts: Record<string, number> = {};
      res.issues.forEach((i: ApiIssue) => { counts[i.id] = i._count?.upvotes ?? 0; });
      setUpvoteCounts((prev) => ({ ...prev, ...counts }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, debouncedSearch, category, status]);

  // Re-fetch from page 1 whenever filters change
  useEffect(() => {
    fetchIssues(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category, status]);

  return (
    <div className="civic-container civic-section">
      <h1 className="mb-2 text-h2 font-bold text-foreground">Issues Around You</h1>
      <p className="mb-8 max-w-lg text-body text-muted-foreground">Browse civic issues reported by neighbors, upvote important problems, and track their resolution progress in real-time.</p>

      <div className="mb-8 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by keyword, street name, or location..." className="h-11 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 w-full md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{categoryOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-full md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : issues.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {issues.map((issue) => (
              <div key={issue.id} className="group overflow-hidden rounded-xl border bg-card shadow-sm civic-card-hover">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={getFirstImageUrl(issue.image)}
                    alt={issue.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                  <div className="absolute top-3 right-3"><StatusBadge status={issue.status} /></div>
                </div>
                <div className="p-5">
                  <h3 className="mb-1 text-body font-semibold text-foreground leading-snug">{issue.title}</h3>
                  <p className="mb-3 flex items-center gap-1 text-caption text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{issue.location}</p>
                  <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <span className="rounded-md border px-2 py-0.5 text-label text-muted-foreground">{CATEGORY_DISPLAY[issue.category] || issue.category}</span>
                    {issue.reporters > 1 && (<span className="flex items-center gap-1 text-label text-muted-foreground"><Users className="h-3 w-3" /> {issue.reporters} reporters</span>)}
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-4 text-caption">
                      <button
                        onClick={(e) => handleUpvote(e, issue.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors",
                          upvotedIds.has(issue.id) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    <Link to={`/dashboard/issue/${issue.id}`}><Button variant="outline" size="sm" className="text-caption">View Details</Button></Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <p className="text-caption text-muted-foreground">
                Page {currentPage} of {pagination.totalPages} &middot; {pagination.total} issues
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1 || loading} onClick={() => fetchIssues(currentPage - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage >= pagination.totalPages || loading} onClick={() => fetchIssues(currentPage + 1)} className="gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border bg-card py-16 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-body-lg text-muted-foreground">No issues match your search.</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;

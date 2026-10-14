import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket, SOCKET_EVENTS } from "@/contexts/SocketContext";
import { tickets as ticketsApi, CATEGORY_DISPLAY, type ApiTicket, type ApiTicketStats, type ApiPagination } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, CheckCircle, Clock, AlertTriangle, Package, Loader2, TrendingUp, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 15;

const DeptDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [allTickets, setAllTickets] = useState<ApiTicket[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState<ApiTicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");

  // Initial load: tickets page 1 + stats in parallel
  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: String(PAGE_SIZE), page: "1" };
    Promise.all([ticketsApi.list(params), ticketsApi.stats()])
      .then(([tRes, sRes]) => {
        setAllTickets(tRes.tickets);
        setPagination(tRes.pagination);
        setStats(sRes.stats);
        setCurrentPage(1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Real-time: update ticket status in the list when changed ──
  useEffect(() => {
    if (!socket) return;
    const handleStatusChanged = (data: { ticketId: string; status: string }) => {
      setAllTickets((prev) =>
        prev.map((t) => (t.id === data.ticketId ? { ...t, status: data.status } : t))
      );
      // Re-fetch stats to keep counts accurate
      ticketsApi.stats().then((s) => setStats(s.stats)).catch(() => {});
    };
    socket.on(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged);
    return () => { socket.off(SOCKET_EVENTS.TICKET_STATUS_CHANGED, handleStatusChanged); };
  }, [socket]);

  // Fetch a specific page with optional status filter (server-side)
  const fetchPage = useCallback(async (page: number, status: string) => {
    setPageLoading(true);
    const params: Record<string, string> = { limit: String(PAGE_SIZE), page: String(page) };
    if (status !== "All") params.status = status;
    try {
      const res = await ticketsApi.list(params);
      setAllTickets(res.tickets);
      setPagination(res.pagination);
      setCurrentPage(page);
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, []);

  // Re-fetch from page 1 when filter changes
  useEffect(() => {
    if (loading) return;
    fetchPage(1, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (loading) {
    return <div className="civic-container civic-section flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const statCards = [
    { label: "Total Tickets", value: stats?.total ?? 0, icon: Package, color: "bg-accent text-primary" },
    { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "bg-amber-50 text-amber-600" },
    { label: "Ongoing", value: stats?.ongoing ?? 0, icon: BarChart3, color: "bg-blue-50 text-blue-600" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle, color: "bg-accent text-primary" },
    { label: "Escalated", value: stats?.escalated ?? 0, icon: AlertTriangle, color: "bg-red-50 text-red-600" },
  ];

  return (
    <div className="civic-container civic-section">
      <div className="mb-8">
        <h1 className="text-h2 font-bold text-foreground">Department Dashboard</h1>
        <p className="mt-1 text-body text-muted-foreground">
          {user?.department} · {user?.city}
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-h2 text-foreground">{s.value}</p>
            <p className="text-caption text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {stats && stats.avgResolutionDays > 0 && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border bg-accent/30 p-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <p className="text-caption text-foreground">
            Average resolution time: <span className="font-semibold">{stats.avgResolutionDays} days</span>
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 text-foreground">Active Tickets</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["All", "Pending", "Ongoing", "Resolved", "Escalated"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {pageLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-label uppercase tracking-wider">Issue</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Location</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Reporters</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-label uppercase tracking-wider">Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTickets.length > 0 ? allTickets.map((ticket) => {
                const primary = ticket.issuePosts[0];
                const totalReporters = ticket.issuePosts.reduce((s, p) => s + p.reporters, 0);
                return (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div>
                        <p className="text-caption font-medium text-foreground">{primary?.title || "Untitled"}</p>
                        <p className="text-label text-muted-foreground">#{ticket.id.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-caption text-muted-foreground">{CATEGORY_DISPLAY[primary?.category ?? ""] || primary?.category}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-caption text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {primary?.location}</span>
                    </TableCell>
                    <TableCell className="text-caption text-foreground">{totalReporters}</TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell className="text-caption text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</TableCell>
                    <TableCell>
                      <Link to={`/department/ticket/${ticket.id}`}>
                        <Button variant="outline" size="sm" className="text-caption">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No tickets found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-caption text-muted-foreground">
            Page {currentPage} of {pagination.totalPages} &middot; {pagination.total} tickets
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || pageLoading}
              onClick={() => fetchPage(currentPage - 1, statusFilter)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.totalPages || pageLoading}
              onClick={() => fetchPage(currentPage + 1, statusFilter)}
              className="gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeptDashboard;

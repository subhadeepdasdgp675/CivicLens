import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket, SOCKET_EVENTS } from "@/contexts/SocketContext";
import { tickets as ticketsApi, issues as issuesApi, CATEGORY_DISPLAY, type ApiTicketDetail, type ApiComment } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import IssueMap from "@/components/IssueMap";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, MapPin, Clock, Users, MessageSquare, CheckCircle,
  AlertTriangle, Upload, Send, Loader2, Image,
} from "lucide-react";
import { cn, getFirstImageUrl } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, joinIssueRoom, leaveIssueRoom } = useSocket();
  const [ticket, setTicket] = useState<ApiTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [resolutionComment, setResolutionComment] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<ApiComment[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ticketsApi.getById(id)
      .then((res) => {
        setTicket(res.ticket);
        setSelectedStatus(res.ticket.status);
        // Flatten all comments from linked issue posts into one sorted list
        const all = res.ticket.issuePosts
          .flatMap((ip: any) => ip.comments || [])
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setComments(all);
      })
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Real-time: join all linked issue rooms & listen for comments ──
  useEffect(() => {
    if (!ticket || !socket) return;
    const issueIds = ticket.issuePosts.map((ip: any) => ip.id as string);
    // Join every issue room linked to this ticket
    issueIds.forEach((iid) => joinIssueRoom(iid));

    const handleComment = (data: { issueId: string; comment: ApiComment }) => {
      // Skip our own comments (we add them optimistically)
      if (data.comment.user?.id === user?.id) return;
      setComments((prev) => {
        if (prev.some((c) => c.id === data.comment.id)) return prev;
        return [...prev, data.comment];
      });
    };

    socket.on(SOCKET_EVENTS.ISSUE_COMMENTED, handleComment);

    return () => {
      issueIds.forEach((iid) => leaveIssueRoom(iid));
      socket.off(SOCKET_EVENTS.ISSUE_COMMENTED, handleComment);
    };
  }, [ticket, socket, user?.id, joinIssueRoom, leaveIssueRoom]);

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleStatusUpdate = async () => {
    if (!id || !selectedStatus) return;
    setUpdating(true);
    try {
      await ticketsApi.updateStatus(id, selectedStatus, resolutionComment || undefined, proofFile || undefined);
      toast({ title: `Ticket status updated to ${selectedStatus}` });
      // Refresh ticket
      const res = await ticketsApi.getById(id);
      setTicket(res.ticket);
      setProofFile(null);
      setProofPreview(null);
      setResolutionComment("");
    } catch (err: any) {
      toast({ title: err.message || "Update failed", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !ticket || !user) return;
    const firstIssueId = ticket.issuePosts[0]?.id;
    if (!firstIssueId) return;

    // Optimistic insert
    const tempComment: ApiComment = {
      id: `temp-${Date.now()}`,
      content: newComment.trim(),
      image: null,
      isDepartmentUpdate: true,
      createdAt: new Date().toISOString(),
      user: { id: user.id, name: user.name, role: user.role, avatar: user.avatar || null },
    };
    setComments((prev) => [...prev, tempComment]);
    const commentText = newComment.trim();
    setNewComment("");
    setSubmittingComment(true);

    try {
      const res = await issuesApi.addComment(firstIssueId, commentText);
      // Replace temp with real comment
      if (res.comment) {
        setComments((prev) => prev.map((c) => c.id === tempComment.id ? res.comment : c));
      }
      toast({ title: "Department update posted" });
    } catch {
      // Revert on error
      setComments((prev) => prev.filter((c) => c.id !== tempComment.id));
      setNewComment(commentText);
      toast({ title: "Failed to post comment", variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return <div className="civic-container civic-section flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!ticket) {
    return (
      <div className="civic-container civic-section text-center">
        <p className="text-body-lg text-muted-foreground">Ticket not found.</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const primary = ticket.issuePosts[0];

  return (
    <div className="civic-container civic-section">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-bold text-foreground">{primary?.title || "Ticket"}</h1>
          <p className="mt-1 flex items-center gap-2 text-caption text-muted-foreground">
            Ticket #{ticket.id.slice(0, 8)} · {CATEGORY_DISPLAY[primary?.category ?? ""] || primary?.category}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {ticket.totalReporters} reporters</span>
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: Issue Details */}
        <div className="lg:col-span-3 space-y-6">
          {primary && (
            <>
              <div className="overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
                <img
                  src={getFirstImageUrl(primary.image)}
                  alt={primary.title}
                  className="w-full object-cover"
                  style={{ maxHeight: 350 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              </div>
              <div className="overflow-hidden rounded-xl border">
                <IssueMap issues={[]} singlePin={[primary.lat, primary.lng]} height="h-52" />
              </div>
            </>
          )}

          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-body font-semibold text-foreground">Issue Description</h3>
            <p className="text-body text-foreground">{primary?.description}</p>
            <p className="mt-3 flex items-center gap-1 text-caption text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {primary?.location}</p>
          </div>

          {/* Proof image */}
          {ticket.proofImage && (
            <div className="rounded-xl border bg-accent/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-caption font-medium text-primary"><CheckCircle className="h-4 w-4" /> Resolution Proof</div>
              <img src={ticket.proofImage} alt="Resolution proof" className="max-h-60 w-full rounded-lg object-cover" />
              {ticket.resolutionComment && <p className="mt-2 text-caption text-foreground">{ticket.resolutionComment}</p>}
            </div>
          )}

          {/* Comments / Discussion */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-body font-semibold text-foreground"><MessageSquare className="h-5 w-5" /> Discussion ({comments.length})</h3>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className={cn("rounded-lg border p-3", c.isDepartmentUpdate && "border-l-4 border-l-primary bg-accent/20")}>
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-label font-semibold text-muted-foreground">{c.user.name.charAt(0)}</div>
                    <span className="text-caption font-medium text-foreground">{c.user.name}</span>
                    {c.isDepartmentUpdate && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-label text-primary">Dept Update</span>}
                    <span className="ml-auto text-label text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                  <p className="text-caption text-foreground">{c.content}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <Textarea placeholder="Post a department update…" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} className="flex-1" />
              <Button disabled={!newComment.trim() || submittingComment} onClick={handlePostComment} className="self-end gap-2">
                {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-4 text-body font-semibold text-foreground">Status Timeline</h3>
            <div className="space-y-3">
              {[
                { label: "Reported", date: ticket.createdAt, done: true },
                { label: "Ongoing", date: ticket.status !== "Pending" ? ticket.updatedAt : undefined, done: ["Ongoing", "Resolved", "Escalated"].includes(ticket.status) },
                { label: "Resolved", date: ticket.resolvedAt || undefined, done: ticket.status === "Resolved" },
              ].map((s) => (
                <div key={s.label} className="flex items-start gap-3">
                  <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full", s.done ? "bg-primary" : "bg-muted")}>
                    {s.done ? <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className={cn("text-caption font-medium", s.done ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
                    {s.date && <p className="text-label text-muted-foreground">{new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                  </div>
                </div>
              ))}
              {ticket.status === "Escalated" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive"><AlertTriangle className="h-3.5 w-3.5 text-destructive-foreground" /></div>
                  <div>
                    <p className="text-caption font-medium text-destructive">Escalated</p>
                    {ticket.escalatedAt && <p className="text-label text-muted-foreground">{new Date(ticket.escalatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Update Status */}
          {ticket.status !== "Resolved" && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="mb-4 text-body font-semibold text-foreground">Update Status</h3>
              <div className="space-y-4">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pending", "Ongoing", "Resolved"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedStatus === "Resolved" && (
                  <>
                    <div>
                      <p className="mb-2 text-caption font-medium text-foreground">Upload Resolution Proof</p>
                      {proofPreview ? (
                        <div className="relative"><img src={proofPreview} alt="Proof" className="max-h-40 w-full rounded-lg object-cover" /><button onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute top-2 right-2 rounded bg-card/90 px-2 py-0.5 text-label">Remove</button></div>
                      ) : (
                        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed py-8 hover:border-primary/50">
                          <Image className="h-8 w-8 text-muted-foreground" />
                          <span className="text-caption text-muted-foreground">Click to upload proof image</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} />
                        </label>
                      )}
                    </div>
                    <Textarea placeholder="Resolution details..." value={resolutionComment} onChange={(e) => setResolutionComment(e.target.value)} rows={3} />
                  </>
                )}

                <Button onClick={handleStatusUpdate} disabled={updating || selectedStatus === ticket.status} className="w-full gap-2">
                  {updating ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : "Update Status"}
                </Button>
              </div>
            </div>
          )}

          {/* Linked Issues */}
          {ticket.issuePosts.length > 1 && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="mb-3 text-body font-semibold text-foreground">Linked Reports ({ticket.totalIssuePosts})</h3>
              <div className="space-y-2">
                {ticket.issuePosts.map((ip) => (
                  <div key={ip.id} className="flex items-center gap-3 rounded-lg border p-2">
                    <img
                      src={getFirstImageUrl(ip.image)}
                      alt={ip.title}
                      className="h-10 w-10 rounded object-cover shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-caption font-medium text-foreground">{ip.title}</p>
                      <p className="text-label text-muted-foreground">{ip.reporters} reporter{ip.reporters > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;

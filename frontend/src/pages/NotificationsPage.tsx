import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { notifications as notificationsApi, type ApiNotification } from "@/lib/api";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const typeColors: Record<string, string> = {
  info: "text-blue-500",
  success: "text-primary",
  warning: "text-amber-500",
  error: "text-destructive",
};

const NotificationsPage = () => {
  const { user } = useAuth();
  const { decrementUnread, clearUnread } = useSocket();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    notificationsApi.list()
      .then((res) => setItems(res.notifications))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      decrementUnread(1);
    } catch {
      toast({ title: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      const currentUnread = items.filter((n) => !n.read).length;
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      clearUnread();
      toast({ title: "All notifications marked as read" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  if (loading) {
    return <div className="civic-container civic-section flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="civic-container civic-section">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" className="gap-2" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {items.length > 0 ? items.map((n) => {
          const Icon = typeIcons[n.type] || Info;
          return (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-4 rounded-xl border bg-card p-5 transition-colors",
                !n.read && "border-l-4 border-l-primary bg-accent/30"
              )}
            >
              <div className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-muted", typeColors[n.type])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-body font-semibold text-foreground">{n.title}</h3>
                <p className="mt-0.5 text-caption text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-label text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {!n.read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="shrink-0 text-caption font-medium text-primary hover:underline"
                >
                  Mark Read
                </button>
              )}
            </div>
          );
        }) : (
          <div className="rounded-xl border bg-card py-16 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-body-lg text-muted-foreground">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;

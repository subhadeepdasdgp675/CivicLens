import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { notifications as notificationsApi } from "@/lib/api";

// ── Event name constants (must match backend) ──
export const SOCKET_EVENTS = {
    ISSUE_CREATED: "issue:created",
    ISSUE_UPVOTED: "issue:upvoted",
    ISSUE_COMMENTED: "issue:commented",
    TICKET_STATUS_CHANGED: "ticket:statusChanged",
    NOTIFICATION_NEW: "notification:new",
} as const;

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    joinIssueRoom: (issueId: string) => void;
    leaveIssueRoom: (issueId: string) => void;
    unreadCount: number;
    decrementUnread: (by?: number) => void;
    clearUnread: () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    joinIssueRoom: () => { },
    leaveIssueRoom: () => { },
    unreadCount: 0,
    decrementUnread: () => { },
    clearUnread: () => { },
});

/**
 * Provides a Socket.IO connection scoped to the authenticated user.
 * Auto-connects when user logs in, auto-disconnects on logout.
 * The backend assigns rooms (user, city, department) on connect via JWT payload.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch initial unread count when user logs in
    useEffect(() => {
        if (!isAuthenticated || !user) {
            setUnreadCount(0);
            return;
        }
        notificationsApi.list(true)
            .then((res) => setUnreadCount(res.unreadCount))
            .catch(() => { });
    }, [isAuthenticated, user?.id]);

    useEffect(() => {
        if (!isAuthenticated || !user) {
            // Disconnect on logout
            setSocket((prev) => {
                prev?.disconnect();
                return null;
            });
            setIsConnected(false);
            return;
        }

        const token = localStorage.getItem("civiclens_token") || localStorage.getItem("civicconnect_token");
        if (!token) return;

        // In production (Vercel), VITE_API_URL points to the deployed backend.
        // Locally, undefined makes Socket.IO use same-origin (Vite proxy handles it).
        const backendUrl = import.meta.env.VITE_API_URL || undefined;

        const newSocket = io(backendUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        newSocket.on("connect", () => {
            console.log("[Socket] Connected:", newSocket.id);
            setIsConnected(true);
        });

        newSocket.on("disconnect", () => {
            console.log("[Socket] Disconnected");
            setIsConnected(false);
        });

        newSocket.on("connect_error", (err) => {
            console.warn("[Socket] Connection error:", err.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [isAuthenticated, user?.id]);

    const joinIssueRoom = useCallback((issueId: string) => {
        setSocket((s) => { s?.emit("join:issue", issueId); return s; });
    }, []);

    const leaveIssueRoom = useCallback((issueId: string) => {
        setSocket((s) => { s?.emit("leave:issue", issueId); return s; });
    }, []);

    // Real-time: increment badge when a new notification arrives via socket
    useEffect(() => {
        if (!socket) return;
        const handleNew = () => setUnreadCount((c) => c + 1);
        socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, handleNew);
        return () => { socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, handleNew); };
    }, [socket]); // re-attach when socket instance changes

    const decrementUnread = useCallback((by = 1) => {
        setUnreadCount((c) => Math.max(0, c - by));
    }, []);

    const clearUnread = useCallback(() => {
        setUnreadCount(0);
    }, []);

    return (
        <SocketContext.Provider
            value={{
                socket,
                isConnected,
                joinIssueRoom,
                leaveIssueRoom,
                unreadCount,
                decrementUnread,
                clearUnread,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}

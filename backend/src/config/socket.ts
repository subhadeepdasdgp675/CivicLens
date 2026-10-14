import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

let io: Server;

interface SocketUser {
    id: string;
    email: string;
    role: string;
    cityId: string | null;
    departmentId: string | null;
}

/**
 * Initialise Socket.IO and attach to the HTTP server.
 * - JWT authentication on every connection
 * - Rooms: `city:<id>`, `issue:<id>`, `user:<id>`, `department:<id>`
 */
export function initSocket(httpServer: HttpServer): Server {
    io = new Server(httpServer, {
        cors: {
            origin: env.FRONTEND_URL,
            credentials: true,
        },
        // Reduce unnecessary polling — start with websocket, fall back to polling
        transports: ["websocket", "polling"],
    });

    // ── JWT Auth Middleware ──
    io.use((socket: Socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) {
            return next(new Error("Authentication required"));
        }

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
            (socket as any).user = decoded;
            next();
        } catch {
            next(new Error("Invalid or expired token"));
        }
    });

    // ── Connection Handler ──
    io.on("connection", (socket: Socket) => {
        const user = (socket as any).user as SocketUser;

        // Auto-join personal room (for notifications)
        socket.join(`user:${user.id}`);

        // Auto-join city room (for new issues in user's city)
        if (user.cityId) {
            socket.join(`city:${user.cityId}`);
        }

        // Auto-join department room (for dept users)
        if (user.departmentId) {
            socket.join(`department:${user.departmentId}`);
        }

        console.log(`[Socket] Connected: ${user.email} (${user.role})`);

        // ── Client can join / leave issue rooms dynamically ──
        socket.on("join:issue", (issueId: string) => {
            socket.join(`issue:${issueId}`);
        });

        socket.on("leave:issue", (issueId: string) => {
            socket.leave(`issue:${issueId}`);
        });

        socket.on("disconnect", () => {
            console.log(`[Socket] Disconnected: ${user.email}`);
        });
    });

    console.log("[Socket] Socket.IO initialised");
    return io;
}

/**
 * Get the Socket.IO server instance.
 * Must be called after initSocket().
 */
export function getIO(): Server {
    if (!io) {
        throw new Error("Socket.IO not initialised — call initSocket() first");
    }
    return io;
}

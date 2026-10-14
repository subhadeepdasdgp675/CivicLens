import type { Request, Response } from "express";
import prisma from "../config/db.js";

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user.
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const { unreadOnly } = req.query;

        const where: any = { userId };
        if (unreadOnly === "true") {
            where.read = false;
        }

        // Parallel fetch: notifications + unread count
        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.notification.count({
                where: { userId, read: false },
            }),
        ]);

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Get notifications error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read — single updateMany (no findUnique needed).
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const userId = req.user!.id;

        // Single query: update only if it belongs to this user
        const result = await prisma.notification.updateMany({
            where: { id, userId },
            data: { read: true },
        });

        if (result.count === 0) {
            res.status(404).json({ error: "Notification not found." });
            return;
        }

        res.json({ message: "Notification marked as read." });
    } catch (error) {
        console.error("Mark as read error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * PATCH /api/notifications/read-all
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;

        await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });

        res.json({ message: "All notifications marked as read." });
    } catch (error) {
        console.error("Mark all as read error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

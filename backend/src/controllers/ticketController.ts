import type { Request, Response } from "express";
import prisma from "../config/db.js";
import { ticketStatusSchema } from "../utils/validators.js";
import { notifyIssueReporters } from "../services/notificationService.js";
import { emitTicketStatusChanged } from "../services/socketEvents.js";
import { sendStatusUpdateEmail } from "../services/emailService.js";
import { recordTimelineEvent } from "../services/civicLensService.js";

/**
 * GET /api/tickets
 * Get all consolidated tickets for the authenticated department user.
 * Optimised: only fetch the first issue post for list view instead of all posts.
 */
export async function getTickets(req: Request, res: Response): Promise<void> {
    try {
        const departmentId = req.user!.departmentId;
        const cityId = req.user!.cityId;

        if (!departmentId || !cityId) {
            res.status(403).json({ error: "Your account is not associated with a department." });
            return;
        }

        const { status, page = "1", limit = "20" } = req.query;

        const where: any = { departmentId, cityId };
        if (status) where.status = status;

        const pageNum = Math.max(1, parseInt(page as string, 10));
        const limitNum = Math.min(20, Math.max(1, parseInt(limit as string, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [tickets, total] = await Promise.all([
            prisma.consolidatedTicket.findMany({
                where,
                select: {
                    id: true,
                    status: true,
                    proofImage: true,
                    resolutionComment: true,
                    escalatedAt: true,
                    resolvedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    department: { select: { id: true, name: true } },
                    city: { select: { id: true, name: true } },
                    // Only fetch the first (original) post for list view — reduces data significantly
                    issuePosts: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            category: true,
                            location: true,
                            lat: true,
                            lng: true,
                            image: true,
                            reporters: true,
                            createdAt: true,
                            reportedBy: { select: { id: true, name: true } },
                        },
                        orderBy: { createdAt: "asc" },
                        take: 1,
                    },
                    _count: { select: { issuePosts: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limitNum,
            }),
            prisma.consolidatedTicket.count({ where }),
        ]);

        res.json({
            tickets,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("Get tickets error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/tickets/:id
 * Get a single consolidated ticket with all linked issue posts + comments.
 */
export async function getTicketById(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;

        const ticket = await prisma.consolidatedTicket.findUnique({
            where: { id },
            include: {
                department: { select: { id: true, name: true } },
                city: { select: { id: true, name: true } },
                issuePosts: {
                    include: {
                        reportedBy: { select: { id: true, name: true, role: true, avatar: true } },
                        comments: {
                            include: {
                                user: { select: { id: true, name: true, role: true, avatar: true } },
                            },
                            orderBy: { createdAt: "asc" },
                        },
                        _count: { select: { upvotes: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!ticket) {
            res.status(404).json({ error: "Ticket not found." });
            return;
        }

        // City isolation check
        if (req.user!.role === "department" && ticket.cityId !== req.user!.cityId) {
            res.status(403).json({ error: "You do not have access to this ticket." });
            return;
        }

        // Calculate total duplicate reporters
        const totalReporters = ticket.issuePosts.reduce((sum: number, post: { reporters: number }) => sum + post.reporters, 0);

        res.json({
            ticket: {
                ...ticket,
                totalReporters,
                totalIssuePosts: ticket.issuePosts.length,
            },
        });
    } catch (error) {
        console.error("Get ticket by ID error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * PATCH /api/tickets/:id/status
 * Update ticket status (department users only).
 * Resolution requires proof image upload.
 */
export async function updateTicketStatus(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const validation = ticketStatusSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: validation.error.errors[0].message });
            return;
        }

        const { status, resolutionComment } = validation.data;

        const ticket = await prisma.consolidatedTicket.findUnique({
            where: { id },
            include: { department: true },
        });

        if (!ticket) {
            res.status(404).json({ error: "Ticket not found." });
            return;
        }

        // City isolation
        if (ticket.cityId !== req.user!.cityId) {
            res.status(403).json({ error: "You do not have access to this ticket." });
            return;
        }

        // Resolution proof requirement
        const proofImage = req.file ? req.file.path : undefined;
        if (status === "Resolved" && !proofImage && !ticket.proofImage) {
            res.status(400).json({ error: "A proof image is required to mark the issue as resolved." });
            return;
        }

        // Update consolidated ticket
        const updatedTicket = await prisma.consolidatedTicket.update({
            where: { id },
            data: {
                status,
                proofImage: proofImage || ticket.proofImage,
                resolutionComment: resolutionComment || ticket.resolutionComment,
                resolvedAt: status === "Resolved" ? new Date() : undefined,
            },
        });

        // Sync status to ALL linked issue posts
        await prisma.issuePost.updateMany({
            where: { consolidatedTicketId: id },
            data: {
                status,
                updatedAt: new Date(),
            },
        });

        // Record timeline event for incident history audit
        const timelineEventType = status === "Resolved" ? "RESOLVED" : "STATUS_CHANGED";
        recordTimelineEvent({
            consolidatedTicketId: id,
            eventType: timelineEventType as any,
            title: status === "Resolved" ? "Issue Resolved by Department" : `Ticket Status Updated: ${status}`,
            description: resolutionComment
                ? `Department officer updated status to "${status}". Note: ${resolutionComment}`
                : `Department officer updated status to "${status}".`,
            source: "OFFICER",
            metadata: {
                status,
                resolutionComment: resolutionComment || null,
                proofImage: proofImage || ticket.proofImage || null,
                officerEmail: req.user?.email,
            },
        }).catch(() => { });

        // Real-time: broadcast status change to dept room + all linked issue rooms
        const linkedPosts = await prisma.issuePost.findMany({
            where: { consolidatedTicketId: id },
            select: { id: true },
        });
        const issueIds = linkedPosts.map((p: { id: string }) => p.id);
        emitTicketStatusChanged(
            ticket.departmentId,
            issueIds,
            { ticketId: id, status, issueIds, proofImage: proofImage || ticket.proofImage, resolutionComment: resolutionComment || ticket.resolutionComment },
            ticket.cityId
        );

        // Notify all reporters
        const statusMessages: Record<string, string> = {
            Ongoing: "is now being worked on.",
            Resolved: "has been resolved. A proof image has been uploaded.",
            Pending: "has been set back to pending.",
        };

        const messageEnding = statusMessages[status] || `status has been updated to ${status}.`;

        await notifyIssueReporters(
            id,
            `Status Updated — ${status}`,
            `An issue you reported ${messageEnding}`,
            status === "Resolved" ? "success" : "info"
        );

        // The proof image to include in emails (newly uploaded or existing)
        const resolvedProofImage = proofImage || ticket.proofImage || null;

        // Email guest reporters (in background — never block response)
        prisma.issuePost.findMany({
            where: { consolidatedTicketId: id, guestEmail: { not: null } },
            select: { guestEmail: true, title: true, location: true },
        }).then((posts: { guestEmail: string | null; title: string; location: string }[]) => {
            posts.forEach((post) => {
                if (!post.guestEmail) return;
                sendStatusUpdateEmail({
                    to: post.guestEmail,
                    issueTitle: post.title,
                    newStatus: status,
                    location: post.location,
                    resolutionComment: resolutionComment || ticket.resolutionComment,
                    proofImageUrl: status === "Resolved" ? resolvedProofImage : null,
                }).catch(() => { });
            });
        }).catch(() => { });

        // Email logged-in citizen reporters (in background — never block response)
        // Only citizens receive emails — departments are excluded.
        prisma.issuePost.findMany({
            where: {
                consolidatedTicketId: id,
                reportedById: { not: null },
            },
            select: {
                title: true,
                location: true,
                reportedBy: { select: { email: true, role: true } },
            },
        }).then((posts) => {
            posts.forEach((post) => {
                if (!post.reportedBy?.email) return;
                sendStatusUpdateEmail({
                    to: post.reportedBy.email,
                    issueTitle: post.title,
                    newStatus: status,
                    location: post.location,
                    resolutionComment: resolutionComment || ticket.resolutionComment,
                    proofImageUrl: status === "Resolved" ? resolvedProofImage : null,
                }).catch(() => { });
            });
        }).catch(() => { });

        res.json({
            message: `Ticket status updated to ${status}.`,
            ticket: updatedTicket,
        });
    } catch (error) {
        console.error("Update ticket status error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/tickets/:id/proof
 * Upload proof image for a ticket (used before resolution).
 */
export async function uploadProof(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;

        if (!req.file) {
            res.status(400).json({ error: "A proof image is required." });
            return;
        }

        const ticket = await prisma.consolidatedTicket.findUnique({ where: { id } });
        if (!ticket) {
            res.status(404).json({ error: "Ticket not found." });
            return;
        }

        if (ticket.cityId !== req.user!.cityId) {
            res.status(403).json({ error: "You do not have access to this ticket." });
            return;
        }

        const proofImage = req.file ? req.file.path : undefined;

        const updatedTicket = await prisma.consolidatedTicket.update({
            where: { id },
            data: { proofImage },
        });

        res.json({
            message: "Proof image uploaded successfully.",
            ticket: updatedTicket,
        });
    } catch (error) {
        console.error("Upload proof error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/tickets/stats
 * Get department statistics.
 * Optimised: single groupBy + one resolved-tickets query instead of 5 counts.
 */
export async function getTicketStats(req: Request, res: Response): Promise<void> {
    try {
        const departmentId = req.user!.departmentId;
        const cityId = req.user!.cityId;

        if (!departmentId || !cityId) {
            res.status(403).json({ error: "Your account is not associated with a department." });
            return;
        }

        const [statusGroups, resolvedTickets] = await Promise.all([
            // One groupBy replaces 5 separate counts
            prisma.consolidatedTicket.groupBy({
                by: ["status"],
                where: { departmentId, cityId },
                _count: { _all: true },
            }),
            prisma.consolidatedTicket.findMany({
                where: { departmentId, cityId, status: "Resolved", resolvedAt: { not: null } },
                select: { createdAt: true, resolvedAt: true },
            }),
        ]);

        type StatusGroup = { status: string; _count: { _all: number } };
        const statusMap = new Map<string, number>();
        let total = 0;
        for (const g of statusGroups as StatusGroup[]) {
            statusMap.set(g.status, g._count._all);
            total += g._count._all;
        }

        let avgResolutionDays = 0;
        if (resolvedTickets.length > 0) {
            const totalDays = resolvedTickets.reduce(
                (sum: number, t: { resolvedAt: Date | null; createdAt: Date }) =>
                    sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24),
                0
            );
            avgResolutionDays = Math.round((totalDays / resolvedTickets.length) * 10) / 10;
        }

        res.json({
            stats: {
                total,
                pending: statusMap.get("Pending") ?? 0,
                ongoing: statusMap.get("Ongoing") ?? 0,
                resolved: statusMap.get("Resolved") ?? 0,
                escalated: statusMap.get("Escalated") ?? 0,
                avgResolutionDays,
            },
        });
    } catch (error) {
        console.error("Get ticket stats error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

import type { Request, Response } from "express";
import prisma from "../config/db.js";
import { sendStatusUpdateEmail } from "../services/emailService.js";
import { createNotification, notifyIssueReporters } from "../services/notificationService.js";
import { emitTicketStatusChanged } from "../services/socketEvents.js";
import { recordTimelineEvent } from "../services/civicLensService.js";

/**
 * Resolves the effective city ID from query params or user token.
 * If a city name or ID is provided in query, look up or create the city.
 */
async function resolveCityId(req: Request): Promise<string | null> {
    const requested = (req.query.cityId as string) || (req.query.cityName as string) || (req.headers["x-city-id"] as string) || (req.headers["x-city-name"] as string);
    if (requested) {
        const found = await prisma.city.findFirst({
            where: {
                OR: [
                    { id: requested },
                    { name: { equals: requested, mode: "insensitive" } },
                ],
            },
        });
        if (found) return found.id;

        // If it's a valid named city that doesn't exist yet, auto-create it
        try {
            const created = await prisma.city.create({
                data: { name: requested },
            });
            return created.id;
        } catch {
            return null;
        }
    }
    return req.user?.cityId || null;
}

/**
 * GET /api/municipal/overview
 * City-level overview dashboard with stats breakdown by department and status.
 * Enriched: includes resolution rate, citizen count, recent trends.
 */
export async function getCityOverview(req: Request, res: Response): Promise<void> {
    try {
        const cityId = await resolveCityId(req);
        if (!cityId) {
            res.status(403).json({ error: "Your account is not associated with a city." });
            return;
        }

        // Fetch city info, issue status counts, dept ticket counts, citizen count — all in parallel
        const [city, issueStatusGroups, deptTicketGroups, departments, citizenCount, recentIssuesCount] = await Promise.all([
            prisma.city.findUnique({ where: { id: cityId }, select: { name: true } }),
            // Single groupBy instead of 5 separate counts
            prisma.issuePost.groupBy({
                by: ["status"],
                where: { cityId },
                _count: { _all: true },
            }),
            // Single groupBy for ticket counts per dept per status
            prisma.consolidatedTicket.groupBy({
                by: ["departmentId", "status"],
                where: { cityId },
                _count: { _all: true },
            }),
            prisma.department.findMany({
                where: { cityId },
                select: { id: true, name: true, categoryType: true },
            }),
            // Count of citizens in this city
            prisma.user.count({
                where: { cityId, role: "citizen" },
            }),
            // Issues created in the last 7 days
            prisma.issuePost.count({
                where: {
                    cityId,
                    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        // Build overview from groupBy results
        const overview = { total: 0, pending: 0, ongoing: 0, resolved: 0, escalated: 0 };
        for (const g of issueStatusGroups) {
            const count = g._count._all;
            overview.total += count;
            if (g.status === "Pending") overview.pending = count;
            else if (g.status === "Ongoing") overview.ongoing = count;
            else if (g.status === "Resolved") overview.resolved = count;
            else if (g.status === "Escalated") overview.escalated = count;
        }

        // Index ticket group counts by departmentId+status
        type TicketGroup = { departmentId: string; status: string; _count: { _all: number } };
        const ticketIndex = new Map<string, number>();
        for (const g of deptTicketGroups as TicketGroup[]) {
            const key = `${g.departmentId}:${g.status}`;
            ticketIndex.set(key, g._count._all);
        }

        const getCount = (deptId: string, status: string) =>
            ticketIndex.get(`${deptId}:${status}`) ?? 0;

        const departmentStats = departments.map((dept) => {
            const deptPending = getCount(dept.id, "Pending");
            const deptOngoing = getCount(dept.id, "Ongoing");
            const deptResolved = getCount(dept.id, "Resolved");
            const deptEscalated = getCount(dept.id, "Escalated");
            return {
                department: dept.name,
                departmentId: dept.id,
                categoryType: dept.categoryType,
                total: deptPending + deptOngoing + deptResolved + deptEscalated,
                pending: deptPending,
                ongoing: deptOngoing,
                resolved: deptResolved,
                escalated: deptEscalated,
            };
        });

        const resolutionRate = overview.total > 0
            ? Math.round((overview.resolved / overview.total) * 100)
            : 0;

        res.json({
            city: city?.name || "Unknown",
            overview: {
                ...overview,
                resolutionRate,
            },
            departments: departmentStats,
            citizenCount,
            recentIssuesCount,
        });
    } catch (error) {
        console.error("Get city overview error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/municipal/departments
 * Department-wise performance stats.
 * Enriched: includes pending + ongoing counts per department.
 */
export async function getDepartmentPerformance(req: Request, res: Response): Promise<void> {
    try {
        const cityId = await resolveCityId(req);
        if (!cityId) {
            res.status(403).json({ error: "Your account is not associated with a city." });
            return;
        }

        const [departments, ticketGroups, resolvedTickets] = await Promise.all([
            prisma.department.findMany({
                where: { cityId },
                select: { id: true, name: true, categoryType: true },
            }),
            // One groupBy replaces 3N count queries
            prisma.consolidatedTicket.groupBy({
                by: ["departmentId", "status"],
                where: { cityId },
                _count: { _all: true },
            }),
            // Fetch all resolved tickets with timing info in one query
            prisma.consolidatedTicket.findMany({
                where: { cityId, status: "Resolved", resolvedAt: { not: null } },
                select: { departmentId: true, createdAt: true, resolvedAt: true },
            }),
        ]);

        // Index ticket counts
        type TicketGroup = { departmentId: string; status: string; _count: { _all: number } };
        const ticketIndex = new Map<string, number>();
        for (const g of ticketGroups as TicketGroup[]) {
            ticketIndex.set(`${g.departmentId}:${g.status}`, g._count._all);
        }

        // Index resolution times per department
        type ResTicket = { departmentId: string; createdAt: Date; resolvedAt: Date | null };
        const resolutionMap = new Map<string, number[]>();
        for (const t of resolvedTickets as ResTicket[]) {
            const days = (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            const arr = resolutionMap.get(t.departmentId) ?? [];
            arr.push(days);
            resolutionMap.set(t.departmentId, arr);
        }

        const getCount = (deptId: string, status: string) =>
            ticketIndex.get(`${deptId}:${status}`) ?? 0;

        const stats = departments.map((dept) => {
            const pending = getCount(dept.id, "Pending");
            const ongoing = getCount(dept.id, "Ongoing");
            const resolved = getCount(dept.id, "Resolved");
            const escalated = getCount(dept.id, "Escalated");
            const total = pending + ongoing + resolved + escalated;

            const days = resolutionMap.get(dept.id) ?? [];
            const avgResolutionDays =
                days.length > 0
                    ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10
                    : 0;

            return {
                department: dept.name,
                departmentId: dept.id,
                categoryType: dept.categoryType,
                total,
                pending,
                ongoing,
                resolved,
                escalated,
                resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
                avgResolutionDays,
            };
        });

        res.json({ departments: stats });
    } catch (error) {
        console.error("Get department performance error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/municipal/escalations
 * All escalated issues in the city.
 * Enriched: includes lat/lng for map display, pagination support.
 */
export async function getEscalations(req: Request, res: Response): Promise<void> {
    try {
        const cityId = await resolveCityId(req);
        if (!cityId) {
            res.status(403).json({ error: "Your account is not associated with a city." });
            return;
        }

        const { page = "1", limit = "50" } = req.query;
        const pageNum = Math.max(1, parseInt(page as string, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [escalatedTickets, total] = await Promise.all([
            prisma.consolidatedTicket.findMany({
                where: { cityId, status: "Escalated" },
                include: {
                    department: { select: { id: true, name: true } },
                    issuePosts: {
                        select: {
                            id: true,
                            title: true,
                            location: true,
                            lat: true,
                            lng: true,
                            category: true,
                            reporters: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: "asc" },
                        take: 1, // just the original post
                    },
                },
                orderBy: { escalatedAt: "desc" },
                skip,
                take: limitNum,
            }),
            prisma.consolidatedTicket.count({
                where: { cityId, status: "Escalated" },
            }),
        ]);

        res.json({
            escalations: escalatedTickets,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error("Get escalations error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/municipal/reports/export
 * Generate city report data (CSV export format).
 * Enriched: includes per-department breakdown by status.
 */
export async function exportReport(req: Request, res: Response): Promise<void> {
    try {
        const cityId = await resolveCityId(req);
        if (!cityId) {
            res.status(403).json({ error: "Your account is not associated with a city." });
            return;
        }

        const [city, statusGroups, deptStatusGroups, departments] = await Promise.all([
            prisma.city.findUnique({ where: { id: cityId }, select: { name: true } }),
            // One groupBy replaces 5 separate counts
            prisma.consolidatedTicket.groupBy({
                by: ["status"],
                where: { cityId },
                _count: { _all: true },
            }),
            // Per-department per-status counts
            prisma.consolidatedTicket.groupBy({
                by: ["departmentId", "status"],
                where: { cityId },
                _count: { _all: true },
            }),
            prisma.department.findMany({
                where: { cityId },
                select: { id: true, name: true },
            }),
        ]);

        // Build totals from status groups
        type StatusGroup = { status: string; _count: { _all: number } };
        const statusMap = new Map<string, number>();
        let total = 0;
        for (const g of statusGroups as StatusGroup[]) {
            statusMap.set(g.status, g._count._all);
            total += g._count._all;
        }
        const resolved = statusMap.get("Resolved") ?? 0;
        const pending = statusMap.get("Pending") ?? 0;
        const ongoing = statusMap.get("Ongoing") ?? 0;
        const escalated = statusMap.get("Escalated") ?? 0;

        // Build dept breakdown with per-status counts
        type DeptStatusGroup = { departmentId: string; status: string; _count: { _all: number } };
        const deptStatusIndex = new Map<string, number>();
        for (const g of deptStatusGroups as DeptStatusGroup[]) {
            deptStatusIndex.set(`${g.departmentId}:${g.status}`, g._count._all);
        }
        const getDeptCount = (deptId: string, status: string) =>
            deptStatusIndex.get(`${deptId}:${status}`) ?? 0;

        const deptBreakdown = departments.map((d) => {
            const dPending = getDeptCount(d.id, "Pending");
            const dOngoing = getDeptCount(d.id, "Ongoing");
            const dResolved = getDeptCount(d.id, "Resolved");
            const dEscalated = getDeptCount(d.id, "Escalated");
            return {
                department: d.name,
                count: dPending + dOngoing + dResolved + dEscalated,
                pending: dPending,
                ongoing: dOngoing,
                resolved: dResolved,
                escalated: dEscalated,
            };
        });

        const { format } = req.query;

        if (format === "csv") {
            let csv = "Metric,Value\n";
            csv += `City,${city?.name}\n`;
            csv += `Total Issues,${total}\n`;
            csv += `Resolved,${resolved}\n`;
            csv += `Pending,${pending}\n`;
            csv += `Ongoing,${ongoing}\n`;
            csv += `Escalated,${escalated}\n\n`;
            csv += "Department,Total,Pending,Ongoing,Resolved,Escalated\n";
            deptBreakdown.forEach((d) => {
                csv += `${d.department},${d.count},${d.pending},${d.ongoing},${d.resolved},${d.escalated}\n`;
            });

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=${city?.name || "city"}-report.csv`);
            res.send(csv);
        } else {
            res.json({
                city: city?.name,
                report: { total, resolved, pending, ongoing, escalated },
                departmentBreakdown: deptBreakdown,
                generatedAt: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error("Export report error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/municipal/reports/analytics
 * Advanced analytics for the admin reports page.
 * Provides monthly trends, category breakdown, and best/worst department insights.
 */
export async function getReportAnalytics(req: Request, res: Response): Promise<void> {
    try {
        const cityId = await resolveCityId(req);
        if (!cityId) {
            res.status(403).json({ error: "Your account is not associated with a city." });
            return;
        }

        // Get issues created per month for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [issuesByMonth, categoryGroups, deptPerf] = await Promise.all([
            prisma.issuePost.findMany({
                where: { cityId, createdAt: { gte: sixMonthsAgo } },
                select: { createdAt: true, status: true },
                orderBy: { createdAt: "asc" },
            }),
            // Category breakdown
            prisma.issuePost.groupBy({
                by: ["category"],
                where: { cityId },
                _count: { _all: true },
            }),
            // Department performance for best/worst
            prisma.consolidatedTicket.groupBy({
                by: ["departmentId", "status"],
                where: { cityId },
                _count: { _all: true },
            }),
        ]);

        // Build monthly trend data
        const monthlyMap = new Map<string, { created: number; resolved: number }>();
        for (const issue of issuesByMonth) {
            const monthKey = `${issue.createdAt.getFullYear()}-${String(issue.createdAt.getMonth() + 1).padStart(2, "0")}`;
            const entry = monthlyMap.get(monthKey) ?? { created: 0, resolved: 0 };
            entry.created += 1;
            if (issue.status === "Resolved") entry.resolved += 1;
            monthlyMap.set(monthKey, entry);
        }
        const monthlyTrend = Array.from(monthlyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
                month,
                ...data,
            }));

        // Category breakdown
        const categoryBreakdown = categoryGroups.map((g) => ({
            category: g.category,
            count: g._count._all,
        }));

        // Department performance analysis
        const departments = await prisma.department.findMany({
            where: { cityId },
            select: { id: true, name: true },
        });

        type DeptPerfGroup = { departmentId: string; status: string; _count: { _all: number } };
        const perfIndex = new Map<string, number>();
        for (const g of deptPerf as DeptPerfGroup[]) {
            perfIndex.set(`${g.departmentId}:${g.status}`, g._count._all);
        }
        const getPerfCount = (deptId: string, status: string) =>
            perfIndex.get(`${deptId}:${status}`) ?? 0;

        const deptAnalysis = departments.map((dept) => {
            const dTotal =
                getPerfCount(dept.id, "Pending") +
                getPerfCount(dept.id, "Ongoing") +
                getPerfCount(dept.id, "Resolved") +
                getPerfCount(dept.id, "Escalated");
            const dResolved = getPerfCount(dept.id, "Resolved");
            return {
                department: dept.name,
                departmentId: dept.id,
                total: dTotal,
                resolved: dResolved,
                resolutionRate: dTotal > 0 ? Math.round((dResolved / dTotal) * 100) : 0,
            };
        });

        const bestDept = deptAnalysis.reduce((a, b) => a.resolutionRate > b.resolutionRate ? a : b, deptAnalysis[0]);
        const worstDept = deptAnalysis.reduce((a, b) => a.resolutionRate < b.resolutionRate ? a : b, deptAnalysis[0]);

        res.json({
            monthlyTrend,
            categoryBreakdown,
            departmentAnalysis: deptAnalysis,
            insights: {
                bestDepartment: bestDept || null,
                worstDepartment: worstDept || null,
            },
        });
    } catch (error) {
        console.error("Get report analytics error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * PATCH /api/municipal/issues/:id/status
 * Allows Municipal Administrator to directly mark a citizen issue report as
 * "Resolved", "Ongoing" (In Progress), or "Pending".
 * Updates the report and its linked ticket, emits real-time socket events,
 * and sends an automated status notification email to the citizen reporter.
 */
export async function updateMunicipalIssueStatus(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const { status: inputStatus, resolutionComment, resolutionNote } = req.body;

        if (!inputStatus) {
            res.status(400).json({ error: "Status is required." });
            return;
        }

        // Normalize status ("In Progress" -> "Ongoing", "Resolved" -> "Resolved", "Pending" -> "Pending")
        let targetStatus: "Pending" | "Ongoing" | "Resolved" | "Escalated" = "Ongoing";
        if (inputStatus === "Resolved") targetStatus = "Resolved";
        else if (inputStatus === "Pending") targetStatus = "Pending";
        else if (inputStatus === "Escalated") targetStatus = "Escalated";
        else targetStatus = "Ongoing"; // Default for "Ongoing", "In Progress", "In-Progress", etc.

        // Find the issue
        const issue = await prisma.issuePost.findUnique({
            where: { id },
            include: {
                reportedBy: { select: { id: true, name: true, email: true, role: true } },
                city: { select: { id: true, name: true } },
                consolidatedTicket: { select: { id: true, departmentId: true } },
            },
        });

        if (!issue) {
            res.status(404).json({ error: "Report not found." });
            return;
        }

        const note = (resolutionComment || resolutionNote || "").trim();

        // 1. Update the issue post in database
        const updatedIssue = await prisma.issuePost.update({
            where: { id },
            data: {
                status: targetStatus,
                updatedAt: new Date(),
            },
        });

        // 2. If linked to a consolidated ticket, sync status to ticket and sister reports
        if (issue.consolidatedTicketId) {
            await prisma.consolidatedTicket.update({
                where: { id: issue.consolidatedTicketId },
                data: {
                    status: targetStatus,
                    resolvedAt: targetStatus === "Resolved" ? new Date() : undefined,
                    resolutionComment: note || undefined,
                },
            }).catch(() => {});

            await prisma.issuePost.updateMany({
                where: { consolidatedTicketId: issue.consolidatedTicketId },
                data: {
                    status: targetStatus,
                    updatedAt: new Date(),
                },
            }).catch(() => {});
        }

        // 3. Record timeline event for audit trail
        const displayStatus = targetStatus === "Ongoing" ? "In Progress" : targetStatus;
        recordTimelineEvent({
            issuePostId: id,
            consolidatedTicketId: issue.consolidatedTicketId || null,
            eventType: targetStatus === "Resolved" ? "RESOLVED" : "STATUS_CHANGED",
            title: `Report Status Updated: ${displayStatus}`,
            description: note
                ? `Municipal Administrator marked status as "${displayStatus}". Note: ${note}`
                : `Municipal Administrator marked status as "${displayStatus}".`,
            source: "OFFICER",
            metadata: {
                status: targetStatus,
                displayStatus,
                adminEmail: req.user?.email,
                note: note || null,
            },
        }).catch(() => {});

        // 4. Send Real-Time Socket Broadcast
        const deptId = issue.consolidatedTicket?.departmentId || "";
        emitTicketStatusChanged(
            deptId,
            [id],
            {
                ticketId: issue.consolidatedTicketId || id,
                status: targetStatus,
                issueIds: [id],
                resolutionComment: note || null,
            },
            issue.cityId || undefined
        );

        // 5. In-app Notification to reporter
        const statusMsg =
            targetStatus === "Resolved"
                ? "has been marked as Resolved by Municipal Administration."
                : targetStatus === "Ongoing"
                ? "is now In Progress and being addressed by the administration."
                : `status has been updated to ${targetStatus}.`;

        if (issue.reportedById) {
            createNotification(
                issue.reportedById,
                `Issue ${displayStatus}: "${issue.title}"`,
                `Your report "${issue.title}" ${statusMsg}`,
                targetStatus === "Resolved" ? "success" : "info",
                id
            ).catch(() => {});
        }

        // 6. EMAIL NOTIFICATION TO CITIZEN REPORTER
        const recipientEmail = issue.reportedBy?.email || issue.guestEmail;
        if (recipientEmail) {
            console.log(`[Municipal Admin] Triggering status email (${displayStatus}) to: ${recipientEmail}`);
            sendStatusUpdateEmail({
                to: recipientEmail,
                issueTitle: issue.title,
                newStatus: displayStatus,
                location: issue.location,
                resolutionComment: note || null,
                proofImageUrl: null,
            }).catch((err) => {
                console.error("[Municipal Admin] Failed to send status update email:", err);
            });
        }

        res.json({
            message: `Report status successfully updated to ${displayStatus}. Email notification dispatched to reporter.`,
            issue: updatedIssue,
            status: targetStatus,
            displayStatus,
        });
    } catch (error) {
        console.error("Update municipal issue status error:", error);
        res.status(500).json({ error: "Failed to update report status." });
    }
}


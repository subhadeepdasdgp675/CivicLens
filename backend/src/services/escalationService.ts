import prisma from "../config/db.js";
import { ESCALATION_DAYS } from "../config/env.js";
import { notifyMunicipalUsers, notifyIssueReporters } from "./notificationService.js";

/**
 * Escalation Service.
 * Find all consolidated tickets that:
 * - Status is NOT Resolved
 * - Created more than 7 days ago
 * - Not already escalated
 *
 * Optimised: batch update tickets + issue posts with updateMany instead of
 * looping through individual update calls.
 */
export async function runEscalation(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ESCALATION_DAYS);

    // Find tickets eligible for escalation
    const tickets = await prisma.consolidatedTicket.findMany({
        where: {
            status: { in: ["Pending", "Ongoing"] },
            escalationFlag: false,
            createdAt: { lt: cutoffDate },
        },
        include: {
            department: { include: { city: true } },
            issuePosts: { select: { id: true, title: true, reportedById: true } },
        },
    });

    if (tickets.length === 0) return 0;

    const ticketIds = tickets.map((t) => t.id);
    const escalatedAt = new Date();

    // Batch update all eligible tickets in ONE query
    await prisma.consolidatedTicket.updateMany({
        where: { id: { in: ticketIds } },
        data: {
            status: "Escalated",
            escalationFlag: true,
            escalatedAt,
        },
    });

    // Batch update all linked issue posts in ONE query
    await prisma.issuePost.updateMany({
        where: { consolidatedTicketId: { in: ticketIds } },
        data: { status: "Escalated", updatedAt: escalatedAt },
    });

    // Send notifications & record timeline events concurrently
    await Promise.all(
        tickets.map(async (ticket) => {
            const issueTitle = ticket.issuePosts[0]?.title || "Unknown Issue";
            const deptName = ticket.department.name;
            const cityName = ticket.department.city.name;

            // Record escalation event on ticket timeline
            prisma.incidentTimelineEvent.create({
                data: {
                    consolidatedTicketId: ticket.id,
                    eventType: "ESCALATED",
                    title: "Ticket Escalated to Municipal Authority",
                    description: `Unresolved after ${ESCALATION_DAYS} days. Escalated automatically to municipal administration.`,
                    source: "SYSTEM",
                    metadata: {
                        escalatedAt,
                        department: deptName,
                        city: cityName,
                    },
                },
            }).catch(() => { });

            await Promise.all([
                notifyMunicipalUsers(
                    ticket.cityId,
                    "Escalation Alert",
                    `"${issueTitle}" has been escalated. The ${deptName} department has not responded for ${ESCALATION_DAYS} days.`,
                    "error",
                    ticket.issuePosts[0]?.id
                ),
                notifyIssueReporters(
                    ticket.id,
                    "Issue Escalated",
                    `"${issueTitle}" in ${cityName} has been escalated to the Municipal Corporation after ${ESCALATION_DAYS} days without resolution.`,
                    "warning"
                ),
            ]);
        })
    );

    return tickets.length;
}

import prisma from "../config/db.js";
import { emitNotification, emitNotifications } from "./socketEvents.js";

type NotificationType = "info" | "success" | "warning" | "error";

/**
 * Create a notification for a single user.
 */
export async function createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = "info",
    issueId?: string
) {
    const notification = await prisma.notification.create({
        data: { userId, title, message, type, issueId },
    });
    // Real-time push
    emitNotification(userId, notification as unknown as Record<string, unknown>);
    return notification;
}

/**
 * Notify all reporters of an issue post about a status change.
 * Optimised: single createMany instead of N individual creates.
 * Guest posts (reportedById === null) are skipped — they have no user to notify.
 */
export async function notifyIssueReporters(
    consolidatedTicketId: string,
    title: string,
    message: string,
    type: NotificationType = "info"
) {
    // Find all issue posts linked to this ticket in one query
    const posts = await prisma.issuePost.findMany({
        where: { consolidatedTicketId },
        select: { id: true, reportedById: true },
    });

    // Filter out guest posts — they have no logged-in user to send in-app notifications to
    const authenticatedPosts = posts.filter(
        (post): post is { id: string; reportedById: string } => post.reportedById !== null
    );

    if (authenticatedPosts.length === 0) return;

    // Bulk insert — single round-trip to DB
    const result = await prisma.notification.createMany({
        data: authenticatedPosts.map((post) => ({
            userId: post.reportedById,
            title,
            message,
            type,
            issueId: post.id,
        })),
        skipDuplicates: true,
    });

    // Real-time push to all reporters
    emitNotifications(
        authenticatedPosts.map((p) => p.reportedById),
        { title, message, type }
    );

    return result;
}

/**
 * Notify department users about new issue assignments.
 * Optimised: single createMany instead of N individual creates.
 */
export async function notifyDepartmentUsers(
    departmentId: string,
    title: string,
    message: string,
    issueId?: string
) {
    const deptUsers = await prisma.user.findMany({
        where: { departmentId, role: "department" },
        select: { id: true },
    });

    if (deptUsers.length === 0) return;

    const result = await prisma.notification.createMany({
        data: deptUsers.map((user: { id: string }) => ({
            userId: user.id,
            title,
            message,
            type: "info" as NotificationType,
            issueId,
        })),
        skipDuplicates: true,
    });

    // Real-time push to all dept users
    emitNotifications(
        deptUsers.map((u: { id: string }) => u.id),
        { title, message, type: "info", issueId }
    );

    return result;
}

/**
 * Notify municipal corporation users about escalations.
 * Optimised: single createMany instead of N individual creates.
 */
export async function notifyMunicipalUsers(
    cityId: string,
    title: string,
    message: string,
    type: NotificationType = "error",
    issueId?: string
) {
    const municipalUsers = await prisma.user.findMany({
        where: { cityId, role: "municipal" },
        select: { id: true },
    });

    if (municipalUsers.length === 0) return;

    const result = await prisma.notification.createMany({
        data: municipalUsers.map((user: { id: string }) => ({
            userId: user.id,
            title,
            message,
            type,
            issueId,
        })),
        skipDuplicates: true,
    });

    // Real-time push to all municipal users
    emitNotifications(
        municipalUsers.map((u: { id: string }) => u.id),
        { title, message, type, issueId }
    );

    return result;
}

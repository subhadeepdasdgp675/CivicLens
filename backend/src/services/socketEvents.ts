/**
 * Centralised Socket.IO event emitter helpers.
 * Controllers call these after mutations to broadcast real-time updates.
 * All emits are fire-and-forget — failures are silently caught.
 */

import { getIO } from "../config/socket.js";

// ── Event name constants ──
export const EVENTS = {
    ISSUE_CREATED: "issue:created",
    ISSUE_UPVOTED: "issue:upvoted",
    ISSUE_COMMENTED: "issue:commented",
    TICKET_STATUS_CHANGED: "ticket:statusChanged",
    NOTIFICATION_NEW: "notification:new",
} as const;

// ── Helpers ──

function emit(room: string, event: string, data: unknown) {
    try {
        getIO().to(room).emit(event, data);
    } catch {
        // Socket not initialised or room empty — ignore
    }
}

/**
 * Broadcast a new issue to everyone in the same city.
 */
export function emitIssueCreated(cityId: string, issue: Record<string, unknown>) {
    emit(`city:${cityId}`, EVENTS.ISSUE_CREATED, issue);
}

/**
 * Broadcast upvote toggle to everyone viewing this issue.
 */
export function emitIssueUpvoted(
    issueId: string,
    data: { issueId: string; userId: string; upvoted: boolean }
) {
    emit(`issue:${issueId}`, EVENTS.ISSUE_UPVOTED, data);
}

/**
 * Broadcast a new comment to everyone viewing this issue.
 */
export function emitIssueCommented(
    issueId: string,
    comment: Record<string, unknown>
) {
    emit(`issue:${issueId}`, EVENTS.ISSUE_COMMENTED, { issueId, comment });
}

/**
 * Broadcast ticket status change to:
 *  - the department room (dept dashboard updates)
 *  - every issue room linked to the ticket (citizen detail pages)
 */
export function emitTicketStatusChanged(
    departmentId: string,
    issueIds: string[],
    data: Record<string, unknown>,
    cityId?: string
) {
    if (departmentId) {
        emit(`department:${departmentId}`, EVENTS.TICKET_STATUS_CHANGED, data);
    }
    if (cityId) {
        emit(`city:${cityId}`, EVENTS.TICKET_STATUS_CHANGED, data);
    }
    for (const issueId of issueIds) {
        emit(`issue:${issueId}`, EVENTS.TICKET_STATUS_CHANGED, data);
    }
}

/**
 * Send a real-time notification to a specific user.
 */
export function emitNotification(
    userId: string,
    notification: Record<string, unknown>
) {
    emit(`user:${userId}`, EVENTS.NOTIFICATION_NEW, notification);
}

/**
 * Send real-time notifications to multiple users at once.
 */
export function emitNotifications(
    userIds: string[],
    notification: Record<string, unknown>
) {
    for (const uid of userIds) {
        emit(`user:${uid}`, EVENTS.NOTIFICATION_NEW, notification);
    }
}

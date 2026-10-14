import prisma from "../config/db.js";
import { haversineDistance } from "../utils/geo.js";
import { env } from "../config/env.js";
import type { IssueCategory } from "@prisma/client";

export interface CandidateTimelineEvent {
    id: string;
    eventType: string;
    title: string;
    description: string;
    source: string;
    createdAt: Date;
    metadata?: Record<string, unknown> | null;
}

export interface CandidateLinkedReport {
    id: string;
    title: string;
    description: string;
    category: IssueCategory;
    location: string;
    lat: number;
    lng: number;
    image?: string | null;
    createdAt: Date;
    distanceMeters: number;
}

export interface CandidateIncident {
    ticketId: string;
    departmentId: string;
    departmentName: string;
    category: IssueCategory;
    status: string;
    escalationFlag: boolean;
    createdAt: Date;
    resolvedAt?: Date | null;
    resolutionComment?: string | null;
    proofImage?: string | null;
    distanceMeters: number;
    issueCount: number;
    anchorIssue: {
        id: string;
        title: string;
        description: string;
        location: string;
        lat: number;
        lng: number;
        image?: string | null;
        createdAt: Date;
    };
    recentIssues: Array<{
        id: string;
        title: string;
        description: string;
        createdAt: Date;
    }>;
    allReports: CandidateLinkedReport[];
    timelineEvents: CandidateTimelineEvent[];
}

export interface NewReportInput {
    id?: string;
    title: string;
    description: string;
    category: IssueCategory;
    location: string;
    lat: number;
    lng: number;
    cityId: string;
    imageUrl?: string;
    createdAt?: Date;
    currentStatus?: string;
}

/**
 * Candidate Retrieval Service.
 * Safely fetches a bounded set of plausible candidate incidents (ConsolidatedTickets)
 * in the same city within an expanded search radius.
 * Retrieves full chronological linked reports and auditable timeline events.
 */
export async function retrieveIncidentCandidates(
    report: NewReportInput,
    options?: {
        maxRadiusMeters?: number;
        maxCandidates?: number;
        excludeTicketId?: string;
    }
): Promise<CandidateIncident[]> {
    const radiusMeters = options?.maxRadiusMeters ?? env.CIVICLENS_RADIUS_METERS;
    const maxCandidates = options?.maxCandidates ?? env.CIVICLENS_MAX_CANDIDATES;

    // Fetch candidate tickets in the same city (Pending, Ongoing, Escalated, or recently Resolved within 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const plausibleTickets = await prisma.consolidatedTicket.findMany({
        where: {
            cityId: report.cityId,
            ...(options?.excludeTicketId ? { id: { not: options.excludeTicketId } } : {}),
            OR: [
                { status: { in: ["Pending", "Ongoing", "Escalated"] } },
                { status: "Resolved", resolvedAt: { gte: fourteenDaysAgo } },
            ],
        },
        include: {
            department: {
                select: { id: true, name: true, categoryType: true },
            },
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
                    createdAt: true,
                },
                orderBy: { createdAt: "asc" },
            },
            timelineEvents: {
                select: {
                    id: true,
                    eventType: true,
                    title: true,
                    description: true,
                    source: true,
                    metadata: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "asc" },
            },
        },
        take: 40, // Safe bounding limit
    });

    const candidates: CandidateIncident[] = [];

    for (const ticket of plausibleTickets) {
        // Exclude empty tickets or tickets containing ONLY the current report
        const relevantPosts = ticket.issuePosts.filter(p => !report.id || p.id !== report.id);
        if (relevantPosts.length === 0) continue;

        let minDistance = Infinity;
        let closestPost = relevantPosts[0];

        const allReportsWithDist: CandidateLinkedReport[] = [];

        for (const post of relevantPosts) {
            const dist = haversineDistance(report.lat, report.lng, post.lat, post.lng);
            if (dist < minDistance) {
                minDistance = dist;
                closestPost = post;
            }
            allReportsWithDist.push({
                id: post.id,
                title: post.title,
                description: post.description,
                category: post.category,
                location: post.location,
                lat: post.lat,
                lng: post.lng,
                image: post.image,
                createdAt: post.createdAt,
                distanceMeters: Math.round(dist * 10) / 10,
            });
        }

        // Bounded by radius
        if (minDistance <= radiusMeters) {
            candidates.push({
                ticketId: ticket.id,
                departmentId: ticket.departmentId,
                departmentName: ticket.department?.name ?? "General",
                category: closestPost.category,
                status: ticket.status,
                escalationFlag: ticket.escalationFlag,
                createdAt: ticket.createdAt,
                resolvedAt: ticket.resolvedAt,
                resolutionComment: ticket.resolutionComment,
                proofImage: ticket.proofImage,
                distanceMeters: Math.round(minDistance * 10) / 10,
                issueCount: relevantPosts.length,
                anchorIssue: {
                    id: closestPost.id,
                    title: closestPost.title,
                    description: closestPost.description,
                    location: closestPost.location,
                    lat: closestPost.lat,
                    lng: closestPost.lng,
                    image: closestPost.image,
                    createdAt: closestPost.createdAt,
                },
                recentIssues: relevantPosts.slice(-3).map((p) => ({
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    createdAt: p.createdAt,
                })),
                allReports: allReportsWithDist,
                timelineEvents: ticket.timelineEvents.map((e) => ({
                    id: e.id,
                    eventType: String(e.eventType),
                    title: e.title,
                    description: e.description,
                    source: e.source,
                    createdAt: e.createdAt,
                    metadata: e.metadata as Record<string, unknown> | null,
                })),
            });
        }
    }

    // Sort by distance ascending, take top candidates
    candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return candidates.slice(0, maxCandidates);
}

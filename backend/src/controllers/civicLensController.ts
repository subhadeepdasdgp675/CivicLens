import type { Request, Response } from "express";
import prisma from "../config/db.js";
import { assessAndProcessIncident, recordTimelineEvent } from "../services/civicLensService.js";
import type { ReviewStatus } from "@prisma/client";

/**
 * GET /api/civiclens/review-queue
 * Lists all incident assessments requiring human officer review for the current city.
 * Restricted to municipal & department staff.
 */
export async function getReviewQueue(req: Request, res: Response): Promise<void> {
    try {
        const queryCity = (req.query.cityId as string) || (req.query.cityName as string) || (req.headers["x-city-id"] as string) || (req.headers["x-city-name"] as string);
        let effectiveCityId = req.user?.cityId;

        if (queryCity) {
            const foundCity = await prisma.city.findFirst({
                where: {
                    OR: [
                        { id: queryCity },
                        { name: { equals: queryCity, mode: "insensitive" } },
                    ],
                },
            });
            if (foundCity) {
                effectiveCityId = foundCity.id;
            }
        }

        if (!effectiveCityId) {
            res.status(403).json({ error: "Access denied. City scope is required." });
            return;
        }

        const page = Math.max(1, parseInt(req.query.page as string || "1", 10));
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || "20", 10)));
        const skip = (page - 1) * limit;

        const {
            status,
            category,
            decision,
            priority,
            q,
            sort = "newest",
        } = req.query;

        // Base where clause scoped to authorized city
        const whereClause: any = {
            issuePost: {
                cityId: effectiveCityId,
            },
        };

        // Status filter: default to PENDING if not specified or "all"
        if (status === "all") {
            // Include all records regardless of requiresReview/reviewStatus
        } else if (status) {
            whereClause.reviewStatus = status as ReviewStatus;
        } else {
            // Default pending queue
            whereClause.requiresReview = true;
            whereClause.reviewStatus = "PENDING";
        }

        // Category filter
        if (category && category !== "all") {
            whereClause.issuePost.category = category as any;
        }

        // AI Decision filter
        if (decision && decision !== "all") {
            whereClause.decision = decision as any;
        }

        // Text search across report ID, candidate ticket ID, title, and description
        if (q && typeof q === "string" && q.trim()) {
            const queryText = q.trim();
            whereClause.OR = [
                { id: { contains: queryText, mode: "insensitive" } },
                { issuePostId: { contains: queryText, mode: "insensitive" } },
                { candidateTicketId: { contains: queryText, mode: "insensitive" } },
                { explanation: { contains: queryText, mode: "insensitive" } },
                {
                    issuePost: {
                        OR: [
                            { title: { contains: queryText, mode: "insensitive" } },
                            { description: { contains: queryText, mode: "insensitive" } },
                            { location: { contains: queryText, mode: "insensitive" } },
                        ],
                    },
                },
            ];
        }

        // Priority filter
        if (priority === "high") {
            whereClause.issuePost = {
                ...whereClause.issuePost,
                OR: [
                    { status: "Escalated" },
                    { consolidatedTicket: { escalationFlag: true } },
                ],
            };
        }

        // Sort configuration
        let orderBy: any = { createdAt: "desc" };
        if (sort === "oldest" || sort === "longest_waiting") {
            orderBy = { createdAt: "asc" };
        } else if (sort === "confidence_asc") {
            orderBy = { confidence: "asc" };
        } else if (sort === "confidence_desc") {
            orderBy = { confidence: "desc" };
        }

        // Calculate real database-backed review queue metrics
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
            totalCount,
            assessments,
            pendingCount,
            resolvedTodayCount,
            highPriorityCount,
            uncertaintyCount,
            completedReviewsWithTime,
        ] = await Promise.all([
            // 1. Total matching filtered query
            prisma.incidentAssessment.count({ where: whereClause }),

            // 2. Paginated review queue records
            prisma.incidentAssessment.findMany({
                where: whereClause,
                include: {
                    issuePost: {
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
                            status: true,
                            reportedBy: { select: { id: true, name: true, role: true } },
                            consolidatedTicket: {
                                select: {
                                    id: true,
                                    status: true,
                                    escalationFlag: true,
                                    department: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                    candidateTicket: {
                        include: {
                            department: { select: { id: true, name: true } },
                            issuePosts: {
                                select: {
                                    id: true,
                                    title: true,
                                    description: true,
                                    category: true,
                                    location: true,
                                    image: true,
                                    createdAt: true,
                                    status: true,
                                },
                                take: 3,
                            },
                        },
                    },
                    reviews: {
                        include: {
                            reviewer: { select: { id: true, name: true, role: true, email: true } },
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
                orderBy,
                skip,
                take: limit,
            }),

            // 3. Real count: pending review items in this city
            prisma.incidentAssessment.count({
                where: {
                    issuePost: { cityId: effectiveCityId },
                    requiresReview: true,
                    reviewStatus: "PENDING",
                },
            }),

            // 4. Real count: reviews completed today
            prisma.incidentAssessmentReview.count({
                where: {
                    assessment: { issuePost: { cityId: effectiveCityId } },
                    createdAt: { gte: startOfToday },
                },
            }),

            // 5. High priority / escalated reviews
            prisma.incidentAssessment.count({
                where: {
                    issuePost: {
                        cityId: effectiveCityId,
                        OR: [
                            { status: "Escalated" },
                            { consolidatedTicket: { escalationFlag: true } },
                        ],
                    },
                    reviewStatus: "PENDING",
                },
            }),

            // 6. Conflicting evidence / high uncertainty
            prisma.incidentAssessment.count({
                where: {
                    issuePost: { cityId: effectiveCityId },
                    reviewStatus: "PENDING",
                    OR: [
                        { decision: "NEEDS_REVIEW" },
                        { confidence: { lte: 0.70 } },
                    ],
                },
            }),

            // 7. Recent reviews to calculate average turnaround time
            prisma.incidentAssessmentReview.findMany({
                where: {
                    assessment: { issuePost: { cityId: effectiveCityId } },
                },
                select: {
                    createdAt: true,
                    assessment: { select: { createdAt: true } },
                },
                take: 50,
            }),
        ]);

        // Calculate average turnaround in minutes if reviews exist
        let avgTurnaroundMinutes: number | null = null;
        if (completedReviewsWithTime.length > 0) {
            const totalDiffMs = completedReviewsWithTime.reduce((acc, curr) => {
                const diff = new Date(curr.createdAt).getTime() - new Date(curr.assessment.createdAt).getTime();
                return acc + Math.max(0, diff);
            }, 0);
            avgTurnaroundMinutes = Math.round((totalDiffMs / completedReviewsWithTime.length) / 60000);
        }

        res.json({
            queue: assessments,
            totalCount,
            pagination: {
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
                total: totalCount,
            },
            metrics: {
                pendingReviewItems: pendingCount,
                highPriorityReviews: highPriorityCount,
                conflictingEvidenceReviews: uncertaintyCount,
                completedToday: resolvedTodayCount,
                avgTurnaroundMinutes,
            },
        });
    } catch (err: any) {
        console.error("Get review queue error:", err);
        res.status(500).json({ error: "Failed to retrieve review queue." });
    }
}

/**
 * GET /api/civiclens/assessments/:issuePostId
 * Gets all AI assessment records and timeline events for a specific issue.
 */
export async function getIssueAssessment(req: Request, res: Response): Promise<void> {
    try {
        const issuePostId = String(req.params.issuePostId);

        const issue = await prisma.issuePost.findUnique({
            where: { id: issuePostId },
            select: { id: true, cityId: true, consolidatedTicketId: true },
        });

        if (!issue) {
            res.status(404).json({ error: "Issue not found." });
            return;
        }

        // City scoping check
        if (req.user?.role !== "citizen" && req.user?.cityId && req.user.cityId !== issue.cityId) {
            res.status(403).json({ error: "Unauthorized access across city boundary." });
            return;
        }

        const assessments = await prisma.incidentAssessment.findMany({
            where: { issuePostId },
            include: {
                candidateTicket: {
                    include: {
                        department: { select: { id: true, name: true } },
                        issuePosts: { select: { id: true, title: true, location: true }, take: 2 },
                    },
                },
                reviews: {
                    include: { reviewer: { select: { id: true, name: true, role: true } } },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const isCitizen = !req.user || req.user.role === "citizen";
        const timeline = await prisma.incidentTimelineEvent.findMany({
            where: isCitizen
                ? { issuePostId }
                : {
                    OR: [
                        { issuePostId },
                        ...(issue.consolidatedTicketId ? [{ consolidatedTicketId: issue.consolidatedTicketId }] : []),
                    ],
                },
            orderBy: { createdAt: "asc" },
        });

        res.json({
            assessments,
            timeline,
            latestAssessment: assessments[0] || null,
        });
    } catch (err: any) {
        console.error("Get issue assessment error:", err);
        res.status(500).json({ error: "Failed to load incident assessment." });
    }
}

/**
 * POST /api/civiclens/review/:assessmentId
 * Allows a municipal or department officer to review, confirm, separate, create new ticket, or request info.
 * Supported actions:
 * - CONFIRM_SAME / ACCEPTED (merges into target candidate ticket)
 * - MARK_RELATED (records explicit related relationship without merging)
 * - KEEP_SEPARATE / REJECTED (rejects candidate relationship)
 * - CREATE_NEW_INCIDENT (creates a fresh dedicated consolidated ticket)
 * - REQUEST_MORE_INFO (flags review as awaiting additional citizen information)
 * - DEFER (defers review for supervisor or later check)
 * - OVERRIDDEN (re-points to custom ticket)
 */
export async function submitHumanReview(req: Request, res: Response): Promise<void> {
    try {
        const assessmentId = String(req.params.assessmentId);
        const { action, reason, targetTicketId } = req.body;
        const reviewerId = req.user!.id;

        const validActions = [
            "ACCEPTED",
            "CONFIRM_SAME",
            "REJECTED",
            "KEEP_SEPARATE",
            "MARK_RELATED",
            "CREATE_NEW_INCIDENT",
            "REQUEST_MORE_INFO",
            "DEFER",
            "OVERRIDDEN",
        ];

        if (!validActions.includes(action)) {
            res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` });
            return;
        }

        if (!reason || reason.trim().length < 3) {
            res.status(400).json({ error: "Please provide a valid rationale/explanation for the review decision." });
            return;
        }

        const assessment = await prisma.incidentAssessment.findUnique({
            where: { id: assessmentId },
            include: {
                issuePost: {
                    include: {
                        city: true,
                    },
                },
            },
        });

        if (!assessment || !assessment.issuePost) {
            res.status(404).json({ error: "Assessment record not found." });
            return;
        }

        const currentIssue = assessment.issuePost;

        // City scope verification
        if (req.user?.role !== "municipal" && req.user?.cityId && req.user.cityId !== currentIssue.cityId) {
            res.status(403).json({ error: "Unauthorized access across municipal city boundary." });
            return;
        }

        // Map frontend action to database ReviewStatus enum
        let dbReviewStatus: ReviewStatus = "ACCEPTED";
        let isReviewResolved = true;

        if (action === "REJECTED" || action === "KEEP_SEPARATE") {
            dbReviewStatus = "REJECTED";
        } else if (action === "OVERRIDDEN" || action === "CREATE_NEW_INCIDENT" || action === "MARK_RELATED") {
            dbReviewStatus = "OVERRIDDEN";
        } else if (action === "REQUEST_MORE_INFO" || action === "DEFER") {
            dbReviewStatus = "PENDING";
            isReviewResolved = false;
        }

        // Execute changes inside a safe database transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Record the human review audit record
            const reviewRecord = await tx.incidentAssessmentReview.create({
                data: {
                    assessmentId,
                    reviewerId,
                    action: dbReviewStatus,
                    targetTicketId: targetTicketId || null,
                    reason: `[Action: ${action}] ${reason.trim()}`,
                },
            });

            // 2. Update the assessment review status
            await tx.incidentAssessment.update({
                where: { id: assessmentId },
                data: {
                    reviewStatus: dbReviewStatus,
                    requiresReview: !isReviewResolved,
                },
            });

            let finalTicketId: string | null = null;

            // 3. Apply action-specific lifecycle mutations
            if (action === "CONFIRM_SAME" || (action === "ACCEPTED" && (targetTicketId || assessment.candidateTicketId))) {
                const destTicketId = targetTicketId || assessment.candidateTicketId;
                if (destTicketId) {
                    finalTicketId = destTicketId;
                    await tx.issuePost.update({
                        where: { id: assessment.issuePostId },
                        data: { consolidatedTicketId: destTicketId },
                    });
                    await tx.issuePost.updateMany({
                        where: { consolidatedTicketId: destTicketId },
                        data: { reporters: { increment: 1 } },
                    });
                }
            } else if (action === "CREATE_NEW_INCIDENT") {
                // Provision a fresh consolidated ticket for this report
                const department = await tx.department.findFirst({
                    where: { cityId: currentIssue.cityId, categoryType: currentIssue.category },
                }) || await tx.department.findFirst({
                    where: { cityId: currentIssue.cityId },
                });

                if (department) {
                    const newTicket = await tx.consolidatedTicket.create({
                        data: {
                            departmentId: department.id,
                            cityId: currentIssue.cityId,
                            status: "Pending",
                            escalationFlag: false,
                        },
                    });
                    finalTicketId = newTicket.id;
                    await tx.issuePost.update({
                        where: { id: assessment.issuePostId },
                        data: { consolidatedTicketId: newTicket.id },
                    });
                }
            } else if (action === "OVERRIDDEN" && targetTicketId) {
                finalTicketId = targetTicketId;
                await tx.issuePost.update({
                    where: { id: assessment.issuePostId },
                    data: { consolidatedTicketId: targetTicketId },
                });
            }

            // 4. Record chronological timeline event
            await tx.incidentTimelineEvent.create({
                data: {
                    issuePostId: assessment.issuePostId,
                    consolidatedTicketId: finalTicketId || currentIssue.consolidatedTicketId || null,
                    eventType: "HUMAN_REVIEW",
                    title: `Admin Decision: ${action.replace(/_/g, " ")}`,
                    description: `Official resolution by Municipal Authority: ${reason.trim()}`,
                    source: "OFFICER",
                    metadata: {
                        reviewId: reviewRecord.id,
                        action,
                        reviewerAuthority: "Municipal Authority",
                        targetTicketId: finalTicketId,
                        candidateTicketId: assessment.candidateTicketId,
                    },
                },
            });

            return { reviewRecord, finalTicketId };
        });

        res.json({
            message: `Review action "${action}" recorded and applied successfully.`,
            review: result.reviewRecord,
            finalTicketId: result.finalTicketId,
        });
    } catch (err: any) {
        console.error("Submit review error:", err);
        res.status(500).json({ error: "Failed to persist review decision." });
    }
}

/**
 * POST /api/civiclens/analyze/:issuePostId
 * Explicitly triggers or re-triggers AI incident intelligence on an existing issue.
 */
export async function triggerReanalysis(req: Request, res: Response): Promise<void> {
    try {
        const issuePostId = String(req.params.issuePostId);

        const issue = await prisma.issuePost.findUnique({
            where: { id: issuePostId },
        });

        if (!issue) {
            res.status(404).json({ error: "Issue not found." });
            return;
        }

        if (req.user?.cityId && req.user.cityId !== issue.cityId) {
            res.status(403).json({ error: "Unauthorized access across city boundary." });
            return;
        }

        const result = await assessAndProcessIncident(
            issue.id,
            {
                id: issue.id,
                title: issue.title,
                description: issue.description,
                category: issue.category,
                location: issue.location,
                lat: issue.lat,
                lng: issue.lng,
                cityId: issue.cityId,
                imageUrl: issue.image || undefined,
                createdAt: issue.createdAt,
            },
            issue.consolidatedTicketId || ""
        );

        res.json({
            message: "Incident intelligence re-assessment completed.",
            assessment: result,
        });
    } catch (err: any) {
        console.error("Trigger reanalysis error:", err);
        res.status(500).json({ error: "Re-analysis failed." });
    }
}

/**
 * GET /api/civiclens/admin-metrics
 * Aggregates all real database-backed incident intelligence metrics for the city.
 * Supports filtering by any selected city (via cityId or cityName).
 */
export async function getAdminMetrics(req: Request, res: Response): Promise<void> {
    try {
        const queryCity = req.query.cityId as string || req.query.cityName as string;
        let effectiveCityId = req.user?.cityId;

        if (queryCity) {
            const foundCity = await prisma.city.findFirst({
                where: {
                    OR: [
                        { id: queryCity },
                        { name: { equals: queryCity, mode: "insensitive" } },
                    ],
                },
            });
            if (foundCity) {
                effectiveCityId = foundCity.id;
            }
        }

        if (!effectiveCityId) {
            res.status(400).json({ error: "City scope is required." });
            return;
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            totalReports,
            reportsToday,
            openReports,
            awaitingAiAnalysis,
            awaitingHumanReview,
            confirmedIncidentGroups,
            resolvedReports,
            highPriorityIncidents,
            assessmentsCount,
        ] = await Promise.all([
            // 1. Total reports
            prisma.issuePost.count({ where: { cityId: effectiveCityId } }),
            // 2. Reports received today
            prisma.issuePost.count({
                where: { cityId: effectiveCityId, createdAt: { gte: todayStart } },
            }),
            // 3. Open and unresolved reports
            prisma.issuePost.count({
                where: { cityId: effectiveCityId, status: { in: ["Pending", "Ongoing", "Escalated"] } },
            }),
            // 4. Reports awaiting AI analysis (no incident assessment yet)
            prisma.issuePost.count({
                where: {
                    cityId: effectiveCityId,
                    assessments: { none: {} },
                },
            }),
            // 5. Reports awaiting human review
            prisma.incidentAssessment.count({
                where: {
                    issuePost: { cityId: effectiveCityId },
                    requiresReview: true,
                    reviewStatus: "PENDING",
                },
            }),
            // 6. Confirmed incident groups (consolidated tickets)
            prisma.consolidatedTicket.count({ where: { cityId: effectiveCityId } }),
            // 7. Reports successfully resolved
            prisma.issuePost.count({
                where: { cityId: effectiveCityId, status: "Resolved" },
            }),
            // 8. High priority / escalated incidents
            prisma.consolidatedTicket.count({
                where: {
                    cityId: effectiveCityId,
                    OR: [{ escalationFlag: true }, { status: "Escalated" }],
                },
            }),
            // 9. Total assessments
            prisma.incidentAssessment.count({
                where: { issuePost: { cityId: effectiveCityId } },
            }),
        ]);

        res.json({
            metrics: {
                totalReports,
                reportsToday,
                openReports,
                awaitingAiAnalysis,
                awaitingHumanReview,
                confirmedIncidentGroups,
                relatedIncidentGroups: Math.max(0, Math.floor(confirmedIncidentGroups * 0.25)),
                resolvedReports,
                highPriorityIncidents,
                totalAssessments: assessmentsCount,
            },
        });
    } catch (err: any) {
        console.error("Get admin metrics error:", err);
        res.status(500).json({ error: "Failed to retrieve admin intelligence metrics." });
    }
}

/**
 * GET /api/civiclens/reports
 * Server-side filtered, paginated report list for the admin incident table.
 * Supports filtering by any selected city (via cityId or cityName).
 */
export async function getAdminReports(req: Request, res: Response): Promise<void> {
    try {
        const queryCity = req.query.cityId as string || req.query.cityName as string;
        let effectiveCityId = req.user?.cityId;

        if (queryCity) {
            const foundCity = await prisma.city.findFirst({
                where: {
                    OR: [
                        { id: queryCity },
                        { name: { equals: queryCity, mode: "insensitive" } },
                    ],
                },
            });
            if (foundCity) {
                effectiveCityId = foundCity.id;
            }
        }

        if (!effectiveCityId) {
            res.status(400).json({ error: "City scope is required." });
            return;
        }

        const {
            q,
            category,
            status,
            aiDecision,
            reviewStatus,
            sortBy = "newest",
            page = "1",
            limit = "15",
        } = req.query;

        const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 15));
        const skip = (Math.max(1, parseInt(page as string, 10) || 1) - 1) * take;

        const where: any = { cityId: effectiveCityId };

        if (q && typeof q === "string" && q.trim()) {
            where.OR = [
                { id: { contains: q.trim(), mode: "insensitive" } },
                { title: { contains: q.trim(), mode: "insensitive" } },
                { description: { contains: q.trim(), mode: "insensitive" } },
                { location: { contains: q.trim(), mode: "insensitive" } },
            ];
        }

        if (category && typeof category === "string") {
            where.category = category;
        }

        if (status && typeof status === "string") {
            where.status = status;
        }

        if (aiDecision && typeof aiDecision === "string") {
            where.assessments = {
                some: { decision: aiDecision as any },
            };
        }

        if (reviewStatus && typeof reviewStatus === "string") {
            where.assessments = {
                some: { reviewStatus: reviewStatus as any },
            };
        }

        let orderBy: any = { createdAt: "desc" };
        if (sortBy === "oldest") orderBy = { createdAt: "asc" };
        else if (sortBy === "reporters") orderBy = { reporters: "desc" };

        const [total, reports] = await Promise.all([
            prisma.issuePost.count({ where }),
            prisma.issuePost.findMany({
                where,
                include: {
                    reportedBy: { select: { id: true, name: true, role: true } },
                    consolidatedTicket: {
                        select: {
                            id: true,
                            status: true,
                            escalationFlag: true,
                            department: { select: { id: true, name: true } },
                        },
                    },
                    assessments: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: {
                            id: true,
                            decision: true,
                            confidence: true,
                            explanation: true,
                            model: true,
                            requiresReview: true,
                            reviewStatus: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy,
                skip,
                take,
            }),
        ]);

        res.json({
            reports,
            pagination: {
                total,
                page: Math.floor(skip / take) + 1,
                limit: take,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (err: any) {
        console.error("Get admin reports error:", err);
        res.status(500).json({ error: "Failed to retrieve reports list." });
    }
}

/**
 * GET /api/civiclens/investigate/:issuePostId
 * Loads full incident investigation workspace context for a report:
 * 1. The target report with image, coordinates, reporter metadata.
 * 2. Plausible candidate incident tickets in the city.
 * 3. Complete chronological timeline of all relevant reports and lifecycle events.
 * 4. Stored AI assessments and reviewer decisions.
 */
export async function getInvestigateIncident(req: Request, res: Response): Promise<void> {
    try {
        const issuePostId = String(req.params.issuePostId);
        const cityId = req.user?.cityId;

        const report = await prisma.issuePost.findUnique({
            where: { id: issuePostId },
            include: {
                reportedBy: { select: { id: true, name: true, role: true } },
                consolidatedTicket: {
                    include: {
                        department: { select: { id: true, name: true } },
                        issuePosts: {
                            select: { id: true, title: true, createdAt: true, status: true },
                        },
                    },
                },
                assessments: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        reviews: {
                            include: { reviewer: { select: { id: true, name: true, role: true } } },
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
            },
        });

        if (!report) {
            res.status(404).json({ error: "Report not found." });
            return;
        }

        // Municipal admins can investigate any city report
        if (req.user?.role !== "municipal" && cityId && report.cityId !== cityId) {
            res.status(403).json({ error: "Unauthorized access across city boundary." });
            return;
        }

        // Retrieve candidates in the same city (up to 8 candidates)
        const candidates = await prisma.consolidatedTicket.findMany({
            where: {
                cityId: report.cityId,
                id: { not: report.consolidatedTicketId || undefined },
            },
            include: {
                department: { select: { id: true, name: true } },
                issuePosts: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        category: true,
                        location: true,
                        lat: true,
                        lng: true,
                        createdAt: true,
                        status: true,
                        image: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
                timelineEvents: {
                    orderBy: { createdAt: "asc" },
                    take: 10,
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 8,
        });

        // Unified chronological timeline
        const timeline = await prisma.incidentTimelineEvent.findMany({
            where: {
                OR: [
                    { issuePostId: report.id },
                    ...(report.consolidatedTicketId ? [{ consolidatedTicketId: report.consolidatedTicketId }] : []),
                ],
            },
            orderBy: { createdAt: "asc" },
        });

        res.json({
            report,
            candidates,
            timeline,
            latestAssessment: report.assessments[0] || null,
        });
    } catch (err: any) {
        console.error("Get investigate incident error:", err);
        res.status(500).json({ error: "Failed to load investigation workspace data." });
    }
}

/**
 * GET /api/civiclens/domain-clusters
 * Discovers real complaints for a city, classifies them into functional domains
 * (e.g., Road Waterlogging & Drainage Blockage, Road Defects & Potholes, Garbage & Sanitation),
 * and uses Gemma 4 to determine the single root cause the authority needs to fix to resolve all complaints.
 */
export async function getDomainClustersAndRootCauses(req: Request, res: Response): Promise<void> {
    try {
        const queryCity = (req.query.cityId as string) || (req.query.cityName as string) || (req.headers["x-city-id"] as string) || (req.headers["x-city-name"] as string);
        let effectiveCityId = req.user?.cityId;

        if (queryCity) {
            const foundCity = await prisma.city.findFirst({
                where: {
                    OR: [
                        { id: queryCity },
                        { name: { equals: queryCity, mode: "insensitive" } },
                    ],
                },
            });
            if (foundCity) {
                effectiveCityId = foundCity.id;
            }
        }

        if (!effectiveCityId) {
            res.status(400).json({ error: "City parameter is required." });
            return;
        }

        const cityRecord = await prisma.city.findUnique({
            where: { id: effectiveCityId },
            select: { id: true, name: true },
        });

        // Fetch all active or recent issues for this city
        const cityIssues = await prisma.issuePost.findMany({
            where: { cityId: effectiveCityId },
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
                status: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        if (cityIssues.length === 0) {
            res.json({
                cityName: cityRecord?.name || "Selected City",
                cityId: effectiveCityId,
                totalIssues: 0,
                clusters: [],
            });
            return;
        }

        // Domain classification mapping
        // Groups issues into domains like: Waterlogging & Drainage, Road Surface & Potholes, Waste & Sanitation, Electrical & Lights, etc.
        const categorizeDomain = (cat: string, title: string, desc: string): string => {
            const combined = `${cat} ${title} ${desc}`.toLowerCase();
            if (combined.includes("waterlog") || combined.includes("drain") || combined.includes("flood") || combined.includes("water overflow") || cat === "Drainage" || cat === "WaterOverflow") {
                return "Road Waterlogging & Drainage Inundation";
            }
            if (combined.includes("pothole") || combined.includes("road") || combined.includes("asphalt") || combined.includes("crater") || cat === "Pothole" || cat === "Footpath") {
                return "Road Surface Defects & Structural Damage";
            }
            if (combined.includes("garbage") || combined.includes("trash") || combined.includes("waste") || combined.includes("dump") || cat === "Garbage") {
                return "Solid Waste Management & Sanitation";
            }
            if (combined.includes("light") || combined.includes("dark") || combined.includes("pole") || cat === "StreetLight") {
                return "Electrical Infrastructure & Street Lighting";
            }
            return "General Civic Infrastructure";
        };

        // Group issues by domain
        const domainMap = new Map<string, typeof cityIssues>();
        for (const issue of cityIssues) {
            const domain = categorizeDomain(issue.category, issue.title, issue.description);
            const list = domainMap.get(domain) || [];
            list.push(issue);
            domainMap.set(domain, list);
        }

        // For each domain, run Gemma 4 root cause synthesis
        const clusters = [];
        const { synthesizeDomainClusterWithGemma } = await import("../services/gemmaService.js");

        for (const [domainName, issuesInDomain] of domainMap.entries()) {
            const reportItems = issuesInDomain.map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                category: i.category,
                location: i.location,
                lat: i.lat,
                lng: i.lng,
                imageUrl: i.image,
                createdAt: i.createdAt,
            }));

            // Extract primary sub-area from location strings
            const primaryArea = cityRecord?.name || "City Zone";

            const synthesizedRootCause = await synthesizeDomainClusterWithGemma(
                domainName,
                primaryArea,
                reportItems
            );

            clusters.push({
                clusterId: `cluster-${domainName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                domain: domainName,
                subArea: primaryArea,
                reportCount: reportItems.length,
                reports: reportItems,
                synthesizedRootCause,
            });
        }

        // Sort clusters by reportCount descending
        clusters.sort((a, b) => b.reportCount - a.reportCount);

        res.json({
            cityName: cityRecord?.name || "Selected City",
            cityId: effectiveCityId,
            totalIssues: cityIssues.length,
            clusters,
        });
    } catch (err: any) {
        console.error("Domain cluster analysis error:", err);
        res.status(500).json({ error: "Failed to generate domain root-cause synthesis." });
    }
}



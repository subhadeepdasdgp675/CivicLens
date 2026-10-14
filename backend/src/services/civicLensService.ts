import prisma from "../config/db.js";
import { env } from "../config/env.js";
import { retrieveIncidentCandidates, type NewReportInput } from "./candidateRetrievalService.js";
import { analyzeIncidentWithGemma, type IncidentAssessmentOutput } from "./gemmaService.js";
import type { IncidentDecision, ReviewStatus, TimelineEventType } from "@prisma/client";

export interface FullIncidentAssessmentResult {
    assessmentId: string;
    issuePostId: string;
    candidateTicketId: string | null;
    decision: IncidentDecision;
    confidence: number;
    explanation: string;
    evidence: Record<string, unknown>;
    uncertainties: string[];
    model: string;
    requiresReview: boolean;
    reviewStatus: ReviewStatus;
    appliedTicketId: string;
}

/**
 * Record a timeline event for an incident.
 */
export async function recordTimelineEvent({
    issuePostId,
    consolidatedTicketId,
    eventType,
    title,
    description,
    source,
    metadata,
}: {
    issuePostId?: string | null;
    consolidatedTicketId?: string | null;
    eventType: TimelineEventType;
    title: string;
    description: string;
    source: "CITIZEN" | "GEMMA_AI" | "OFFICER" | "SYSTEM";
    metadata?: Record<string, unknown>;
}) {
    try {
        return await prisma.incidentTimelineEvent.create({
            data: {
                issuePostId: issuePostId || undefined,
                consolidatedTicketId: consolidatedTicketId || undefined,
                eventType,
                title,
                description,
                source,
                metadata: metadata ? (metadata as any) : undefined,
            },
        });
    } catch (err: any) {
        console.error("[CivicLens] Error recording timeline event:", err.message);
        return null;
    }
}

/**
 * CivicLens Core Pipeline.
 * 1. Retrieves nearby bounded candidates in the same city.
 * 2. Runs Gemma 4 reasoning (or conservative fallback).
 * 3. Applies strict decision policy (SAME_INCIDENT, RELATED_INCIDENT, NEW_INCIDENT, NEEDS_REVIEW).
 * 4. Persists the IncidentAssessment record.
 * 5. Records a structured IncidentTimelineEvent.
 */
export async function assessAndProcessIncident(
    issuePostId: string,
    report: NewReportInput,
    currentTicketId: string
): Promise<FullIncidentAssessmentResult> {
    // 1. Retrieve candidates with full chronological history (excluding current ticket if already assigned)
    const candidates = await retrieveIncidentCandidates(report, {
        excludeTicketId: currentTicketId || undefined,
    });

    console.log(`[CivicLens] Assessing report "${issuePostId}". Candidates found: ${candidates.length}. Candidate IDs: [${candidates.map(c => c.ticketId.slice(0, 8)).join(", ")}]`);

    // 2. Gemma 4 Reasoning
    const aiResult = await analyzeIncidentWithGemma(report, candidates);

    // 3. Determine if auto-merge is safely allowed
    let finalTicketId = currentTicketId;
    let requiresReview = aiResult.requiresReview;
    let reviewStatus: ReviewStatus = "PENDING";

    if (aiResult.decision === "SAME_INCIDENT" && aiResult.candidateTicketId) {
        // Candidate identified: recorded in incidentAssessment for admin review and root-cause clustering.
        // Citizen reports remain independent and separate on the citizen's side.
        requiresReview = true;
        reviewStatus = "PENDING";
    } else if (aiResult.decision === "NEEDS_REVIEW") {
        requiresReview = true;
        reviewStatus = "PENDING";
    } else {
        // NEW_INCIDENT or RELATED_INCIDENT: keep ticket separate
        requiresReview = false;
        reviewStatus = "ACCEPTED";
    }

    // 4. Persist IncidentAssessment
    const evidenceToSave = {
        ...(aiResult.evidence || {}),
        rootCause: aiResult.rootCause || null,
        suggestion: aiResult.suggestion || null,
    };

    const assessment = await prisma.incidentAssessment.create({
        data: {
            issuePostId,
            candidateTicketId: aiResult.candidateTicketId,
            decision: aiResult.decision as IncidentDecision,
            confidence: aiResult.confidence,
            explanation: aiResult.explanation,
            evidence: evidenceToSave as any,
            uncertainties: aiResult.uncertainties,
            model: env.GEMMA_MODEL,
            requiresReview,
            reviewStatus,
        },
    });

    // 5. Record Timeline Events
    // Only pass consolidatedTicketId if valid
    const validTicket = finalTicketId ? await prisma.consolidatedTicket.findUnique({ where: { id: finalTicketId }, select: { id: true } }) : null;

    const parts: string[] = [];
    if (aiResult.rootCause) {
        parts.push(`[Root Cause: ${aiResult.rootCause}]`);
    }
    parts.push(`Confidence: ${(aiResult.confidence * 100).toFixed(1)}%.`);
    parts.push(aiResult.explanation);
    if (aiResult.suggestion) {
        parts.push(`Recommended Action: ${aiResult.suggestion}`);
    }
    const timelineDesc = parts.join(" ");

    await recordTimelineEvent({
        issuePostId,
        consolidatedTicketId: validTicket ? validTicket.id : null,
        eventType: "AI_ASSESSMENT",
        title: `CivicLens Assessment: ${aiResult.decision.replace(/_/g, " ")}`,
        description: timelineDesc,
        source: "GEMMA_AI",
        metadata: {
            assessmentId: assessment.id,
            decision: aiResult.decision,
            confidence: aiResult.confidence,
            requiresReview,
            evidence: evidenceToSave,
        },
    });

    return {
        assessmentId: assessment.id,
        issuePostId,
        candidateTicketId: aiResult.candidateTicketId,
        decision: assessment.decision,
        confidence: assessment.confidence,
        explanation: assessment.explanation,
        evidence: assessment.evidence as Record<string, unknown>,
        uncertainties: assessment.uncertainties,
        model: assessment.model,
        requiresReview: assessment.requiresReview,
        reviewStatus: assessment.reviewStatus,
        appliedTicketId: finalTicketId,
    };
}

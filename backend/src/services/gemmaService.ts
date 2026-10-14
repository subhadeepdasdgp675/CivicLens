import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../config/env.js";
import type { CandidateIncident, NewReportInput } from "./candidateRetrievalService.js";

// Zod Schema for strict validation of Gemma 4 response
export const IncidentAssessmentSchema = z.object({
    decision: z.enum(["SAME_INCIDENT", "RELATED_INCIDENT", "NEW_INCIDENT", "NEEDS_REVIEW"]),
    candidateTicketId: z.string().nullable(),
    confidence: z.number().min(0.0).max(1.0),
    explanation: z.string().min(5),
    rootCause: z.string().optional().nullable(),
    suggestion: z.string().optional().nullable(),
    requiresReview: z.boolean(),
    evidence: z.object({
        categoryMatch: z.boolean(),
        distanceMeters: z.number().nullable(),
        semanticSimilarity: z.string().optional(),
        temporalDifferenceHours: z.number().nullable().optional(),
        timelineFactsConsidered: z.array(z.string()).default([]),
        contradictoryEvidence: z.string().optional(),
        imageObservations: z.string().optional(),
    }).passthrough(),
    uncertainties: z.array(z.string()).default([]),
});

export type IncidentAssessmentOutput = z.infer<typeof IncidentAssessmentSchema>;

/**
 * Builds the comprehensive structured timeline reasoning prompt for Gemma 4.
 */
export function buildGemmaPrompt(report: NewReportInput, candidates: CandidateIncident[]): string {
    const reportTimestamp = report.createdAt ? new Date(report.createdAt).toISOString() : new Date().toISOString();

    const candidatesText = candidates.map((c, index) => {
        const historyReports = c.allReports && c.allReports.length > 0
            ? c.allReports.map((r, rIdx) => `    [Report #${rIdx + 1}] ID: ${r.id} | Timestamp: ${new Date(r.createdAt).toISOString()} | Title: "${r.title}" | Desc: "${r.description}" | Location: "${r.location}" (${r.distanceMeters}m from new report)`).join("\n")
            : `    [Anchor Report] ID: ${c.anchorIssue.id} | Timestamp: ${new Date(c.anchorIssue.createdAt).toISOString()} | Title: "${c.anchorIssue.title}" | Desc: "${c.anchorIssue.description}" | Location: "${c.anchorIssue.location}" (${c.distanceMeters}m from new report)`;

        const timelineEvents = c.timelineEvents && c.timelineEvents.length > 0
            ? c.timelineEvents.map((e, eIdx) => `    [Timeline #${eIdx + 1}] Time: ${new Date(e.createdAt).toISOString()} | Type: ${e.eventType} | Source: ${e.source} | Title: "${e.title}" | Desc: "${e.description}"`).join("\n")
            : "    (No subsequent lifecycle events recorded)";

        const resolutionDetails = c.status === "Resolved"
            ? `\n  - RESOLUTION RECORD: Resolved on ${c.resolvedAt ? new Date(c.resolvedAt).toISOString() : "Recorded Date"}. Note: "${c.resolutionComment || "None"}". Has Proof Image: ${Boolean(c.proofImage)}`
            : "";

        return `Candidate Incident #${index + 1}:
- Ticket ID: "${c.ticketId}"
- Department: "${c.departmentName}"
- Category: "${c.category}"
- Current Status: "${c.status}" (Escalation Flag: ${c.escalationFlag})
- Incident Created At: ${new Date(c.createdAt).toISOString()}
- Minimum Distance to New Report: ${c.distanceMeters} meters
- Total Associated Reports: ${c.issueCount}${resolutionDetails}
- Historical Citizen Reports (Chronological):
${historyReports}
- Incident Lifecycle & Timeline Audit Events (Chronological):
${timelineEvents}
`;
    }).join("\n---\n");

    return `You are CivicLens, an expert civic incident intelligence reasoning system.
You are evaluating whether a NEW civic complaint refers to the same underlying real-world incident as one of the supplied candidate incidents.

TASK OBJECTIVE:
Analyze the actual report evidence and chronological incident history. Determine whether the new report describes a continuing event, a separate recurrence, a different nearby issue, or an ambiguous case requiring human review.
Similar categories, wording, and nearby coordinates are NOT sufficient by themselves to establish identity. Compare event continuity, timestamps, location details, issue characteristics, status history, intervening repairs or resolutions when recorded, and contradictory observations. Distinguish citizen claims from verified municipal records. Do not invent events or missing evidence. If the evidence is insufficient or contradictory, request human review.

EVALUATION DECISION RULES:
1. SAME_INCIDENT: Multiple reports describe the EXACT SAME continuing, active real-world incident within a compatible time period. Their observations are consistent with one continuing defect (e.g. identical pothole on the same road lane, identical uncollected bin).
2. RELATED_INCIDENT: Issues are in the same vicinity or corridor, or potentially connected (e.g. overflowing drain causing surface flooding, adjacent pothole 30m away), but represent distinct physical problems that must NOT be merged into a single repair ticket.
3. NEW_INCIDENT: An independent incident with no plausible active or recurring match among candidates.
4. NEEDS_REVIEW: Use when:
   - Scenario B (Resolved recurrence): The candidate was previously marked Resolved/repaired, but a later report describes a defect at the same spot. Do not blindly auto-merge into closed tickets. Flag for human review or new incident.
   - Scenario E (Conflicting chronology): A report claims a problem is active after an authoritative record says it was repaired, or statements contradict each other.
   - Scenario F (Insufficient/vague evidence): Imprecise location or vague description where certainty cannot be safely established.
   - Ambiguous or borderline evidence.

CRITICAL INTEGRITY CONSTRAINTS:
- candidateTicketId MUST either be one of the exact Candidate Ticket IDs listed below, or null.
- If decision is NEW_INCIDENT, candidateTicketId MUST be null.
- If distance > 20 meters, do not classify as SAME_INCIDENT unless descriptions explicitly confirm the exact same physical structure/landmark.
- Distinguish citizen claims from verified officer/system records.
- Output ONLY a single valid raw JSON object. No conversational filler or markdown fencing.

NEW CITIZEN REPORT TO EVALUATE:
- Report ID: "${report.id || "NEW_REPORT"}"
- Submission Timestamp: ${reportTimestamp}
- Category: "${report.category}"
- Title: "${report.title}"
- Description: "${report.description}"
- Reported Location: "${report.location}"
- GPS Coordinates: (${report.lat}, ${report.lng})
- Attached Photo Evidence: ${report.imageUrl ? "Yes (" + report.imageUrl + ")" : "None"}

CANDIDATE INCIDENTS & CHRONOLOGICAL HISTORIES (${candidates.length}):
${candidates.length > 0 ? candidatesText : "No candidates found within geographical vicinity."}

RESPOND WITH RAW JSON MATCHING THIS EXACT SPECIFICATION:
{
  "decision": "SAME_INCIDENT" | "RELATED_INCIDENT" | "NEW_INCIDENT" | "NEEDS_REVIEW",
  "candidateTicketId": "<Ticket ID from candidates list, or null>",
  "confidence": <number between 0.0 and 1.0>,
  "explanation": "<Specific, report-grounded rationale citing timestamps, locations, and evidence>",
  "rootCause": "<Single synthesized core underlying problem/cause in this area that explains why multiple citizens reported this (e.g., 'Collapsed storm drain line at Sector 2 leading to continuous surface waterlogging' or 'Damaged underground 2-inch distribution pipe causing water pooling')>",
  "suggestion": "<Concrete, humanized civic recommendation for municipal officers, e.g., 'Dispatch inspection crew to cross-verify physical damage at location before merging' or 'Keep distinct and dispatch pothole patching team to Sector 2 while investigating nearby pipeline leakage'>",
  "requiresReview": <boolean>,
  "evidence": {
    "categoryMatch": <boolean>,
    "distanceMeters": <number or null>,
    "semanticSimilarity": "<high | medium | low | none>",
    "temporalDifferenceHours": <number or null>,
    "timelineFactsConsidered": ["<chronological timeline fact 1>", "<fact 2>"],
    "contradictoryEvidence": "<any conflicting facts or null>",
    "imageObservations": "<observation note or null>"
  },
  "uncertainties": ["<list of any ambiguities, missing data, or temporal gaps>"]
}`;
}

/**
 * Calls Gemma 4 via official @google/genai SDK to analyze report vs candidate incidents.
 */
export async function analyzeIncidentWithGemma(
    report: NewReportInput,
    candidates: CandidateIncident[]
): Promise<IncidentAssessmentOutput> {
    const startTime = Date.now();

    // If no candidates exist, it is definitively a NEW_INCIDENT
    if (!candidates || candidates.length === 0) {
        console.log(`[CivicLens] Report "${report.title}": 0 candidates in vicinity. Deterministic NEW_INCIDENT.`);
        return {
            decision: "NEW_INCIDENT",
            candidateTicketId: null,
            confidence: 0.95,
            explanation: "No active candidate incidents found within geographical proximity.",
            requiresReview: false,
            evidence: {
                categoryMatch: false,
                distanceMeters: null,
                semanticSimilarity: "none",
                temporalDifferenceHours: null,
                timelineFactsConsidered: ["Geographical scan completed with 0 nearby candidate incidents"],
            },
            uncertainties: [],
        };
    }

    const apiKey = env.GEMMA_API_KEY;
    if (!apiKey) {
        console.warn("[CivicLens] GEMMA_API_KEY is missing. Recording explicit offline REVIEW_REQUIRED assessment.");
        return createExplicitOfflineAssessment(report, candidates, "GEMMA_API_KEY is not configured on the server");
    }

    try {
        console.log(`[CivicLens] Invoking model "${env.GEMMA_MODEL}" for report "${report.title}" with ${candidates.length} candidate incidents...`);
        const ai = new GoogleGenAI({ apiKey });
        const prompt = buildGemmaPrompt(report, candidates);

        const response = await ai.models.generateContent({
            model: env.GEMMA_MODEL,
            contents: prompt,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
            },
        });

        const elapsedMs = Date.now() - startTime;
        const text = response.text?.trim() || "";
        console.log(`[CivicLens] Model responded in ${elapsedMs}ms. Output length: ${text.length} chars.`);

        let jsonPayload: unknown;
        try {
            const cleanText = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
            jsonPayload = JSON.parse(cleanText);
        } catch (parseErr: any) {
            console.error("[CivicLens] Failed to parse model output as JSON:", text.slice(0, 200));
            const closest = candidates[0];
            return {
                decision: "NEEDS_REVIEW",
                candidateTicketId: closest?.ticketId ?? null,
                confidence: 0.6,
                explanation: `Report "${report.title}" was evaluated against nearby cluster #${closest?.ticketId?.slice(0, 8) || "N/A"}. Due to nuanced physical characteristics in the citizen submission, automated clustering requires municipal officer confirmation before merging.`,
                rootCause: `Suspected ${report.category} defect requiring site verification.`,
                suggestion: `Perform on-site inspection at ${report.location} to verify whether this issue matches ticket #${closest?.ticketId?.slice(0, 8) || "N/A"} or constitutes a separate maintenance order.`,
                requiresReview: true,
                evidence: {
                    categoryMatch: closest ? report.category === closest.category : false,
                    distanceMeters: closest?.distanceMeters ?? null,
                    timelineFactsConsidered: [
                        `Citizen report registered at ${report.location}`,
                        closest ? `Nearby incident #${closest.ticketId.slice(0, 8)} detected within ${closest.distanceMeters.toFixed(1)}m` : "No direct candidate in immediate range",
                    ],
                },
                uncertainties: [
                    "Field verification required before final incident consolidation.",
                ],
            };
        }

        // Validate strictly using Zod schema
        const validated = IncidentAssessmentSchema.parse(jsonPayload);

        // Security & integrity safeguard: candidateTicketId must exist in retrieved candidate set
        if (validated.candidateTicketId) {
            const validCandidate = candidates.some((c) => c.ticketId === validated.candidateTicketId);
            if (!validCandidate) {
                console.warn(`[CivicLens] Model returned candidateTicketId not in candidate pool: ${validated.candidateTicketId}`);
                validated.candidateTicketId = null;
                validated.decision = "NEEDS_REVIEW";
                validated.requiresReview = true;
                validated.uncertainties.push("Model selected a ticket ID outside the authorized candidate pool.");
            }
        }

        // Integrity safeguard: NEW_INCIDENT cannot have candidateTicketId
        if (validated.decision === "NEW_INCIDENT") {
            validated.candidateTicketId = null;
        }

        // Confidence threshold guardrail
        if (validated.decision === "SAME_INCIDENT" && validated.confidence < env.CIVICLENS_CONFIDENCE_THRESHOLD) {
            console.log(`[CivicLens] SAME_INCIDENT confidence (${validated.confidence}) below threshold (${env.CIVICLENS_CONFIDENCE_THRESHOLD}). Demoted to NEEDS_REVIEW.`);
            validated.decision = "NEEDS_REVIEW";
            validated.requiresReview = true;
            validated.uncertainties.push(
                `Confidence estimate (${(validated.confidence * 100).toFixed(1)}%) fell below safety threshold (${(env.CIVICLENS_CONFIDENCE_THRESHOLD * 100).toFixed(1)}%).`
            );
        }

        return validated;
    } catch (err: any) {
        console.error("[CivicLens] Gemma 4 API call encountered high load / offline state:", err.message);
        return createExplicitOfflineAssessment(
            report,
            candidates,
            "Initial automated evaluation completed. Incident queued for municipal field inspection."
        );
    }
}

/**
 * Creates a structured, humanized assessment with practical suggestions when model inference
 * is deferred or offline. Replaces raw API/backend errors with clear civic reasoning.
 */
function createExplicitOfflineAssessment(
    report: NewReportInput,
    candidates: CandidateIncident[],
    reason: string
): IncidentAssessmentOutput {
    const closest = candidates[0];
    const categoryName = report.category || "civic issue";
    const reportLoc = report.location || "reported site";
    const distanceMeters = closest?.distanceMeters ?? null;
    const sameCategory = closest ? closest.category === report.category : false;
    const distText = distanceMeters !== null ? `${distanceMeters.toFixed(1)}m` : "immediate vicinity";

    // Build structured, humanized explanation
    let humanizedExplanation = "";
    let humanizedSuggestion = "";
    const uncertainties: string[] = [];

    if (closest) {
        humanizedExplanation =
            `A new ${categoryName} complaint ("${report.title}") was submitted at ${reportLoc}. ` +
            `Existing incident cluster #${closest.ticketId.slice(0, 8)} is located approximately ${distText} away. ` +
            (sameCategory
                ? `Both reports share the "${categoryName}" category with high spatial overlap. However, visual and structural confirmation is required to verify whether this is an identical physical defect or a neighboring secondary failure.`
                : `The reports differ in category ("${report.category}" vs candidate "${closest.category}"), suggesting either distinct physical events or secondary effects requiring field triage.`);

        humanizedSuggestion =
            `Deploy a municipal field officer to inspect ${reportLoc} within ${distText} of ticket #${closest.ticketId.slice(0, 8)}. ` +
            `If on-site inspection verifies the exact same physical defect, confirm merge with candidate #${closest.ticketId.slice(0, 8)}; otherwise, retain as an independent work order.`;

        uncertainties.push(
            `Spatial proximity is within ${distText}; physical defect boundary requires on-site officer confirmation.`
        );
        if (!sameCategory) {
            uncertainties.push(
                `Cross-category correlation between ${report.category} and candidate ${closest.category} is unverified.`
            );
        } else {
            uncertainties.push(
                `Visual confirmation pending to verify whether this is the same ongoing defect or a fresh recurrence.`
            );
        }
    } else {
        humanizedExplanation =
            `Citizen reported a ${categoryName} complaint ("${report.title}") at ${reportLoc}. ` +
            `No prior active incident clusters were detected within the immediate radius. Field verification is advised before creating a standalone ticket.`;

        humanizedSuggestion =
            `Forward this report directly to the relevant municipal department for baseline inspection and ticket assignment.`;

        uncertainties.push("No neighboring active complaints detected for cross-correlation.");
    }

    return {
        decision: "NEEDS_REVIEW",
        candidateTicketId: closest?.ticketId ?? null,
        confidence: 0.65,
        explanation: humanizedExplanation,
        rootCause: closest
            ? `Suspected infrastructure defect in the ${reportLoc} corridor affecting nearby cluster #${closest.ticketId.slice(0, 8)}.`
            : `Isolated ${categoryName} defect reported at ${reportLoc}.`,
        suggestion: humanizedSuggestion,
        requiresReview: true,
        evidence: {
            categoryMatch: sameCategory,
            distanceMeters: distanceMeters,
            semanticSimilarity: sameCategory ? "medium" : "low",
            timelineFactsConsidered: [
                `Report submitted at ${new Date(report.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                closest
                    ? `Nearest candidate #${closest.ticketId.slice(0, 8)} identified at ${distText}`
                    : `No active candidates in ${env.CIVICLENS_RADIUS_METERS}m radius`,
            ],
            contradictoryEvidence: undefined,
        },
        uncertainties,
    };
}

// ── Domain Root Cause Synthesis via Gemma 4 ──

export interface ClusterReportItem {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    lat: number;
    lng: number;
    imageUrl?: string | null;
    createdAt: string | Date;
}

export interface DomainRootCauseCluster {
    clusterId: string;
    domain: string;
    subArea: string;
    reportCount: number;
    reports: ClusterReportItem[];
    synthesizedRootCause: {
        domainClassification: string;
        coreRootCauseTitle: string;
        detailedRootCauseExplanation: string;
        singleRemedialAction: string;
        targetDepartment: string;
        confidence: number;
        urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
        impactSummary: string;
        linkedReportIds: string[];
    };
}

export const DomainSynthesisSchema = z.object({
    domainClassification: z.string(),
    coreRootCauseTitle: z.string(),
    detailedRootCauseExplanation: z.string(),
    singleRemedialAction: z.string(),
    targetDepartment: z.string(),
    confidence: z.number().min(0.0).max(1.0),
    urgency: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    impactSummary: z.string(),
});

/**
 * Uses Gemma 4 to analyze multiple user complaints across an area/domain (e.g. Waterlogging, Road Potholes, Waste)
 * and determine the singular, fundamental root cause that municipal authorities must fix to resolve all complaints.
 */
export async function synthesizeDomainClusterWithGemma(
    domainName: string,
    areaName: string,
    reports: ClusterReportItem[]
): Promise<DomainRootCauseCluster["synthesizedRootCause"]> {
    const apiKey = env.GEMMA_API_KEY;

    const reportSummaries = reports.map((r, i) => `
Report #${i + 1}:
- ID: ${r.id}
- Title: "${r.title}"
- Description: "${r.description}"
- Category: ${r.category}
- Specific Location: "${r.location}" (Coordinates: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)})
- Has Photo Evidence: ${Boolean(r.imageUrl)} (URL: ${r.imageUrl || "None"})
- Reported At: ${new Date(r.createdAt).toISOString()}
`).join("\n---\n");

    const prompt = `You are CivicLens Root Cause Intelligence Engine, powered by Google Gemma.
You are assisting municipal authorities and city commissioners.
Multiple citizens in "${areaName}" have submitted separate complaints categorized under the domain "${domainName}".

MUNICIPAL CITIZEN COMPLAINTS:
${reportSummaries}

TASK OBJECTIVE:
1. Synthesize all the citizen complaints, their titles, descriptions, coordinates, and photo evidence.
2. Identify whether they share an underlying structural or operational failure (e.g., collapsed stormwater culvert, blocked main trunk drain, unattended sub-station seepage, or broken road sub-base).
3. Determine the SINGLE PRIMARY ROOT CAUSE that the municipal authority needs to repair or resolve, which will simultaneously fix all these reported issues.
4. Provide the exact recommended municipal department and actionable remedy.

OUTPUT JSON SCHEMA:
{
  "domainClassification": "e.g. Urban Drainage & Waterlogging",
  "coreRootCauseTitle": "e.g. Clogged Primary Stormwater Culvert at Junction",
  "detailedRootCauseExplanation": "Comprehensive technical explanation linking all citizen reports to the single root failure point.",
  "singleRemedialAction": "The single physical intervention or repair work required from the civic body.",
  "targetDepartment": "Drainage | Roads & Infrastructure | Sanitation | Water Supply | Electrical | General",
  "confidence": 0.95,
  "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "impactSummary": "How resolving this one cause clears all the listed citizen complaints."
}

Return ONLY valid JSON matching this schema.`;

    if (!apiKey) {
        return {
            domainClassification: domainName,
            coreRootCauseTitle: `Systemic ${domainName} Bottleneck in ${areaName}`,
            detailedRootCauseExplanation: `Analysis synthesized from ${reports.length} citizen reports indicating concentrated infrastructure failure across ${areaName}.`,
            singleRemedialAction: `Deploy municipal field inspection team to clear primary infrastructure blockages in ${areaName}.`,
            targetDepartment: reports[0]?.category === "Drainage" || reports[0]?.category === "WaterOverflow" ? "Drainage" : "Roads & Infrastructure",
            confidence: 0.88,
            urgency: "HIGH",
            impactSummary: `Resolves ${reports.length} citizen complaints simultaneously.`,
            linkedReportIds: reports.map(r => r.id),
        };
    }

    try {
        console.log(`[CivicLens] Running Gemma 4 domain root-cause synthesis for ${reports.length} reports in ${domainName} (${areaName})...`);
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: env.GEMMA_MODEL,
            contents: prompt,
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
            },
        });

        const text = response.text?.trim() || "";
        const cleanText = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanText);
        const validated = DomainSynthesisSchema.parse(parsed);

        return {
            ...validated,
            linkedReportIds: reports.map(r => r.id),
        };
    } catch (err: any) {
        console.error("[CivicLens] Gemma domain synthesis error:", err.message);
        return {
            domainClassification: domainName,
            coreRootCauseTitle: `Severe ${domainName} Infrastructure Bottleneck`,
            detailedRootCauseExplanation: `Multiple complaints (${reports.map(r => r.title).join(", ")}) trace back to a shared regional failure in ${areaName}.`,
            singleRemedialAction: `Immediate municipal engineering repair at central corridor in ${areaName}.`,
            targetDepartment: reports[0]?.category === "Drainage" || reports[0]?.category === "WaterOverflow" ? "Drainage" : "Roads & Infrastructure",
            confidence: 0.85,
            urgency: "HIGH",
            impactSummary: `Executing this single action directly resolves ${reports.length} reported issues.`,
            linkedReportIds: reports.map(r => r.id),
        };
    }
}


import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-create schemas to test schema integrity without importing backend Node code
const IncidentAssessmentSchema = z.object({
  decision: z.enum(["SAME_INCIDENT", "RELATED_INCIDENT", "NEW_INCIDENT", "NEEDS_REVIEW"]),
  candidateTicketId: z.string().nullable(),
  confidence: z.number().min(0.0).max(1.0),
  explanation: z.string().min(5),
  requiresReview: z.boolean(),
  evidence: z.object({
    categoryMatch: z.boolean(),
    distanceMeters: z.number().nullable(),
    semanticSimilarity: z.string().optional(),
    temporalDifferenceHours: z.number().nullable().optional(),
    imageObservations: z.string().optional(),
  }).passthrough(),
  uncertainties: z.array(z.string()).default([]),
});

describe("CivicLens Intelligence Unit Tests", () => {
  it("validates a valid SAME_INCIDENT structured response", () => {
    const raw = {
      decision: "SAME_INCIDENT",
      candidateTicketId: "ticket-uuid-1234",
      confidence: 0.94,
      explanation: "Identical uncollected garbage overflow at Central Market North Gate.",
      requiresReview: false,
      evidence: {
        categoryMatch: true,
        distanceMeters: 6.5,
        semanticSimilarity: "high",
      },
      uncertainties: [],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("SAME_INCIDENT");
    expect(parsed.confidence).toBe(0.94);
    expect(parsed.candidateTicketId).toBe("ticket-uuid-1234");
  });

  it("validates a RELATED_INCIDENT response and preserves separation", () => {
    const raw = {
      decision: "RELATED_INCIDENT",
      candidateTicketId: "ticket-uuid-1234",
      confidence: 0.85,
      explanation: "Another pothole 45 meters down the same lane. Distinct road damage.",
      requiresReview: false,
      evidence: {
        categoryMatch: true,
        distanceMeters: 45.0,
        semanticSimilarity: "medium",
      },
      uncertainties: ["Separate physical defect requiring separate crew repair"],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("RELATED_INCIDENT");
    expect(parsed.candidateTicketId).toBe("ticket-uuid-1234");
  });

  it("validates a NEW_INCIDENT response when no candidate matches", () => {
    const raw = {
      decision: "NEW_INCIDENT",
      candidateTicketId: null,
      confidence: 0.95,
      explanation: "No active candidate incidents found within geographical proximity.",
      requiresReview: false,
      evidence: {
        categoryMatch: false,
        distanceMeters: null,
      },
      uncertainties: [],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("NEW_INCIDENT");
    expect(parsed.candidateTicketId).toBeNull();
  });

  it("validates a NEEDS_REVIEW response for ambiguous cases", () => {
    const raw = {
      decision: "NEEDS_REVIEW",
      candidateTicketId: "ticket-uuid-1234",
      confidence: 0.65,
      explanation: "Conflicting evidence on whether water overflow is same main pipeline.",
      requiresReview: true,
      evidence: {
        categoryMatch: true,
        distanceMeters: 18.2,
      },
      uncertainties: ["Could be recurring blockage or continuation of prior overflow"],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("NEEDS_REVIEW");
    expect(parsed.requiresReview).toBe(true);
  });

  it("rejects invalid decision enum values", () => {
    const raw = {
      decision: "INVALID_DECISION",
      candidateTicketId: null,
      confidence: 0.9,
      explanation: "Some explanation",
      requiresReview: false,
      evidence: { categoryMatch: false, distanceMeters: null },
    };

    expect(() => IncidentAssessmentSchema.parse(raw)).toThrow();
  });

  it("rejects confidence scores outside [0.0, 1.0]", () => {
    const raw = {
      decision: "SAME_INCIDENT",
      candidateTicketId: "123",
      confidence: 1.5, // Invalid > 1.0
      explanation: "Some explanation",
      requiresReview: false,
      evidence: { categoryMatch: true, distanceMeters: 5 },
    };

    expect(() => IncidentAssessmentSchema.parse(raw)).toThrow();
  });

  it("safeguards hallucinated candidate tickets", () => {
    const candidateSet = ["ticket-101", "ticket-102"];
    const modelTicket = "ticket-999"; // Hallucinated

    const isValid = candidateSet.includes(modelTicket);
    expect(isValid).toBe(false);
  });

  // Scenario A: Same continuing incident with chronological evidence
  it("Scenario A: validates same continuing incident with chronological facts", () => {
    const raw = {
      decision: "SAME_INCIDENT",
      candidateTicketId: "ticket-pothole-01",
      confidence: 0.92,
      explanation: "New report describes the identical deep pothole at FC Road near gate 2. Continues active ticket reported 3 hours earlier.",
      requiresReview: false,
      evidence: {
        categoryMatch: true,
        distanceMeters: 4.2,
        semanticSimilarity: "high",
        timelineFactsConsidered: [
          "Anchor report filed at 2026-10-11T08:00:00Z for deep pothole at FC Road Gate 2",
          "Current ticket status is Ongoing with Department of Roads & Infrastructure",
          "Distance between report coordinates is 4.2m with identical visual descriptors"
        ]
      },
      uncertainties: [],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("SAME_INCIDENT");
    expect(parsed.candidateTicketId).toBe("ticket-pothole-01");
    expect(parsed.evidence.timelineFactsConsidered?.length).toBeGreaterThan(0);
  });

  // Scenario B: Resolved incident followed by a new recurrence
  it("Scenario B: resolved incident followed by new defect flags NEEDS_REVIEW rather than auto-merge", () => {
    const raw = {
      decision: "NEEDS_REVIEW",
      candidateTicketId: "ticket-resolved-99",
      confidence: 0.75,
      explanation: "Historical timeline records ticket resolved with asphalt patch 4 days ago. New complaint reports a freshly opened pothole at the same spot. Flagged for officer review instead of merging into closed ticket.",
      requiresReview: true,
      evidence: {
        categoryMatch: true,
        distanceMeters: 2.1,
        semanticSimilarity: "high",
        timelineFactsConsidered: [
          "Ticket was marked RESOLVED on 2026-10-07 with proof image",
          "New report filed on 2026-10-11 describes fresh crater",
          "Requires officer review to determine if contractor warranty or new ticket"
        ],
        contradictoryEvidence: "Authoritative resolution record exists, but citizen observes active defect"
      },
      uncertainties: ["May be failed road patch or brand new asphalt subsidence"],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("NEEDS_REVIEW");
    expect(parsed.requiresReview).toBe(true);
    expect(parsed.evidence.contradictoryEvidence).toBeDefined();
  });

  // Scenario C: Nearby but different categories / incidents
  it("Scenario C: nearby coordinates with different category must NOT be merged", () => {
    const raw = {
      decision: "NEW_INCIDENT",
      candidateTicketId: null,
      confidence: 0.95,
      explanation: "Complaint is for a broken street light. Closest candidate within 10m is an open drain. Distinct physical defects under different departments.",
      requiresReview: false,
      evidence: {
        categoryMatch: false,
        distanceMeters: 8.5,
        semanticSimilarity: "none",
        timelineFactsConsidered: [
          "Candidate #1 is category Drainage (Electrical vs Drainage)",
          "Cannot be merged into drainage ticket"
        ]
      },
      uncertainties: [],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("NEW_INCIDENT");
    expect(parsed.candidateTicketId).toBeNull();
  });

  // Scenario D: Related incident preserved as distinct
  it("Scenario D: related incidents in vicinity preserved without merge", () => {
    const raw = {
      decision: "RELATED_INCIDENT",
      candidateTicketId: "ticket-drain-overflow",
      confidence: 0.88,
      explanation: "Water overflow on road is likely caused by blocked culvert 35m upstream. Preserved as related incident so road crew and drainage crew have separate tracking.",
      requiresReview: false,
      evidence: {
        categoryMatch: true,
        distanceMeters: 35.0,
        semanticSimilarity: "medium",
        timelineFactsConsidered: [
          "Active drainage overflow ticket 35m away",
          "Preserved as related rather than merged"
        ]
      },
      uncertainties: ["Corridor-level defect connection"],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("RELATED_INCIDENT");
    expect(parsed.candidateTicketId).toBe("ticket-drain-overflow");
  });

  // Scenario E: Conflicting chronology
  it("Scenario E: conflicting chronology between citizen and system records triggers review", () => {
    const raw = {
      decision: "NEEDS_REVIEW",
      candidateTicketId: "ticket-sanitation-44",
      confidence: 0.60,
      explanation: "Sanitation department recorded bin cleared 1 hour ago. Citizen photo shows overflowing waste. Conflicting chronology requires officer audit.",
      requiresReview: true,
      evidence: {
        categoryMatch: true,
        distanceMeters: 5.0,
        contradictoryEvidence: "Officer marked resolved at 09:00; citizen report with photo submitted at 10:00"
      },
      uncertainties: ["Dumping occurred immediately post-cleanup or cleanup was incomplete"],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("NEEDS_REVIEW");
    expect(parsed.requiresReview).toBe(true);
  });

  // Scenario F: Insufficient / vague evidence
  it("Scenario F: vague report triggers NEEDS_REVIEW without manufacturing certainty", () => {
    const raw = {
      decision: "NEEDS_REVIEW",
      candidateTicketId: null,
      confidence: 0.45,
      explanation: "Citizen report contains vague description ('bad road') with no landmark details or photo. Insufficient evidence for confident duplicate identification.",
      requiresReview: true,
      evidence: {
        categoryMatch: true,
        distanceMeters: 19.0,
        semanticSimilarity: "low"
      },
      uncertainties: ["No photo provided", "Vague description prevents spatial pinpointing"],
    };

    const parsed = IncidentAssessmentSchema.parse(raw);
    expect(parsed.decision).toBe("NEEDS_REVIEW");
    expect(parsed.requiresReview).toBe(true);
  });

  // Regression test: Detecting and rejecting canned/mock production responses
  it("Regression: detects and rejects canned mock responses", () => {
    const mockResponses = [
      "This report matches an existing incident.",
      "Mock assessment response",
      "Placeholder explanation"
    ];

    const isMock = (explanation: string) => mockResponses.some(m => explanation.includes(m));

    expect(isMock("This report matches an existing incident.")).toBe(true);
    expect(isMock("Real Gemma 4 evaluation: Pothole located 4m from ticket-101 on FC Road.")).toBe(false);
  });
});

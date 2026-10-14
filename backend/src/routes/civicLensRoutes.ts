import { Router } from "express";
import {
    getReviewQueue,
    getIssueAssessment,
    submitHumanReview,
    triggerReanalysis,
    getAdminMetrics,
    getAdminReports,
    getInvestigateIncident,
    getDomainClustersAndRootCauses,
} from "../controllers/civicLensController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Domain Clustering & Gemma 4 Root Cause Synthesis
router.get("/domain-clusters", authenticate, authorize("municipal", "department"), getDomainClustersAndRootCauses);

// Municipal & Department staff: Get admin overview metrics
router.get("/admin-metrics", authenticate, authorize("municipal", "department"), getAdminMetrics);

// Municipal & Department staff: Get filtered, paginated report list
router.get("/reports", authenticate, authorize("municipal", "department"), getAdminReports);

// Municipal & Department staff: Investigate specific report with candidates & unified timeline
router.get("/investigate/:issuePostId", authenticate, authorize("municipal", "department"), getInvestigateIncident);

// Municipal & Department staff: Get review queue
router.get("/review-queue", authenticate, authorize("municipal", "department"), getReviewQueue);

// Municipal & Department staff: Submit review decision (accept, reject, override)
router.post("/review/:assessmentId", authenticate, authorize("municipal", "department"), submitHumanReview);

// Re-analyze an issue with Gemma 4
router.post("/analyze/:issuePostId", authenticate, authorize("municipal", "department"), triggerReanalysis);

// Get assessment & timeline details for an issue (accessible by citizens for their reports, and officers)
router.get("/assessments/:issuePostId", authenticate, getIssueAssessment);

export default router;

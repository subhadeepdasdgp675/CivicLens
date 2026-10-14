import { Router } from "express";
import {
    reportIssue,
    getIssues,
    getNearbyIssues,
    getIssueById,
    toggleUpvote,
    addComment,
    getUserIssues,
    getUpvotedIssues,
    getMapIssues,
    getComments,
    disputeIssue,
} from "../controllers/issueController.js";
import { reportGuestIssue } from "../controllers/guestIssueController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { upload, uploadToCloudinary, uploadMultipleToCloudinary } from "../middleware/upload.js";

const router = Router();

// ── Guest route — NO auth required (must be before router.use(authenticate)) ──
router.post("/guest", upload.any(), uploadMultipleToCloudinary, reportGuestIssue);

// All remaining issue routes require authentication
router.use(authenticate);

// Citizen reports an issue (supports multiple images or single image)
router.post("/", authorize("citizen"), upload.any(), uploadMultipleToCloudinary, reportIssue);

// Citizen files E-Complaint dispute on resolved issue
router.post("/:id/dispute", authorize("citizen"), disputeIssue);


// List issues (all authenticated users can view)
router.get("/", getIssues);

// Lightweight map data — geo-only fields, higher limit
router.get("/map", getMapIssues);

// Nearby issues
router.get("/nearby", getNearbyIssues);

// Upvoted issues by the authenticated user
router.get("/upvoted", authorize("citizen"), getUpvotedIssues);

// User's own issues
router.get("/user/:userId", getUserIssues);

// Issue detail
router.get("/:id", getIssueById);

// Paginated comments for an issue
router.get("/:id/comments", getComments);

// Upvote
router.post("/:id/upvote", authorize("citizen"), toggleUpvote);

// Add comment (with optional image)
router.post("/:id/comments", upload.single("image"), uploadToCloudinary, addComment);

export default router;

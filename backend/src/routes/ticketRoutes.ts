import { Router } from "express";
import {
    getTickets,
    getTicketById,
    updateTicketStatus,
    uploadProof,
    getTicketStats,
} from "../controllers/ticketController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { cityIsolation } from "../middleware/cityIsolation.js";
import { upload, uploadToCloudinary } from "../middleware/upload.js";

const router = Router();

// All ticket routes require department authentication + city isolation
router.use(authenticate, authorize("department"), cityIsolation);

// Department ticket stats
router.get("/stats", getTicketStats);

// List department tickets
router.get("/", getTickets);

// Ticket detail
router.get("/:id", getTicketById);

// Update ticket status (with optional proof image)
router.patch("/:id/status", upload.single("proofImage"), uploadToCloudinary, updateTicketStatus);

// Upload proof image separately
router.post("/:id/proof", upload.single("proofImage"), uploadToCloudinary, uploadProof);

export default router;

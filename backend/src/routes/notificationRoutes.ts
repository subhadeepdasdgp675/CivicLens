import { Router } from "express";
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
} from "../controllers/notificationController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get user notifications
router.get("/", getNotifications);

// Mark all as read
router.patch("/read-all", markAllAsRead);

// Mark single as read
router.patch("/:id/read", markAsRead);

export default router;

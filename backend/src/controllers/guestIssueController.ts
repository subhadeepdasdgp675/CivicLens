import type { Request, Response } from "express";
import prisma from "../config/db.js";
import { reportIssueSchema } from "../utils/validators.js";
import { CATEGORY_DEPARTMENT_MAP } from "../config/env.js";
import { findDuplicateTicket } from "../services/duplicateDetection.js";
import { notifyDepartmentUsers } from "../services/notificationService.js";
import { emitIssueCreated } from "../services/socketEvents.js";
import { sendIssueConfirmationEmail } from "../services/emailService.js";
import { assessAndProcessIncident, recordTimelineEvent } from "../services/civicLensService.js";

type IssueCategory = "Garbage" | "Pothole" | "WaterOverflow" | "StreetLight" | "Drainage" | "Footpath" | "Other";

/**
 * POST /api/issues/guest
 * Report a new civic issue WITHOUT authentication.
 * Requires a valid email address in the body (guest_email).
 * The system assigns the issue to the first available city (or a default city).
 */
export async function reportGuestIssue(req: Request, res: Response): Promise<void> {
    try {
        const validation = reportIssueSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: validation.error.errors[0].message });
            return;
        }

        const { title, description, category, location, lat, lng } = validation.data;

        // guest_email is NOT part of the issue schema — read directly from req.body
        const guestEmail: string | undefined = req.body.guest_email;
        if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
            res.status(400).json({ error: "A valid guest email is required." });
            return;
        }

        const uploadedImages: string[] = (req as any).uploadedImages || (req.file ? [req.file.path] : []);
        const imagePath = uploadedImages.length > 0 ? uploadedImages.join(",") : "";
        if (!imagePath) {
            res.status(400).json({ error: "An image is required to report an issue." });
            return;
        }

        // Use location-based city lookup or fall back to the first city in DB
        const city = await prisma.city.findFirst({ orderBy: { createdAt: "asc" } });
        if (!city) {
            res.status(500).json({ error: "No city configured in the system. Contact an administrator." });
            return;
        }
        const cityId = city.id;

        const validPrismaCategories: IssueCategory[] = [
            "Garbage", "Pothole", "WaterOverflow", "StreetLight", "Drainage", "Footpath", "Other",
        ];
        const prismaCategory: IssueCategory = validPrismaCategories.includes(category as IssueCategory)
            ? (category as IssueCategory)
            : "Other";

        const departmentName = CATEGORY_DEPARTMENT_MAP[category] || "General Municipal Grievances";
        const [department, existingTicketId] = await Promise.all([
            prisma.department.findFirst({
                where: { cityId, categoryType: prismaCategory },
            }),
            findDuplicateTicket(lat, lng, prismaCategory, cityId),
        ]);

        const dept = department || await prisma.department.create({
            data: { name: departmentName, categoryType: prismaCategory, cityId },
        });


        // Every report gets its own distinct ticket so citizen complaints are never merged on citizen side.
        const ticket = await prisma.consolidatedTicket.create({
            data: { departmentId: dept.id, cityId },
        });
        const consolidatedTicketId = ticket.id;

        const issuePost = await prisma.issuePost.create({
            data: {
                title, description, category: category as IssueCategory,
                location, lat, lng, image: imagePath,
                guestEmail,
                cityId, consolidatedTicketId,
                // reportedById intentionally omitted — schema field is now optional
            },
            include: {
                city: { select: { id: true, name: true } },
            },
        });

        // Notify department in background
        notifyDepartmentUsers(dept.id, "New Issue Assigned", `A new ${category.toLowerCase()} issue has been reported at ${location}.`, issuePost.id).catch(() => { });

        // Real-time broadcast
        emitIssueCreated(cityId, issuePost as unknown as Record<string, unknown>);

        // Record initial timeline event
        recordTimelineEvent({
            issuePostId: issuePost.id,
            consolidatedTicketId,
            eventType: "REPORT_SUBMITTED",
            title: "Guest Report Submitted",
            description: `Citizen (Guest) submitted report "${title}" in category ${category}.`,
            source: "CITIZEN",
            metadata: { guestEmail },
        }).catch(() => { });

        // CivicLens AI Incident Intelligence: Assess in background without blocking response
        assessAndProcessIncident(
            issuePost.id,
            {
                id: issuePost.id,
                title,
                description,
                category: category as IssueCategory,
                location,
                lat,
                lng,
                cityId,
                imageUrl: imagePath || undefined,
                createdAt: issuePost.createdAt,
            },
            consolidatedTicketId
        ).catch((err) => {
            console.error("[CivicLens] Guest report assessment error:", err);
        });

        // Email confirmation to guest (fire-and-forget — never block the response)
        sendIssueConfirmationEmail({
            to: guestEmail,
            issueTitle: title,
            description,
            location,
            imageUrl: imagePath || undefined,
        }).catch(() => { });

        res.status(201).json({
            message: existingTicketId
                ? "Your report has been submitted. A similar issue was already reported nearby — they have been linked."
                : `Your report has been sent to the ${departmentName} department. Updates will be emailed to ${guestEmail}.`,
            issue: issuePost,
            isDuplicate: !!existingTicketId,
        });
    } catch (error) {
        console.error("Guest report issue error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

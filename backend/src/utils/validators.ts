import { z } from "zod";

// ── Auth Validators ──

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").max(128).optional().or(z.literal("")),
    city: z.string().min(1, "City is required"),
    otp: z.string().length(6, "OTP must be 6 digits"),
});

export const sendSignupOtpSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    city: z.string().min(1, "City is required"),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

// ── Issue Validators ──

export const reportIssueSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters").max(200),
    description: z.string().min(10, "Description must be at least 10 characters").max(2000),
    category: z.string().min(1, "Category is required"),
    customCategory: z.string().optional(),
    customDepartment: z.string().optional(),
    location: z.string().min(3, "Location is required"),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
});


// ── Comment Validator ──

export const commentSchema = z.object({
    content: z.string().min(1, "Comment cannot be empty").max(1000),
});

// ── Ticket Status Update ──

export const ticketStatusSchema = z.object({
    status: z.enum(["Pending", "Ongoing", "Resolved", "Escalated"]),
    resolutionComment: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type TicketStatusInput = z.infer<typeof ticketStatusSchema>;

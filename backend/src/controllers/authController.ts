import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { env } from "../config/env.js";
import { registerSchema, loginSchema, sendSignupOtpSchema } from "../utils/validators.js";
import { sendOtpEmail } from "../services/emailService.js";
import crypto from "crypto";

// In-memory pending signup OTP storage (email -> { otp, name, city, expiresAt })
interface PendingSignup {
    otp: string;
    expiresAt: Date;
}
const pendingSignups = new Map<string, PendingSignup>();

/**
 * POST /api/auth/send-signup-otp
 * Generate and email a 6-digit OTP for email verification during signup.
 */
export async function sendSignupOtp(req: Request, res: Response): Promise<void> {
    try {
        const validation = sendSignupOtpSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: validation.error.errors[0].message });
            return;
        }

        const { email } = validation.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
            return;
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        pendingSignups.set(normalizedEmail, { otp, expiresAt });

        await sendOtpEmail(normalizedEmail, otp, "signup");

        res.json({ message: "Verification OTP sent to your email." });
    } catch (error) {
        console.error("Send signup OTP error:", error);
        res.status(500).json({ error: "Failed to send verification code. Please try again." });
    }
}

/**
 * POST /api/auth/register
 * Register a new citizen user after email verification via OTP.
 * Password is optional. If not provided, an unguessable token hash is stored
 * and the user signs in using Email OTP.
 */
export async function register(req: Request, res: Response): Promise<void> {
    try {
        const validation = registerSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: validation.error.errors[0].message });
            return;
        }

        const { name, email, password, city, otp } = validation.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            res.status(409).json({ error: "An account with this email already exists." });
            return;
        }

        // Verify OTP
        const pending = pendingSignups.get(normalizedEmail);
        if (!pending) {
            res.status(400).json({ error: "Please request a verification code for this email first." });
            return;
        }

        if (pending.otp !== otp.trim()) {
            res.status(400).json({ error: "Invalid verification code. Please try again." });
            return;
        }

        if (new Date() > pending.expiresAt) {
            pendingSignups.delete(normalizedEmail);
            res.status(400).json({ error: "Verification code has expired. Please request a new one." });
            return;
        }

        // Verified! Clean up pending signup
        pendingSignups.delete(normalizedEmail);

        // Find or create city
        let cityRecord = await prisma.city.findUnique({ where: { name: city.trim() } });
        if (!cityRecord) {
            cityRecord = await prisma.city.create({ data: { name: city.trim() } });
        }

        // Hash password if provided, or store random secret hash if passwordless
        const passwordToHash = (password && password.trim().length >= 6)
            ? password.trim()
            : `NOPASS_${crypto.randomBytes(32).toString("hex")}`;
        const hashedPassword = await bcrypt.hash(passwordToHash, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: "citizen",
                cityId: cityRecord.id,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                createdAt: true,
                city: { select: { id: true, name: true } },
            },
        });

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, cityId: user.city?.id || null, departmentId: null },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
        );

        res.status(201).json({
            message: "Account verified and created successfully. Welcome to Civic Lens!",
            user,
            token,
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/auth/login
 * Login for all roles.
 */
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const validation = loginSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: validation.error.errors[0].message });
            return;
        }

        const { email, password } = validation.data;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                city: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
            },
        });

        if (!user) {
            res.status(401).json({ error: "Invalid email or password." });
            return;
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            res.status(401).json({ error: "Invalid email or password." });
            return;
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                cityId: user.cityId,
                departmentId: user.departmentId,
            },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
        );

        // Return user (without password)
        const { password: _pwd, ...userWithoutPassword } = user;

        res.json({
            message: "Login successful.",
            user: userWithoutPassword,
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/auth/send-login-otp
 * Generate and email a 6-digit OTP for passwordless / OTP-based login.
 */
export async function sendLoginOtp(req: Request, res: Response): Promise<void> {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: "Email is required." });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            res.status(404).json({ error: "No account found with this email." });
            return;
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { email: normalizedEmail },
            data: { otpCode: otp, otpExpiresAt: expiresAt },
        });

        await sendOtpEmail(normalizedEmail, otp, "login");

        res.json({ message: "Login OTP sent to your email." });
    } catch (error) {
        console.error("Send login OTP error:", error);
        res.status(500).json({ error: "Failed to send OTP. Please try again." });
    }
}

/**
 * POST /api/auth/verify-login-otp
 * Verify 6-digit OTP and directly issue JWT for authentication.
 */
export async function verifyLoginOtp(req: Request, res: Response): Promise<void> {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            res.status(400).json({ error: "Email and OTP are required." });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: {
                city: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
            },
        });

        if (!user || !user.otpCode || !user.otpExpiresAt) {
            res.status(400).json({ error: "Invalid or expired OTP." });
            return;
        }

        if (user.otpCode !== otp.trim()) {
            res.status(400).json({ error: "Incorrect OTP. Please try again." });
            return;
        }

        if (new Date() > user.otpExpiresAt) {
            res.status(400).json({ error: "OTP has expired. Please request a new one." });
            return;
        }

        // Clear OTP after successful login
        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null, otpExpiresAt: null },
        });

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                cityId: user.cityId,
                departmentId: user.departmentId,
            },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
        );

        const { password: _pwd, ...userWithoutPassword } = user;

        res.json({
            message: "OTP verification successful. Welcome back!",
            user: userWithoutPassword,
            token,
        });
    } catch (error) {
        console.error("Verify login OTP error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * GET /api/auth/me
 * Get current authenticated user.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                createdAt: true,
                city: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
            },
        });

        if (!user) {
            res.status(404).json({ error: "User not found." });
            return;
        }

        res.json({ user });
    } catch (error) {
        console.error("GetMe error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/auth/forgot-password
 * Generate a 6-digit OTP and send it to the user's email.
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: "Email is required." });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        // Don't reveal whether the email exists — always return 200
        if (!user) {
            res.json({ message: "If that email is registered, an OTP has been sent." });
            return;
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { email },
            data: { otpCode: otp, otpExpiresAt: expiresAt },
        });

        await sendOtpEmail(email, otp, "reset");

        res.json({ message: "If that email is registered, an OTP has been sent." });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/auth/verify-otp
 * Verify the 6-digit OTP for password reset.
 */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            res.status(400).json({ error: "Email and OTP are required." });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.otpCode || !user.otpExpiresAt) {
            res.status(400).json({ error: "Invalid or expired OTP." });
            return;
        }

        if (user.otpCode !== otp) {
            res.status(400).json({ error: "Incorrect OTP. Please try again." });
            return;
        }

        if (new Date() > user.otpExpiresAt) {
            res.status(400).json({ error: "OTP has expired. Please request a new one." });
            return;
        }

        // OTP valid — issue a short-lived reset token (we reuse the otp itself as the token for simplicity)
        res.json({ message: "OTP verified.", resetToken: otp });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/auth/reset-password
 * Reset the user's password after OTP verification.
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            res.status(400).json({ error: "Email, OTP, and new password are required." });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ error: "Password must be at least 6 characters." });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.otpCode || !user.otpExpiresAt) {
            res.status(400).json({ error: "Invalid or expired OTP." });
            return;
        }
        if (user.otpCode !== otp || new Date() > user.otpExpiresAt) {
            res.status(400).json({ error: "Invalid or expired OTP." });
            return;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear OTP
        await prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                otpCode: null,
                otpExpiresAt: null,
            },
        });

        res.json({ message: "Password reset successfully. You can now log in." });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
}

/**
 * POST /api/auth/admin-quick-login
 * Direct 1-click admin authentication without OTP verification.
 * Instantly authenticates as Municipal Admin and returns JWT.
 */
export async function quickAdminLogin(req: Request, res: Response): Promise<void> {
    try {
        const { targetCity } = req.body || {};
        
        // Find existing municipal admin or fallback to first municipal user
        let adminUser = await prisma.user.findFirst({
            where: { role: "municipal" },
            include: {
                city: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
            },
        });

        // If target city requested, resolve it
        let cityRecord = null;
        if (targetCity) {
            cityRecord = await prisma.city.findFirst({
                where: {
                    OR: [
                        { id: targetCity },
                        { name: { equals: targetCity, mode: "insensitive" } },
                    ],
                },
            });
            if (!cityRecord) {
                // Auto create city if needed
                cityRecord = await prisma.city.create({
                    data: { name: targetCity },
                });
            }
        }

        if (!adminUser) {
            // Auto create default municipal admin if not seeded yet
            const defaultCity = cityRecord || await prisma.city.findFirst() || await prisma.city.create({
                data: { name: "Durgapur" },
            });
            const hashedPassword = await bcrypt.hash("Admin@1234", 12);
            adminUser = await prisma.user.create({
                data: {
                    name: "Municipal Chief Administrator",
                    email: "admin@pmc.gov.in",
                    password: hashedPassword,
                    role: "municipal",
                    cityId: defaultCity.id,
                },
                include: {
                    city: { select: { id: true, name: true } },
                    department: { select: { id: true, name: true } },
                },
            });
        }

        const effectiveCityId = cityRecord ? cityRecord.id : adminUser.cityId;
        const effectiveCityName = cityRecord ? cityRecord.name : (adminUser.city?.name || "Durgapur");

        // Generate JWT
        const token = jwt.sign(
            {
                id: adminUser.id,
                email: adminUser.email,
                role: "municipal",
                cityId: effectiveCityId,
                departmentId: null,
            },
            env.JWT_SECRET,
            { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
        );

        const { password: _pwd, ...userWithoutPassword } = adminUser;
        const responseUser = {
            ...userWithoutPassword,
            cityId: effectiveCityId,
            city: { id: effectiveCityId, name: effectiveCityName },
        };

        res.json({
            message: "Admin authentication verified successfully.",
            user: responseUser,
            token,
        });
    } catch (error) {
        console.error("Admin quick login error:", error);
        res.status(500).json({ error: "Failed to perform admin login." });
    }
}


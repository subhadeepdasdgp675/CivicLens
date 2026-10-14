import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type UserRole = "citizen" | "department" | "municipal";

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: UserRole;
                cityId: string | null;
                departmentId: string | null;
            };
        }
    }
}

interface JWTPayload {
    id: string;
    email: string;
    role: UserRole;
    cityId: string | null;
    departmentId: string | null;
}

/**
 * Authenticate JWT token from Authorization header.
 * Uses the JWT payload directly — no DB call needed.
 * The JWT already contains id, email, role, cityId, departmentId.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Authentication required. Please provide a valid token." });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

        // Trust the JWT payload — no DB round-trip.
        // The token is signed with our secret and has expiry, so it's safe.
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            cityId: decoded.cityId,
            departmentId: decoded.departmentId,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: "Token has expired. Please log in again." });
            return;
        }
        res.status(401).json({ error: "Invalid authentication token." });
    }
}

/**
 * Authorize specific roles
 */
export function authorize(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: "Authentication required." });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: "You do not have permission to access this resource." });
            return;
        }

        next();
    };
}

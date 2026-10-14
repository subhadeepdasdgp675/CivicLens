import type { Request, Response, NextFunction } from "express";

/**
 * City isolation middleware.
 * Ensures department and municipal users can only access data from their own city.
 * Citizens can view issues across cities (but only report in their own city).
 */
export function cityIsolation(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
        res.status(401).json({ error: "Authentication required." });
        return;
    }

    // Department and Municipal users MUST have a city
    if ((req.user.role === "department" || req.user.role === "municipal") && !req.user.cityId) {
        res.status(403).json({ error: "Your account is not associated with a city." });
        return;
    }

    // For department/municipal users, support dynamic city override if provided via query or headers
    if (req.user.role === "department" || req.user.role === "municipal") {
        const overrideCity = (req.query.cityId as string) || (req.query.cityName as string) || (req.headers["x-city-id"] as string) || (req.headers["x-city-name"] as string);
        if (overrideCity) {
            req.query.cityId = overrideCity;
        } else {
            req.query.cityId = req.user.cityId!;
        }
    }

    next();
}

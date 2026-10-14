import type { Request, Response, NextFunction } from "express";

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a clean JSON response.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    console.error("[Error] Unhandled Error:", err.message);
    if (process.env.NODE_ENV === "development") {
        console.error(err.stack);
    }

    res.status(500).json({
        error: "Something went wrong. Please try again.",
        ...(process.env.NODE_ENV === "development" && { details: err.message }),
    });
}

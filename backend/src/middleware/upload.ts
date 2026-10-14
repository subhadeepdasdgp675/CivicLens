import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

// ── Configure Cloudinary from env vars ──
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
});

// Use memory storage — we stream the buffer to Cloudinary ourselves
const storage = multer.memoryStorage();

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed."));
    }
};

// Base multer instance (validates type + size, buffers file in memory)
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: env.MAX_FILE_SIZE,
    },
});

/**
 * Express middleware that uploads req.file buffer to Cloudinary.
 * Must be used AFTER upload.single() / upload.fields().
 * On success, sets req.file.path to the Cloudinary secure URL.
 */
export async function uploadToCloudinary(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    if (!req.file) return next();

    try {
        const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "civicconnect",
                    resource_type: "image",
                    // Auto-compress & convert to webp for smaller sizes
                    transformation: [{ quality: "auto", fetch_format: "auto" }],
                },
                (error, result) => {
                    if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
                    resolve(result);
                }
            );
            stream.end(req.file!.buffer);
        });

        // Store the full Cloudinary URL in path (replacing the old /uploads/... pattern)
        req.file.path = result.secure_url;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Express middleware that uploads multiple files (req.files or req.file) to Cloudinary.
 * Collects all secure_urls and assigns them to (req as any).uploadedImages: string[].
 * Also sets req.file.path to the first uploaded image for backwards compatibility.
 */
export async function uploadMultipleToCloudinary(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    const rawFiles: Express.Multer.File[] = [];

    if (req.file) {
        rawFiles.push(req.file);
    }
    if (req.files) {
        if (Array.isArray(req.files)) {
            rawFiles.push(...req.files);
        } else {
            Object.values(req.files).forEach((files) => {
                rawFiles.push(...files);
            });
        }
    }

    if (rawFiles.length === 0) {
        return next();
    }

    try {
        const uploadPromises = rawFiles.map(
            (file) =>
                new Promise<string>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: "civicconnect",
                            resource_type: "image",
                            transformation: [{ quality: "auto", fetch_format: "auto" }],
                        },
                        (error, result) => {
                            if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
                            file.path = result.secure_url;
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(file.buffer);
                })
        );

        const urls = await Promise.all(uploadPromises);
        (req as any).uploadedImages = urls;
        if (!req.file && rawFiles.length > 0) {
            req.file = rawFiles[0];
            req.file.path = urls[0];
        }
        next();
    } catch (err) {
        next(err);
    }
}


import dotenv from "dotenv";
dotenv.config();

export const env = {
    PORT: parseInt(process.env.PORT || "5000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || "fallback_secret",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
    FRONTEND_URL: process.env.FRONTEND_URL ? (process.env.FRONTEND_URL.includes(",") ? process.env.FRONTEND_URL.split(",").map(u => u.trim()) : process.env.FRONTEND_URL) : ["http://localhost:8080", "http://localhost:5173"],
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || "15728640", 10), // 15MB default for camera captures
    // Cloudinary
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    // SMTP Configuration
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
    SMTP_SECURE: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    SMTP_USER: process.env.SMTP_USER || process.env.GMAIL_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "",
    SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || "noreply@civiclens.local",
    // Legacy Gmail fallback
    GMAIL_USER: process.env.GMAIL_USER || "",
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || "",
    // CivicLens AI / Gemma 4
    GEMMA_API_KEY: process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY || "",
    GEMMA_MODEL: process.env.GEMMA_MODEL || "gemma-4-31b-it",
    CIVICLENS_CONFIDENCE_THRESHOLD: parseFloat(process.env.CIVICLENS_CONFIDENCE_THRESHOLD || "0.80"),
    CIVICLENS_RADIUS_METERS: parseInt(process.env.CIVICLENS_RADIUS_METERS || "50", 10),
    CIVICLENS_MAX_CANDIDATES: parseInt(process.env.CIVICLENS_MAX_CANDIDATES || "5", 10),
    CIVICLENS_AUTO_MERGE: process.env.CIVICLENS_AUTO_MERGE === "true", // Conservative default: false
};

// Category → Department mapping
export const CATEGORY_DEPARTMENT_MAP: Record<string, string> = {
    Garbage: "Sanitation & Waste Management",
    Pothole: "Roads, Bridges & Infrastructure",
    WaterOverflow: "Water Supply & Distribution",
    StreetLight: "Street Lighting & Electrical",
    Drainage: "Stormwater Drainage & Flood Control",
    Footpath: "Roads, Bridges & Infrastructure",
    Sewage: "Sewerage & Wastewater Management",
    TrafficSignal: "Traffic & Transportation Management",
    Encroachment: "Town Planning & Anti-Encroachment",
    StrayAnimals: "Veterinary Services & Animal Control",
    PublicToilet: "Sanitation & Public Health",
    TreePruning: "Horticulture, Parks & Greenery",
    HealthHazard: "Public Health & Disease Prevention",
    IllegalDumping: "Sanitation & Waste Management",
    FireHazard: "Fire & Emergency Services",
    BuildingViolation: "Town Planning & Building Inspection",
    NoisePollution: "Environment & Pollution Control",
    Other: "General Municipal Grievances",
};


// Duplicate detection radius in meters
export const DUPLICATE_RADIUS_METERS = 20;

// Escalation days
export const ESCALATION_DAYS = 7;

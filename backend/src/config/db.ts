import { PrismaClient } from "@prisma/client";

// Singleton pattern — prevents multiple Prisma clients during hot-reload in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
        // Connection pool configuration for better performance
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });

// Test connection on startup
prisma.$connect()
    .then(() => console.log("[DB] Database connected successfully"))
    .catch((err) => console.error("[DB] Database connection failed:", err));

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;

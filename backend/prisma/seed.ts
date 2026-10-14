/**
 * Seed script — creates all department demo accounts for Pune city.
 * Run with:  npx tsx prisma/seed.ts
 *
 * Safe to run multiple times (upserts).
 *
 * Schema: Department has (cityId, categoryType) as unique key.
 * Each IssueCategory → 1 Department → 1 demo login.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

// Database connection initialization
const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!datasourceUrl) {
    console.error("❌ No DATABASE_URL or DIRECT_URL found in .env");
    process.exit(1);
}

console.log(`🔌 Connecting to database…`);
const prisma = new PrismaClient({ datasourceUrl });

// Helper to keep the script robust against connection issues
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 3000): Promise<T> {
    for (let i = 1; i <= retries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            if (i === retries) throw e;
            console.log(`  ⟳ Connection attempt ${i} failed — retrying in ${delayMs / 1000}s…`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw new Error("unreachable");
}


// IssueCategory enum values from schema
type IssueCategory = "Garbage" | "Pothole" | "WaterOverflow" | "StreetLight" | "Drainage" | "Footpath" | "Other";

// Maps each category to a human-readable department name and demo user
const DEPT_CONFIG: {
    categoryType: IssueCategory;
    name: string;
    email: string;
    userName: string;
}[] = [
        { categoryType: "Garbage", name: "Sanitation", email: "sanitation@pune.gov.in", userName: "Sanitation Officer" },
        { categoryType: "Pothole", name: "Roads & Infrastructure", email: "roads@pune.gov.in", userName: "Roads Officer" },
        { categoryType: "WaterOverflow", name: "Water Supply", email: "water@pune.gov.in", userName: "Water Supply Officer" },
        { categoryType: "StreetLight", name: "Electrical", email: "electrical@pune.gov.in", userName: "Electrical Officer" },
        { categoryType: "Drainage", name: "Drainage", email: "drainage@pune.gov.in", userName: "Drainage Officer" },
        { categoryType: "Footpath", name: "Roads & Infrastructure", email: "footpath@pune.gov.in", userName: "Footpath Officer" },
    ];

async function main() {
    console.log("🌱 Seeding Civic Lens demo accounts…\n");

    // 1. Ensure Pune city exists — wrapped in retry for Neon cold-start
    const pune = await withRetry(() => prisma.city.upsert({
        where: { name: "Pune" },
        update: {},
        create: { name: "Pune" },
    }));
    console.log(`✅ City: Pune (${pune.id})`);

    // 2. Hash password once
    const hashedPwd = await bcrypt.hash("password123", 12);

    // 3. Ensure citizen demo account exists (both civiclens.in and legacy civicconnect.in)
    await prisma.user.upsert({
        where: { email: "citizen@civiclens.in" },
        update: { name: "Demo Citizen", role: "citizen", cityId: pune.id },
        create: { name: "Demo Citizen", email: "citizen@civiclens.in", password: hashedPwd, role: "citizen", cityId: pune.id },
    });
    console.log(`  ✅ citizen@civiclens.in  → citizen`);

    await prisma.user.upsert({
        where: { email: "citizen@civicconnect.in" },
        update: { name: "Demo Citizen", role: "citizen", cityId: pune.id },
        create: { name: "Demo Citizen", email: "citizen@civicconnect.in", password: hashedPwd, role: "citizen", cityId: pune.id },
    });

    // 4. Ensure municipal admin account exists
    await prisma.user.upsert({
        where: { email: "admin@pmc.gov.in" },
        update: { name: "Municipal Admin", role: "municipal", cityId: pune.id },
        create: { name: "Municipal Admin", email: "admin@pmc.gov.in", password: hashedPwd, role: "municipal", cityId: pune.id },
    });
    console.log(`  ✅ admin@pmc.gov.in  → municipal`);

    // 5. Create each department + its demo user
    console.log("\n📋 Creating departments and department users…");
    for (const d of DEPT_CONFIG) {
        // Upsert department by (cityId, categoryType) — the schema's unique constraint
        const dept = await prisma.department.upsert({
            where: { cityId_categoryType: { cityId: pune.id, categoryType: d.categoryType } },
            update: { name: d.name },
            create: { name: d.name, categoryType: d.categoryType, cityId: pune.id },
        });
        console.log(`  ✅ Department: ${d.name} [${d.categoryType}] (${dept.id})`);

        // Upsert demo user for this department
        await prisma.user.upsert({
            where: { email: d.email },
            update: {
                name: d.userName,
                role: "department",
                cityId: pune.id,
                departmentId: dept.id,
            },
            create: {
                name: d.userName,
                email: d.email,
                password: hashedPwd,
                role: "department",
                cityId: pune.id,
                departmentId: dept.id,
            },
        });
        console.log(`     👤 ${d.email}  → ${d.name}`);
    }

    console.log("\n🎉 Seeding complete!");
    console.log("\nDemo login credentials (all use password: password123)");
    console.log("──────────────────────────────────────────────────────");
    console.log("  Citizen:                   citizen@civiclens.in");
    console.log("  Sanitation Dept:           sanitation@pune.gov.in");
    console.log("  Roads & Infra Dept:        roads@pune.gov.in");
    console.log("  Water Supply Dept:         water@pune.gov.in");
    console.log("  Electrical Dept:           electrical@pune.gov.in");
    console.log("  Drainage Dept:             drainage@pune.gov.in");
    console.log("  Roads & Infra (Footpath):  footpath@pune.gov.in");
    console.log("  Municipal Admin:           admin@pmc.gov.in");
    console.log("──────────────────────────────────────────────────────");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

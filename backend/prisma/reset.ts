import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function reset() {
    console.log("[Reset] Clearing all data...\n");

    // Delete in FK-safe order (children before parents)
    await prisma.notification.deleteMany({});
    console.log("[Reset] Notifications cleared");

    await prisma.upvote.deleteMany({});
    console.log("[Reset] Upvotes cleared");

    await prisma.comment.deleteMany({});
    console.log("[Reset] Comments cleared");

    // Unlink issue posts from tickets before deleting tickets
    await prisma.issuePost.updateMany({ data: { consolidatedTicketId: null } });
    await prisma.issuePost.deleteMany({});
    console.log("[Reset] Issue posts cleared");

    await prisma.consolidatedTicket.deleteMany({});
    console.log("[Reset] Consolidated tickets cleared");

    await prisma.user.deleteMany({});
    console.log("[Reset] Users cleared");

    await prisma.department.deleteMany({});
    console.log("[Reset] Departments cleared");

    await prisma.city.deleteMany({});
    console.log("[Reset] Cities cleared");

    console.log("\n[Reset] All data cleared. Re-seeding mock data...\n");
}

reset()
    .then(async () => {
        await prisma.$disconnect();
        // Re-run the seed script
        execSync("npx tsx prisma/seed.ts", { stdio: "inherit", cwd: process.cwd() });
    })
    .catch(async (e) => {
        console.error("[Reset] Error:", e);
        await prisma.$disconnect();
        process.exit(1);
    });

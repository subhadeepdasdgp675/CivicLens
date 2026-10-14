import prisma from "./config/db.js";
import { synthesizeDomainClusterWithGemma } from "./services/gemmaService.js";

async function verify() {
    console.log("Checking Durgapur issues in database...");
    const issues = await prisma.issuePost.findMany({
        where: {
            city: { name: { contains: "Durgapur", mode: "insensitive" } }
        },
        select: {
            id: true,
            title: true,
            description: true,
            category: true,
            location: true,
            lat: true,
            lng: true,
            image: true,
            createdAt: true,
        }
    });

    console.log(`Found ${issues.length} issues in Durgapur:`);
    for (const iss of issues) {
        console.log(`- [${iss.category}] ${iss.title}: "${iss.description}" at ${iss.location}`);
    }

    const reportItems = issues.map(i => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        location: i.location,
        lat: i.lat,
        lng: i.lng,
        imageUrl: i.image,
        createdAt: i.createdAt,
    }));

    console.log("\nSynthesizing with Gemma 4 model for domain: 'Road Waterlogging & Drainage Inundation' in 'Durgapur'...");
    const result = await synthesizeDomainClusterWithGemma(
        "Road Waterlogging & Drainage Inundation",
        "Durgapur",
        reportItems
    );

    console.log("\n=== GEMMA 4 SYNTHESIS RESULT ===");
    console.log(JSON.stringify(result, null, 2));
}

verify().finally(() => prisma.$disconnect());

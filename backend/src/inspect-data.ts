import prisma from "./config/db.js";

async function main() {
    const cities = await prisma.city.findMany({
        select: {
            id: true,
            name: true,
            _count: {
                select: {
                    issuePosts: true,
                    consolidatedTickets: true,
                }
            }
        }
    });
    console.log("CITIES IN DB:");
    console.log(JSON.stringify(cities, null, 2));

    const durgapurIssues = await prisma.issuePost.findMany({
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
            status: true,
        }
    });
    console.log("DURGAPUR ISSUES COUNT:", durgapurIssues.length);
    console.log(JSON.stringify(durgapurIssues, null, 2));
}

main().finally(() => prisma.$disconnect());

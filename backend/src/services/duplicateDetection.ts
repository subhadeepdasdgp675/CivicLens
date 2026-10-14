import prisma from "../config/db.js";
import { haversineDistance } from "../utils/geo.js";
import { DUPLICATE_RADIUS_METERS } from "../config/env.js";

type IssueCategory = "Garbage" | "Pothole" | "WaterOverflow" | "StreetLight" | "Drainage" | "Footpath" | "Other";

/**
 * Duplicate Detection Service.
 * Checks if there's an existing consolidated ticket within 20m radius
 * with the same category in the same city.
 *
 * Returns the existing ticket ID if a duplicate is found, null otherwise.
 */
export async function findDuplicateTicket(
    lat: number,
    lng: number,
    category: IssueCategory,
    cityId: string
): Promise<string | null> {
    // Find all active issue posts in the same city and category
    const existingPosts = await prisma.issuePost.findMany({
        where: {
            cityId,
            category,
            status: { in: ["Pending", "Ongoing"] },
            consolidatedTicketId: { not: null },
        },
        select: {
            lat: true,
            lng: true,
            consolidatedTicketId: true,
        },
    });

    // Check each post for proximity
    for (const post of existingPosts) {
        const distance = haversineDistance(lat, lng, post.lat, post.lng);
        if (distance <= DUPLICATE_RADIUS_METERS && post.consolidatedTicketId) {
            return post.consolidatedTicketId;
        }
    }

    return null;
}

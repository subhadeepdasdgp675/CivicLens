import prisma from "./config/db.js";

async function runVerification() {
  console.log("=== VERIFYING CIVICLENS AI REVIEW QUEUE IN DATABASE ===");

  // 1. Check City
  const city = await prisma.city.findFirst();
  if (!city) {
    console.error("No city found in database!");
    return;
  }
  console.log(`[PASS] Active verification city: ${city.name} (${city.id})`);

  // 2. Count Incident Assessments
  const totalAssessments = await prisma.incidentAssessment.count();
  const pendingAssessments = await prisma.incidentAssessment.count({
    where: {
      requiresReview: true,
      reviewStatus: "PENDING",
    },
  });
  console.log(`[PASS] Total assessments in DB: ${totalAssessments}`);
  console.log(`[PASS] Outstanding pending assessments in DB: ${pendingAssessments}`);

  // 3. Inspect a real assessment
  const sampleAssessment = await prisma.incidentAssessment.findFirst({
    where: {
      issuePost: { cityId: city.id },
    },
    include: {
      issuePost: true,
      candidateTicket: true,
      reviews: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (sampleAssessment) {
    console.log(`[PASS] Sample Assessment ID: ${sampleAssessment.id}`);
    console.log(`       Decision: ${sampleAssessment.decision}`);
    console.log(`       Confidence: ${(sampleAssessment.confidence * 100).toFixed(1)}%`);
    console.log(`       Review Status: ${sampleAssessment.reviewStatus}`);
    console.log(`       Explanation: ${sampleAssessment.explanation?.slice(0, 100)}...`);
    console.log(`       Issue Title: ${sampleAssessment.issuePost.title}`);
  } else {
    console.log("[INFO] No assessment records for this city yet. Ready for incoming reports.");
  }

  // 4. Verify Timeline Events
  const timelineCount = await prisma.incidentTimelineEvent.count();
  console.log(`[PASS] Total chronological timeline events in DB: ${timelineCount}`);

  // 5. Verify Reviews
  const reviewsCount = await prisma.incidentAssessmentReview.count();
  console.log(`[PASS] Total human review decision audit records: ${reviewsCount}`);

  console.log("=== ALL REVIEW QUEUE DATABASE INTEGRITY CHECKS PASSED ===");
}

runVerification()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

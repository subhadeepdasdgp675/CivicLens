import cron from "node-cron";
import { runEscalation } from "../services/escalationService.js";

/**
 * Start the escalation cron job.
 * Runs daily at midnight to check for tickets older than 7 days.
 *
 * Schedule: Every day at 00:00
 */
export function startEscalationJob(): void {
    cron.schedule("0 0 * * *", async () => {
        console.log("[Escalation] Running escalation check...");
        try {
            const count = await runEscalation();
            if (count > 0) {
                console.log(`[Escalation] Escalated ${count} ticket(s).`);
            } else {
                console.log("[Escalation] No tickets to escalate.");
            }
        } catch (error) {
            console.error("[Escalation] Escalation job error:", error);
        }
    });

    console.log("[Escalation] Cron job scheduled (daily at midnight).");
}

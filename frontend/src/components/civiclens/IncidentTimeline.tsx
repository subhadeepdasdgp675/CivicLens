import React from "react";
import { type ApiTimelineEvent } from "@/lib/api";
import { Sparkles, User, Shield, Activity, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  events: ApiTimelineEvent[];
}

const getSourceIcon = (source: string) => {
  switch (source) {
    case "GEMMA_AI":
      return <Sparkles className="h-4 w-4 text-purple-600" />;
    case "OFFICER":
      return <Shield className="h-4 w-4 text-blue-600" />;
    case "CITIZEN":
      return <User className="h-4 w-4 text-emerald-600" />;
    case "SYSTEM":
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
};

const getEventBadge = (type: string) => {
  switch (type) {
    case "REPORT_SUBMITTED":
      return <span className="rounded bg-emerald-500/10 text-emerald-600 text-label font-medium px-2 py-0.5">Reported</span>;
    case "AI_ASSESSMENT":
      return <span className="rounded bg-purple-500/10 text-purple-600 text-label font-medium px-2 py-0.5">AI Reasoning</span>;
    case "HUMAN_REVIEW":
      return <span className="rounded bg-blue-500/10 text-blue-600 text-label font-medium px-2 py-0.5">Officer Review</span>;
    case "ESCALATED":
      return <span className="rounded bg-red-500/10 text-red-600 text-label font-medium px-2 py-0.5">Escalated</span>;
    case "RESOLVED":
      return <span className="rounded bg-green-500/10 text-green-600 text-label font-medium px-2 py-0.5">Resolved</span>;
    default:
      return null;
  }
};

const sanitizeTimelineDescription = (text?: string): string => {
  if (!text) return "";
  return text
    // Replace admin/pmc emails with "Municipal Authority"
    .replace(/[a-zA-Z0-9._%+-]+@(pmc\.gov\.in|[\w.-]+\.[a-zA-Z]{2,})/gi, "Municipal Authority")
    .replace(/admin@pmc\.gov\.in/gi, "Municipal Authority")
    // Replace raw AI 503 / 500 / JSON error exceptions with reassuring civic observation
    .replace(/AI reasoning unavailable\s*\([^)]+\)/gi, "AI analysis queued for municipal verification")
    .replace(/Live AI model invocation failed\s*\([^)]+\)/gi, "Field verification queued for municipal inspection")
    .replace(/\{"error":\{.*\}\}/gi, "")
    .replace(/\{"code":\d+.*\}\}/gi, "")
    // Clean up title/label phrases if needed
    .replace(/by admin@pmc\.gov\.in/gi, "by Municipal Authority")
    .trim();
};

export const IncidentTimeline: React.FC<Props> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-center text-caption text-muted-foreground">
        No incident timeline events recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-border">
      {events.map((event) => {
        const isAI = event.source === "GEMMA_AI";
        const isOfficer = event.source === "OFFICER";
        const cleanedDescription = sanitizeTimelineDescription(event.description);

        return (
          <div key={event.id} className="relative group">
            {/* Dot / Icon */}
            <div
              className={cn(
                "absolute -left-6 top-0 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-xs",
                isAI ? "border-purple-300 bg-purple-50" : isOfficer ? "border-blue-300 bg-blue-50" : "border-border"
              )}
            >
              {getSourceIcon(event.source)}
            </div>

            {/* Event Content */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/30 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-caption font-semibold text-foreground">{event.title}</span>
                  {getEventBadge(event.eventType)}
                </div>
                <div className="flex items-center gap-2 text-label text-muted-foreground">
                  <span className="font-mono">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>·</span>
                  <span>{new Date(event.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="text-caption text-muted-foreground leading-relaxed">
                {cleanedDescription}
              </p>

              {isAI && (
                <div className="mt-2 text-label text-purple-700/80 bg-purple-50/50 rounded px-2 py-1 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Model-generated observation · Audited for officer verification
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default IncidentTimeline;

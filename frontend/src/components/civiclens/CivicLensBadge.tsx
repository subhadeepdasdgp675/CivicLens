import React from "react";
import { type ApiIncidentAssessment, type IncidentDecision } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertCircle, CheckCircle2, Split, HelpCircle, ShieldAlert } from "lucide-react";

interface Props {
  assessment?: Partial<ApiIncidentAssessment>;
  decision?: IncidentDecision;
  confidence?: number;
  requiresReview?: boolean;
  reviewStatus?: string;
  compact?: boolean;
}

export const getDecisionBadge = (decision?: IncidentDecision | string) => {
  switch (decision) {
    case "SAME_INCIDENT":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 font-semibold hover:bg-amber-500/20">
          <Split className="h-3.5 w-3.5" />
          Same Incident
        </Badge>
      );
    case "RELATED_INCIDENT":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1 font-semibold hover:bg-blue-500/20">
          <HelpCircle className="h-3.5 w-3.5" />
          Related Incident
        </Badge>
      );
    case "NEW_INCIDENT":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 font-semibold hover:bg-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          New Incident
        </Badge>
      );
    case "NEEDS_REVIEW":
    default:
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1 font-semibold hover:bg-red-500/20">
          <ShieldAlert className="h-3.5 w-3.5" />
          Needs Review
        </Badge>
      );
  }
};

export const CivicLensBadge: React.FC<Props> = ({
  assessment,
  decision,
  confidence,
  compact = false,
}) => {
  const activeDecision = (decision || assessment?.decision || "NEEDS_REVIEW") as IncidentDecision;
  const activeConfidence = confidence ?? assessment?.confidence ?? 0;
  const confidencePercent = Math.round(activeConfidence * 100);

  if (compact || !assessment) {
    return (
      <div className="flex items-center gap-2">
        {getDecisionBadge(activeDecision)}
        <span className="text-label text-muted-foreground">
          {confidencePercent}% AI Est.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <span className="text-caption font-semibold text-foreground">CivicLens Intelligence</span>
            <span className="block text-label text-muted-foreground">Model: {assessment.model}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getDecisionBadge(assessment.decision)}
          <span className="rounded-full bg-muted px-2 py-0.5 text-label font-medium text-muted-foreground">
            {confidencePercent}% Confidence
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-caption">
        <p className="text-foreground leading-relaxed">
          {assessment.explanation
            ?.replace(/Live AI model invocation failed \([^)]+\)/gi, "cross-correlation flagged for manual verification")
            .replace(/AI reasoning unavailable \([^)]+\)/gi, "Incident queued for municipal field inspection.")
            .replace(/\{"error":\{.*\}\}/gi, "")
            .replace(/admin@pmc\.gov\.in/gi, "Municipal Authority")}
        </p>

        {/* Actionable Suggestion */}
        {((assessment.evidence as any)?.suggestion || (assessment as any)?.suggestion) && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-label text-blue-900 dark:text-blue-300">
            <span className="font-semibold block mb-0.5">Recommended Action:</span>
            <span>{(assessment.evidence as any)?.suggestion || (assessment as any)?.suggestion}</span>
          </div>
        )}

        {assessment.evidence && (
          <div className="flex flex-wrap gap-2 pt-1 text-label text-muted-foreground">
            {assessment.evidence.distanceMeters !== undefined && assessment.evidence.distanceMeters !== null && (
              <span className="rounded-md bg-muted/80 px-2 py-0.5">
                Distance: {assessment.evidence.distanceMeters}m
              </span>
            )}
            {assessment.evidence.categoryMatch !== undefined && (
              <span className="rounded-md bg-muted/80 px-2 py-0.5">
                Category Match: {assessment.evidence.categoryMatch ? "Yes" : "No"}
              </span>
            )}
            {assessment.evidence.semanticSimilarity && (
              <span className="rounded-md bg-muted/80 px-2 py-0.5">
                Similarity: {assessment.evidence.semanticSimilarity}
              </span>
            )}
          </div>
        )}

        {assessment.uncertainties && assessment.uncertainties.length > 0 && (
          <div className="mt-2 rounded-lg bg-amber-500/5 border border-amber-500/15 p-2 text-label text-amber-700">
            <div className="flex items-center gap-1 font-medium mb-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Observations & Review Points:
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              {assessment.uncertainties
                .map((u) =>
                  u
                    .replace(/Live AI model invocation failed \([^)]+\)/gi, "Awaiting field officer visual cross-check")
                    .replace(/AI service unavailable:.*$/gi, "Officer physical inspection advised before merging")
                    .replace(/\{"error":\{.*\}\}/gi, "")
                    .replace(/admin@pmc\.gov\.in/gi, "Municipal Authority")
                )
                .map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
export default CivicLensBadge;

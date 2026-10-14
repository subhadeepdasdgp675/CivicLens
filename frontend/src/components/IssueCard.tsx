import { MapPin, ThumbsUp, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import type { IssueStatus } from "@/components/StatusBadge";
import type { Issue as MockIssue } from "@/types";
import { getFirstImageUrl } from "@/lib/utils";

// Support both the old inline type and the new types/index type
interface IssueCardProps {
  issue: {
    id: string;
    title: string;
    location: string;
    department: string;
    status: IssueStatus;
    image: string;
    upvotes: number;
    comments: { length: number } | number;
    reporters: number;
  };
  linkTo?: string;
}

const IssueCard = ({ issue, linkTo }: IssueCardProps) => {
  const commentCount =
    typeof issue.comments === "number"
      ? issue.comments
      : Array.isArray(issue.comments)
      ? issue.comments.length
      : 0;

  const card = (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm civic-card-hover">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={getFirstImageUrl(issue.image)}
          alt={issue.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        {issue.status === "Escalated" && (
          <div className="absolute top-3 right-3">
            <StatusBadge status="Escalated" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-body font-semibold leading-snug text-foreground">
            {issue.title}
          </h3>
          <StatusBadge status={issue.status} />
        </div>

        <div className="mb-3 flex items-center gap-1.5 text-caption text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{issue.location}</span>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-secondary px-2 py-0.5 text-label text-secondary-foreground">
            {issue.department}
          </span>
          {issue.reporters > 1 && (
            <span className="flex items-center gap-1 text-label text-muted-foreground">
              <Users className="h-3 w-3" />
              Reported by {issue.reporters} users
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-caption text-muted-foreground transition-colors hover:text-primary">
              <ThumbsUp className="h-4 w-4" />
              <span>{issue.upvotes}</span>
            </button>
            <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>{commentCount}</span>
            </span>
          </div>
          <Button variant="outline" size="sm" className="text-caption">
            View Details
          </Button>
        </div>
      </div>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{card}</Link>;
  }

  return card;
};

export default IssueCard;

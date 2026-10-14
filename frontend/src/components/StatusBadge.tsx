import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type IssueStatus = "Pending" | "Ongoing" | "Resolved" | "Escalated";

const statusConfig: Record<IssueStatus, { className: string }> = {
  Pending: { className: "bg-amber-100 text-amber-800 border-amber-200" },
  Ongoing: { className: "bg-orange-100 text-orange-800 border-orange-200" },
  Resolved: { className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Escalated: { className: "bg-red-100 text-red-800 border-red-200" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status as IssueStatus] || { className: "bg-gray-100 text-gray-800 border-gray-200" };
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full text-label font-medium border px-3 py-0.5",
        config.className,
        className
      )}
    >
      {status}
    </Badge>
  );
};

export default StatusBadge;

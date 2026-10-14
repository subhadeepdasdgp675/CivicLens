import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;
}

const StatCard = ({ label, value, icon: Icon, className }: StatCardProps) => (
  <div
    className={cn(
      "flex items-center gap-4 rounded-xl border bg-card p-6 shadow-sm civic-card-hover",
      className
    )}
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent">
      <Icon className="h-6 w-6 text-accent-foreground" />
    </div>
    <div>
      <p className="text-h2 text-foreground">{value}</p>
      <p className="text-caption text-muted-foreground">{label}</p>
    </div>
  </div>
);

export default StatCard;

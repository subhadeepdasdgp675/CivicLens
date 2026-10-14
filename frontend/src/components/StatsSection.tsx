import {
  FileText,
  CheckCircle,
  Clock,
  Building2,
} from "lucide-react";
import StatCard from "@/components/StatCard";

const stats = [
  { label: "Total Issues", value: "4,521", icon: FileText },
  { label: "Resolved", value: "2,340", icon: CheckCircle },
  { label: "Pending", value: "1,843", icon: Clock },
  { label: "Departments Active", value: "12", icon: Building2 },
];

const StatsSection = () => (
  <section id="stats" className="civic-section bg-background">
    <div className="civic-container">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
    </div>
  </section>
);

export default StatsSection;

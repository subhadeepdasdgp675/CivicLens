import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-civic.jpg";
import { useAuth } from "@/contexts/AuthContext";
import QuickReportOverlay from "@/components/QuickReportOverlay";

const HeroSection = () => {
  const [showQuickReport, setShowQuickReport] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleQuickReport = () => {
    if (isAuthenticated) {
      navigate("/dashboard/report");
    } else {
      setShowQuickReport(true);
    }
  };

  return (
  <>
    {showQuickReport && (
      <QuickReportOverlay onClose={() => setShowQuickReport(false)} />
    )}
    <section className="relative overflow-hidden bg-card">
      <div className="civic-container civic-section">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left */}
          <div className="civic-fade-in">
            <span className="mb-4 inline-block rounded-full bg-accent px-4 py-1.5 text-label font-medium text-accent-foreground">
              Empowering Citizens
            </span>
            <h1 className="mb-6 text-display text-foreground">
              Report Civic Issues.{" "}
              <span className="text-primary">Improve Your City.</span>
            </h1>
            <p className="mb-8 max-w-lg text-body-lg text-muted-foreground">
              Upload photos, get automatic department assignment based on your location,
              track resolution progress, and escalate unresolved issues — all in one platform.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login">
                <Button size="lg">Report an Issue</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">Explore Issues</Button>
              </Link>
            </div>
          </div>

        {/* Right */}
        <div className="relative civic-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="overflow-hidden rounded-xl shadow-lg">
            <img
              src={heroImage}
              alt="Clean city street with greenery and community park"
              className="h-full w-full object-cover"
            />
          </div>
          {/* Floating stat card */}
          <div className="absolute -bottom-4 -left-4 rounded-xl border bg-card p-4 shadow-md md:-bottom-6 md:-left-6">
            <p className="text-h3 text-primary">2,340+</p>
            <p className="text-caption text-muted-foreground">Issues Resolved</p>
          </div>
        </div>
        </div>
      </div>
    </section>
  </>
  );
};

export default HeroSection;

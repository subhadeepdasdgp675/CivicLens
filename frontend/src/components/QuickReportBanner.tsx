import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import QuickReportOverlay from "@/components/QuickReportOverlay";

/**
 * A prominent banner that sits just above "How It Works".
 * It mirrors the Navbar's Quick Report style but gives the action
 * much more visual weight on the landing page.
 */
const QuickReportBanner = () => {
  const [showOverlay, setShowOverlay] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleClick = () => {
    if (isAuthenticated) {
      navigate("/dashboard/report");
    } else {
      setShowOverlay(true);
    }
  };

  return (
    <>
      {showOverlay && <QuickReportOverlay onClose={() => setShowOverlay(false)} />}

      <section className="border-y bg-accent/40 py-8">
        <div className="civic-container flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          {/* Left copy */}
          <div>
            <p className="text-label font-medium uppercase tracking-wide text-muted-foreground mb-1">
              No account needed
            </p>
            <p className="text-body font-semibold text-foreground">
              Spot something broken in your neighbourhood?
            </p>
            <p className="text-caption text-muted-foreground mt-0.5">
              Report it instantly — we'll email you updates as it gets resolved.
            </p>
          </div>

          {/* Right CTA */}
          <Button
            onClick={handleClick}
            variant="outline"
            size="lg"
            className="shrink-0 gap-2 font-semibold"
            style={{ borderColor: "#1E7F5C", color: "#1E7F5C" }}
          >
            <Zap className="h-4 w-4" />
            Quick Report
          </Button>
        </div>
      </section>
    </>
  );
};

export default QuickReportBanner;

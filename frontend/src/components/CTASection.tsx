import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import QuickReportOverlay from "@/components/QuickReportOverlay";

const CTASection = () => {
  const [showOverlay, setShowOverlay] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleQuickReport = () => {
    if (isAuthenticated) navigate("/dashboard/report");
    else setShowOverlay(true);
  };

  return (
    <>
      {showOverlay && <QuickReportOverlay onClose={() => setShowOverlay(false)} />}
      <section className="civic-section bg-primary">
        <div className="civic-container text-center">
          <h2 className="mb-4 text-h2 text-primary-foreground">
            Together, We Build Better Cities.
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-body-lg text-primary-foreground/80">
            Every report counts. Join thousands of citizens making their neighborhoods
            cleaner, safer, and better maintained.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="font-semibold">
                Report an Issue Now
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="font-semibold bg-transparent border-white/60 text-white hover:bg-white/10 hover:text-white"
              onClick={handleQuickReport}
            >
              Quick Report — No Sign-up
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};

export default CTASection;

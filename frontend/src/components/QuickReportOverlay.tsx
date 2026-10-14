import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuestReport } from "@/contexts/GuestReportContext";
import { useAuth } from "@/contexts/AuthContext";

interface QuickReportOverlayProps {
  onClose: () => void;
}

const QuickReportOverlay = ({ onClose }: QuickReportOverlayProps) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { setGuestEmail } = useGuestReport();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // If user is already authenticated, skip the overlay and go directly to /dashboard/report
  useEffect(() => {
    if (isAuthenticated) {
      onClose();
      navigate("/dashboard/report");
    }
  }, [isAuthenticated, navigate, onClose]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setGuestEmail(email.trim());
    onClose();
    navigate("/report-issue-guest");
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", animation: "fadeIn 200ms ease-out" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Modal card */}
      <div
        className="relative w-full bg-card"
        style={{
          maxWidth: 400,
          borderRadius: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          animation: "slideUp 220ms ease-out",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 pt-7">
          <h3 style={{ fontSize: 18, fontWeight: 600 }} className="mb-1 text-foreground">
            Report an Issue
          </h3>
          <p className="mb-5 text-caption text-muted-foreground">
            We'll send you updates on your report via email.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                ref={inputRef}
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                className="h-11 w-full"
                autoComplete="email"
              />
              {error && (
                <p className="mt-1.5 text-label text-destructive">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              style={{ backgroundColor: "#1E7F5C", color: "#fff" }}
            >
              Continue →
            </Button>
          </form>

          <p className="mt-4 text-center text-label text-muted-foreground">
            No account required. Updates delivered to your inbox.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickReportOverlay;

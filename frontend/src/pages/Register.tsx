import { useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Loader2, Eye, EyeOff, Mail, CheckCircle2, ShieldCheck, ArrowLeft } from "lucide-react";
import { sortedIndianCities } from "@/data/indianCities";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [isCityOpen, setIsCityOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enablePassword, setEnablePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Compute matched Indian city suggestions dynamically (top 30 matches)
  const citySuggestions = useMemo(() => {
    const q = city.trim().toLowerCase();
    if (!q) return sortedIndianCities.slice(0, 25);
    
    // Prioritize prefix matches, then substring matches
    const prefix = sortedIndianCities.filter((c) => c.toLowerCase().startsWith(q));
    const contains = sortedIndianCities.filter(
      (c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q)
    );
    return [...prefix, ...contains].slice(0, 30);
  }, [city]);

  // OTP Verification State
  const [step, setStep] = useState<"details" | "otp">("details");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const { register, sendSignupOtp } = useAuth();
  const navigate = useNavigate();

  // Validate Step 1 (Personal Details & City)
  const validateDetails = (): boolean => {
    setError("");
    if (!name.trim()) {
      setError("Please enter your full name.");
      return false;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (!city.trim()) {
      setError("Please select or enter your city.");
      return false;
    }
    if (enablePassword) {
      if (!password) {
        setError("Please enter a password (or toggle off password setup).");
        return false;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return false;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return false;
      }
    }
    return true;
  };

  // Step 1: Send OTP to verify email
  const handleProceedToOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    // Auto-recognize city from list if user typed a close or matching name
    let resolvedCity = city.trim();
    if (resolvedCity) {
      const exact = sortedIndianCities.find(
        (c) => c.toLowerCase() === resolvedCity.toLowerCase()
      );
      if (exact) {
        resolvedCity = exact;
      } else {
        const starts = sortedIndianCities.find(
          (c) => c.toLowerCase().startsWith(resolvedCity.toLowerCase())
        );
        if (starts) resolvedCity = starts;
      }
      setCity(resolvedCity);
    }

    const result = await sendSignupOtp(name.trim(), email.trim().toLowerCase(), resolvedCity);
    setSubmitting(false);

    if (result.success) {
      setStep("otp");
      setOtpSent(true);
      setSuccessMsg(`We sent a 6-digit verification code to ${email.trim()}.`);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
    } else {
      setError(result.error || "Failed to send verification code.");
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setResending(true);
    setError("");
    setSuccessMsg("");

    const result = await sendSignupOtp(name.trim(), email.trim().toLowerCase(), city.trim());
    setResending(false);

    if (result.success) {
      setSuccessMsg(`A new verification code was sent to ${email.trim()}.`);
    } else {
      setError(result.error || "Failed to resend code.");
    }
  };

  // OTP digit handling
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Step 2: Final Registration Submission
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    setError("");

    const passwordToSend = enablePassword && password.trim() ? password.trim() : undefined;
    const result = await register(
      name.trim(),
      email.trim().toLowerCase(),
      city.trim(),
      fullOtp,
      passwordToSend
    );

    setSubmitting(false);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="border-b bg-card">
        <div className="civic-container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <span className="text-sm font-bold text-primary-foreground">CL</span>
            </div>
            <span className="text-lg font-semibold text-foreground">Civic Lens</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-caption font-medium text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/login" className="text-caption font-medium text-muted-foreground hover:text-foreground">Log In</Link>
          </div>
        </div>
      </header>

      {/* Register container */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-h2 text-foreground">
              {step === "details" ? "Create Account" : "Verify Your Email"}
            </h1>
            <p className="mt-2 text-body text-muted-foreground">
              {step === "details"
                ? "Sign up for Civic Lens to report issues and track city progress"
                : `Enter the 6-digit code sent to ${email}`}
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-caption text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === "details" ? (
            <form onSubmit={handleProceedToOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
                <p className="text-[12px] text-muted-foreground">
                  A 6-digit verification code will be sent to this email.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="city">City</Label>
                  <span className="text-xs text-muted-foreground">Recognizes any city in India</span>
                </div>
                <div className="relative">
                  <Input
                    id="city"
                    type="text"
                    placeholder="Type your city (e.g. Pune, Kolkata, Durgapur...)"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setIsCityOpen(true);
                    }}
                    onFocus={() => setIsCityOpen(true)}
                    onBlur={() => {
                      // Slight delay to allow clicking a suggestion
                      setTimeout(() => {
                        setIsCityOpen(false);
                        // Auto-recognize exact/close match on blur
                        if (city.trim()) {
                          const exact = sortedIndianCities.find(
                            (c) => c.toLowerCase() === city.trim().toLowerCase()
                          );
                          if (exact) {
                            setCity(exact);
                          } else {
                            const starts = sortedIndianCities.find(
                              (c) => c.toLowerCase().startsWith(city.trim().toLowerCase())
                            );
                            if (starts) setCity(starts);
                          }
                        }
                      }, 200);
                    }}
                    className="h-11"
                    autoComplete="off"
                    required
                  />
                  {isCityOpen && citySuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Suggested Indian Cities ({citySuggestions.length})
                      </div>
                      {citySuggestions.map((cityName) => (
                        <div
                          key={cityName}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCity(cityName);
                            setIsCityOpen(false);
                          }}
                          className={`cursor-pointer rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                            cityName.toLowerCase() === city.toLowerCase()
                              ? "bg-accent/60 font-semibold text-primary"
                              : ""
                          }`}
                        >
                          {cityName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Start typing to search 1,400+ cities across all Indian states and union territories.
                </p>
              </div>

              {/* Password Option Toggle */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-foreground">Set a password? (Optional)</p>
                    <p className="text-[12px] text-muted-foreground">
                      You can always log in anytime with just Email OTP.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="enablePasswordToggle"
                    checked={enablePassword}
                    onChange={(e) => setEnablePassword(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                {enablePassword && (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-11 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`h-11 pr-10 ${
                            confirmPassword && password !== confirmPassword
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-label text-destructive">Passwords do not match</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Verification Code…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Verify Email & Continue
                  </>
                )}
              </Button>
            </form>
          ) : (
            /* Step 2: OTP Verification */
            <form onSubmit={handleVerifyAndRegister} className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep("details");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-caption font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {resending ? "Sending..." : "Resend Code"}
                </button>
              </div>

              <div className="space-y-2 text-center">
                <Label className="text-body font-medium">Enter 6-digit Code</Label>
                <div className="flex justify-center gap-2 pt-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="h-12 w-11 rounded-lg border border-input bg-background text-center text-xl font-bold tracking-widest text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-center text-caption text-muted-foreground">
                <ShieldCheck className="inline h-4 w-4 mr-1.5 text-primary" />
                Email OTP verification ensures verified citizen reporting and prevents fraudulent spam.
              </div>

              <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying & Creating Account…
                  </>
                ) : (
                  "Verify & Create Account"
                )}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-caption text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>

          <p className="mt-4 text-center text-label text-muted-foreground/70">
            Department and Municipal accounts are managed by city administrators.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-6 text-center">
        <p className="text-caption text-muted-foreground">
          Civic Lens &middot; Connected Civic Resolution Platform &middot; &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Register;

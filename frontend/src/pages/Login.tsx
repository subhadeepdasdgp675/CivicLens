import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/api";
import { AlertTriangle, Mail, Lock, Loader2, KeyRound, CheckCircle2, ShieldCheck, Sparkles, Building2 } from "lucide-react";

const Login = () => {
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const { login, loginWithOtp, quickAdminLogin } = useAuth();
  const navigate = useNavigate();

  const handleAdminQuickLogin = async (city = "Durgapur") => {
    setError("");
    setSuccessMsg("");
    setAdminSubmitting(true);
    try {
      const res = await quickAdminLogin(city);
      if (res.success) {
        // Save selected city
        localStorage.setItem("civiclens_municipal_selected_city", city);
        navigate("/municipal");
      } else {
        setError(res.error || "Admin login failed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in as admin.");
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.success) {
      navigate("/dashboard-redirect");
    } else {
      setError(result.error || "Login failed.");
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setSuccessMsg("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your registered email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await auth.sendLoginOtp(trimmedEmail);
      setOtpSent(true);
      setSuccessMsg(res.message || "OTP sent to your email!");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) {
      document.getElementById(`login-otp-${idx + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      document.getElementById(`login-otp-${idx - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    setOtp(next);
    const targetIdx = Math.min(pasted.length, 5);
    document.getElementById(`login-otp-${targetIdx}`)?.focus();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const otpValue = otp.join("");
    if (otpValue.length !== 6) {
      setError("Please enter all 6 digits of the OTP.");
      return;
    }
    setSubmitting(true);
    const result = await loginWithOtp(email.trim(), otpValue);
    setSubmitting(false);
    if (result.success) {
      navigate("/dashboard-redirect");
    } else {
      setError(result.error || "Invalid or expired OTP.");
    }
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password", { state: { email } });
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
            <Link to="#" className="text-caption font-medium text-muted-foreground hover:text-foreground">Help Center</Link>
          </div>
        </div>
      </header>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-h2 text-foreground">Welcome Back</h1>
            <p className="mt-2 text-body text-muted-foreground">Accessing your city dashboard</p>
          </div>

          {/* ── SEPARATE ONE-CLICK ADMIN LOGIN SECTION ── */}
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider mb-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Municipal Command Login</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              One-click direct administrator access without OTP verification.
            </p>
            <Button
              type="button"
              onClick={() => handleAdminQuickLogin("Durgapur")}
              disabled={adminSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              {adminSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging into Admin Console...</span>
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  <span>Login as Admin (1-Click)</span>
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                </>
              )}
            </Button>
          </div>

          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <span className="relative bg-card px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Or Citizen / Staff Login
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mb-6 flex rounded-lg border bg-muted p-1">
            <button
              type="button"
              onClick={() => { setAuthMode("password"); setError(""); setSuccessMsg(""); }}
              className={`flex-1 rounded-md py-2 text-caption font-medium transition-colors ${
                authMode === "password"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode("otp"); setError(""); setSuccessMsg(""); }}
              className={`flex-1 rounded-md py-2 text-caption font-medium transition-colors ${
                authMode === "otp"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email OTP Login
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-caption text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {authMode === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="citizen@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-caption font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <Button type="submit" className="h-12 w-full text-body font-semibold" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in…</> : "Log In"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otp-email">Email Address</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="otp-email"
                      type="email"
                      placeholder="citizen@example.com"
                      value={email}
                      disabled={otpSent && submitting}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    variant={otpSent ? "outline" : "default"}
                    onClick={handleSendOtp}
                    disabled={submitting || !email}
                    className="h-12 px-4 whitespace-nowrap"
                  >
                    {submitting && !otpSent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : otpSent ? (
                      "Resend OTP"
                    ) : (
                      "Send OTP"
                    )}
                  </Button>
                </div>
              </div>

              {otpSent && (
                <form onSubmit={handleOtpSubmit} className="space-y-5 pt-2">
                  <div className="space-y-2 text-center">
                    <Label className="text-body font-medium">Enter 6-digit Code</Label>
                    <div className="flex justify-center gap-2 pt-2">
                      {otp.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`login-otp-${idx}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="h-12 w-11 rounded-lg border border-input bg-background text-center text-xl font-bold shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="h-12 w-full text-body font-semibold" disabled={submitting || otp.join("").length < 6}>
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying OTP…</> : "Verify & Log In"}
                  </Button>
                </form>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-caption text-muted-foreground">
            Don't have an account yet?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Register here
            </Link>
          </p>

          {/* Demo accounts */}
          <div className="mt-6 rounded-lg border bg-muted/50 p-4">
            <p className="mb-3 text-label font-semibold text-foreground">Demo Accounts <span className="font-normal text-muted-foreground">(click to fill)</span></p>
            <div className="space-y-1">
              {[
                { label: "Citizen", email: "citizen@civiclens.in", color: "text-emerald-600" },
                { label: "Sanitation Dept", email: "sanitation@pune.gov.in", color: "text-orange-500" },
                { label: "Roads & Infra Dept", email: "roads@pune.gov.in", color: "text-red-500" },
                { label: "Water Supply Dept", email: "water@pune.gov.in", color: "text-blue-500" },
                { label: "Electrical Dept", email: "electrical@pune.gov.in", color: "text-purple-500" },
                { label: "Drainage Dept", email: "drainage@pune.gov.in", color: "text-cyan-600" },
                { label: "Footpath Dept", email: "footpath@pune.gov.in", color: "text-pink-500" },
                { label: "Municipal Admin", email: "admin@pmc.gov.in", color: "text-emerald-600" },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword("password123"); }}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-label hover:bg-accent transition-colors"
                >
                  <span className={`font-medium ${acc.color}`}>{acc.label}</span>
                  <span className="text-muted-foreground">{acc.email}</span>
                </button>
              ))}
              <p className="mt-2 px-2 text-label text-muted-foreground/70">Password for all: <span className="font-mono font-medium">password123</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer links */}
      <div className="border-t py-6 text-center">
        <div className="flex items-center justify-center gap-6 text-caption text-muted-foreground">
          <a href="#" className="hover:text-foreground">Privacy Policy</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground">Terms of Service</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground">Contact Support</a>
        </div>
        <p className="mt-4 text-label text-muted-foreground">© 2026 Civic Lens. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Login;

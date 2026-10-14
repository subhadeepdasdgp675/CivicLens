import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Mail, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/api";

type Step = "email" | "otp" | "reset" | "done";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState((location.state as any)?.email || "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");

  // ── Step 1: send OTP ──
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ──
  const otpValue = otp.join("");
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) {
      document.getElementById(`otp-${idx + 1}`)?.focus();
    }
  };
  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otpValue.length !== 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true);
    try {
      const res = await auth.verifyOtp(email, otpValue);
      setResetToken(res.resetToken);
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: reset password ──
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await auth.resetPassword(email, resetToken, newPassword);
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const Header = () => (
    <header className="border-b bg-card">
      <div className="civic-container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <span className="text-sm font-bold text-primary-foreground">CL</span>
          </div>
          <span className="text-lg font-semibold text-foreground">Civic Lens</span>
        </Link>
      </div>
    </header>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">

          {/* ── Step: email ── */}
          {step === "email" && (
            <>
              <button onClick={() => navigate("/login")} className="mb-6 flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back to Login
              </button>
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                  <Mail className="h-7 w-7 text-accent-foreground" />
                </div>
                <h1 className="text-h2 text-foreground">Forgot Password?</h1>
                <p className="mt-2 text-body text-muted-foreground">
                  Enter your registered email and we'll send you a 6-digit OTP.
                </p>
              </div>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="h-11" />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP…</> : "Send OTP"}
                </Button>
              </form>
            </>
          )}

          {/* ── Step: OTP ── */}
          {step === "otp" && (
            <>
              <button onClick={() => setStep("email")} className="mb-6 flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                  <ShieldCheck className="h-7 w-7 text-accent-foreground" />
                </div>
                <h1 className="text-h2 text-foreground">Enter OTP</h1>
                <p className="mt-2 text-body text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.<br />
                  It expires in 10 minutes.
                </p>
              </div>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="h-14 w-11 rounded-xl border-2 border-input bg-background text-center text-xl font-bold text-foreground focus:border-primary focus:outline-none transition-colors"
                    />
                  ))}
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading || otpValue.length < 6}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Verify OTP"}
                </Button>
                <p className="text-center text-caption text-muted-foreground">
                  Didn't receive it?{" "}
                  <button type="button" onClick={handleSendOtp} className="font-medium text-primary hover:underline">
                    Resend OTP
                  </button>
                </p>
              </form>
            </>
          )}

          {/* ── Step: reset password ── */}
          {step === "reset" && (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-h2 text-foreground">Set New Password</h1>
                <p className="mt-2 text-body text-muted-foreground">Choose a strong password for your account.</p>
              </div>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPwd">New Password</Label>
                  <Input id="newPwd" type="password" placeholder="Min. 6 characters"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPwd">Confirm New Password</Label>
                  <Input id="confirmPwd" type="password" placeholder="Repeat your new password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`h-11 ${confirmPassword && newPassword !== confirmPassword ? "border-destructive" : ""}`} />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-label text-destructive">Passwords do not match</p>
                  )}
                </div>
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting…</> : "Reset Password"}
                </Button>
              </form>
            </>
          )}

          {/* ── Step: done ── */}
          {step === "done" && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <ShieldCheck className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="mb-2 text-h2 text-foreground">Password Reset!</h1>
              <p className="mb-8 text-body text-muted-foreground">
                Your password has been updated successfully. You can now log in with your new password.
              </p>
              <Button className="h-11 w-full" onClick={() => navigate("/login")}>
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t py-6 text-center">
        <p className="text-label text-muted-foreground">© 2026 Civic Lens. All rights reserved.</p>
      </div>
    </div>
  );
};

export default ForgotPassword;

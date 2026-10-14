import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGuestReport } from "@/contexts/GuestReportContext";
import { issues as issuesApi, type ApiIssue } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Camera, Upload, Send, MapPin, Info, Loader2, Home } from "lucide-react";
import IssueMap from "@/components/IssueMap";
import type { IssueCategory, Issue } from "@/types";
import { CATEGORY_LABELS, DEPARTMENT_MAP, ALL_CATEGORIES } from "@/types";

// Stable reference — prevents IssueMap from re-creating the Leaflet map
const EMPTY_ISSUES: Issue[] = [];

// ── Success Overlay ────────────────────────────────────────────────
interface SuccessOverlayProps {
  email: string;
  onHome: () => void;
}

const SuccessOverlay = ({ email, onHome }: SuccessOverlayProps) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center px-4"
    style={{ backgroundColor: "rgba(0,0,0,0.45)", animation: "guestFadeIn 200ms ease-out" }}
  >
    <style>{`
      @keyframes guestFadeIn { from { opacity:0 } to { opacity:1 } }
      @keyframes guestSlideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
    `}</style>
    <div
      className="w-full bg-card text-center"
      style={{
        maxWidth: 420,
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        padding: "2.5rem 2rem",
        animation: "guestSlideUp 220ms ease-out",
      }}
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "#e8f5f0" }}>
        <CheckCircle style={{ width: 40, height: 40, color: "#1E7F5C" }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700 }} className="mb-3 text-foreground">
        Issue Reported Successfully!
      </h2>
      <p className="mb-4 text-body text-muted-foreground">
        Thank you for helping improve your city. All updates on this issue — including when it's resolved — will be sent to:
      </p>
      <span
        className="inline-block rounded-full px-4 py-1.5 text-caption font-medium text-white"
        style={{ backgroundColor: "#1E7F5C", wordBreak: "break-all" }}
      >
        {email}
      </span>
      <Button
        className="mt-6 h-11 w-full gap-2"
        style={{ backgroundColor: "#1E7F5C", color: "#fff" }}
        onClick={onHome}
      >
        <Home className="h-4 w-4" /> Back to Home
      </Button>
    </div>
  </div>
);

// ── Guest Navbar ───────────────────────────────────────────────────
const GuestNavbar = ({ email }: { email: string }) => {
  const truncated = email.length > 26 ? email.slice(0, 23) + "…" : email;
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="civic-container flex h-16 items-center justify-between">
        {/* Logo — non-interactive on this route */}
        <div className="flex items-center gap-2 select-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">CL</span>
          </div>
          <span className="text-lg font-semibold text-foreground">Civic Lens</span>
        </div>
        <span className="text-caption text-muted-foreground hidden sm:block">
          Reporting as guest · <span className="font-medium">{truncated}</span>
        </span>
      </div>
    </header>
  );
};

// ── Guest Report Page ──────────────────────────────────────────────
const GuestReportPage = () => {
  const { guestEmail, clearGuestEmail } = useGuestReport();
  const navigate = useNavigate();

  // Redirect guard — if no email in context, bounce to landing
  useEffect(() => {
    if (!guestEmail) {
      navigate("/", { replace: true });
    }
  }, [guestEmail, navigate]);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [pinLat, setPinLat] = useState(18.5204);
  const [pinLng, setPinLng] = useState(73.8567);
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [nearbyDuplicates, setNearbyDuplicates] = useState<ApiIssue[]>([]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeoLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.display_name) setLocation(data.display_name);
    } catch {
      // Silently fail
    } finally {
      setGeoLoading(false);
    }
  }, []);

  /**
   * IP-based geolocation fallback.
   * Used when browser GPS fails (e.g. desktop Mac without GPS chip).
   */
  const ipGeoFallback = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("IP lookup failed");
      const data = await res.json();
      if (data?.latitude && data?.longitude) {
        setPinLat(data.latitude);
        setPinLng(data.longitude);
        reverseGeocode(data.latitude, data.longitude);
        return;
      }
    } catch {
      // IP lookup failed — keep default Pune coordinates
    }
    reverseGeocode(18.5204, 73.8567);
    setGeoLoading(false);
  }, [reverseGeocode]);

  /**
   * Attempt to get GPS position.
   * 3-tier strategy:
   *   1. High-accuracy GPS (hardware chip)
   *   2. Low-accuracy GPS (Wi-Fi / cell tower)
   *   3. IP-based geolocation (city-level, no permissions needed)
   */
  const requestGpsPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoLoading(true);
      ipGeoFallback();
      return;
    }
    setGeoLoading(true);
    setGpsError("");

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      setPinLat(latitude);
      setPinLng(longitude);
      reverseGeocode(latitude, longitude);
    };

    const onIpFallback = () => {
      ipGeoFallback();
    };

    const onLowAccuracyFallback = () => {
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        () => {
          onIpFallback();
        },
        { enableHighAccuracy: false, maximumAge: 120_000, timeout: 15_000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          onIpFallback();
        } else {
          onLowAccuracyFallback();
        }
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 }
    );
  }, [reverseGeocode, ipGeoFallback]);

  // ── Auto-detect location on mount ──
  useEffect(() => {
    requestGpsPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable callback — avoids giving IssueMap a new function ref each render
  const handlePinMove = useCallback((lat: number, lng: number) => {
    setPinLat(lat);
    setPinLng(lng);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // Duplicate detection
  useEffect(() => {
    if (!category) { setNearbyDuplicates([]); return; }
    issuesApi.nearby(pinLat, pinLng, 500).then((res) => {
      setNearbyDuplicates(res.issues.filter((i) => i.category === category));
    }).catch(() => {});
  }, [category, pinLat, pinLng]);

  // Compress image if larger than 3MB (camera captures can be 8-12MB)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (file.size <= 3 * 1024 * 1024) { resolve(file); return; }
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => { resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file); },
          "image/jpeg", 0.8
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(compressed);
    }
  };

  const handleSubmit = async () => {
    if (!imageFile || !location || !category || !description || !title || !guestEmail) return;
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("location", location);
      formData.append("lat", String(pinLat));
      formData.append("lng", String(pinLng));
      formData.append("guest_email", guestEmail);

      await issuesApi.reportGuest(formData);   // ← no auth token needed
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackHome = () => {
    clearGuestEmail();
    navigate("/");
  };

  // ── All hooks must be above ANY early return ──
  const canSubmit = imageFile && location && category && description && title && !submitting;
  const pinCoords = useMemo<[number, number]>(() => [pinLat, pinLng], [pinLat, pinLng]);

  if (!guestEmail) return null;

  return (
    <>
      {showSuccess && <SuccessOverlay email={guestEmail} onHome={handleBackHome} />}

      <GuestNavbar email={guestEmail} />

      <div className="civic-container civic-section">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-h2 font-bold text-foreground">Report a Civic Issue</h1>
            <p className="mt-2 text-body text-muted-foreground">
              Your report will be submitted and updates sent to:{" "}
              <span className="font-semibold" style={{ color: "#1E7F5C" }}>{guestEmail}</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
              {error}
            </div>
          )}

          {/* Section 1: Upload */}
          <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
              <div>
                <h2 className="text-body font-semibold text-foreground">Upload Evidence</h2>
                <p className="text-caption text-muted-foreground">Photos help teams locate and understand the problem faster.</p>
              </div>
            </div>
            {imagePreview ? (
              <div className="relative mb-3">
                <img src={imagePreview} alt="Issue preview" className="max-h-60 w-full rounded-lg object-cover" />
                <button
                  onClick={() => { setImagePreview(null); setImageFile(null); }}
                  className="absolute top-2 right-2 rounded-lg bg-card/90 px-3 py-1 text-label font-medium text-foreground"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-10 transition-colors hover:border-primary/50">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-caption"><span className="font-medium text-primary">Upload from Gallery</span></span>
                  <span className="text-label text-muted-foreground">PNG, JPG up to 5MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-10 transition-colors hover:border-primary/50">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-caption"><span className="font-medium text-primary">Take a Photo</span></span>
                  <span className="text-label text-muted-foreground">Open device camera</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            )}
          </div>

          {/* Section 2: Location */}
          <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
              <div>
                <h2 className="text-body font-semibold text-foreground">Issue Location</h2>
                <p className="text-caption text-muted-foreground">Drag the pin on the map to adjust the exact location.</p>
              </div>
            </div>
            <div className="mb-3 overflow-hidden rounded-xl border">
              <IssueMap
                issues={EMPTY_ISSUES}
                singlePin={pinCoords}
                draggablePin
                onPinMove={handlePinMove}
                height="h-52"
              />
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <Input
                placeholder="Address auto-filled from GPS — you can edit"
                value={location}
                onChange={(e) => { setLocation(e.target.value); setGpsError(""); }}
                className="h-10 flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-primary text-caption font-medium gap-1"
                disabled={geoLoading}
                onClick={requestGpsPosition}
              >
                {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                USE GPS
              </Button>
            </div>
            {geoLoading && (
              <p className="mt-1.5 text-label text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Getting your location…
              </p>
            )}
            {gpsError && (
              <p className="mt-1.5 text-label text-destructive">{gpsError}</p>
            )}
          </div>

          {/* Section 3: Details */}
          <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
              <div>
                <h2 className="text-body font-semibold text-foreground">Issue Details</h2>
                <p className="text-caption text-muted-foreground">Provide details to help the department classify and prioritize.</p>
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <Label>Title</Label>
              <Input placeholder="Brief title for the issue" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as IssueCategory)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>{ALL_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={4}
              />
              <p className="text-right text-label text-muted-foreground">{description.length}/500 characters</p>
            </div>
          </div>

          {/* Duplicate detection */}
          {nearbyDuplicates.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-caption font-semibold text-amber-800">
                <Info className="h-4 w-4" /> Similar issues found nearby
              </div>
              <p className="mb-3 text-caption text-amber-700">
                We found {nearbyDuplicates.length} similar issue(s) within 500m. Your report may be linked automatically.
              </p>
              <div className="space-y-2">
                {nearbyDuplicates.slice(0, 3).map((dup) => (
                  <div key={dup.id} className="flex items-center gap-3 rounded-lg bg-card p-2">
                    <img src={dup.image} alt={dup.title} className="h-10 w-10 rounded object-cover" />
                    <div className="flex-1">
                      <p className="text-caption font-medium text-foreground">{dup.title}</p>
                      <p className="text-label text-muted-foreground">{dup.reporters} reporters · {dup.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-caption text-muted-foreground">
              By submitting, you agree to our <a href="#" className="text-primary hover:underline">Terms of Service</a>.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBackHome}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Send className="h-4 w-4" /> Submit Report</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuestReportPage;

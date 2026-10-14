import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { issues as issuesApi, CATEGORY_DISPLAY, type ApiIssue } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, MapPin, CheckCircle, Camera, Send, Info, Loader2, X, Search, Plus, AlertTriangle,
} from "lucide-react";
import IssueMap from "@/components/IssueMap";
import type { IssueCategory, Issue } from "@/types";
import { CATEGORY_LABELS, DEPARTMENT_MAP, ALL_CATEGORIES } from "@/types";

// Stable reference — prevents IssueMap from re-creating the Leaflet map
const EMPTY_ISSUES: Issue[] = [];

const ReportIssue = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Multi-image state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [pinLat, setPinLat] = useState(18.5204);
  const [pinLng, setPinLng] = useState(73.8567);
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [customCategory, setCustomCategory] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [createdIssueId, setCreatedIssueId] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // Location search suggestions
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Reverse geocode lat/lng → human-readable address via OpenStreetMap Nominatim.
   */
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeoLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.display_name) {
        setLocation(data.display_name);
        setSearchQuery(data.display_name);
      }
    } catch {
      // Silently fail — user can still type manually
    } finally {
      setGeoLoading(false);
    }
  }, []);

  /**
   * Forward geocode a city or location query and center/zoom the map on it.
   */
  const geocodeLocationQuery = useCallback(async (query: string, updateLocationField = true) => {
    if (!query.trim()) return;
    setSearchingLocation(true);
    try {
      const encoded = encodeURIComponent(query.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const top = data[0];
        const newLat = parseFloat(top.lat);
        const newLng = parseFloat(top.lon);
        if (!isNaN(newLat) && !isNaN(newLng)) {
          setPinLat(newLat);
          setPinLng(newLng);
          if (updateLocationField) {
            setLocation(top.display_name);
            setSearchQuery(top.display_name);
          }
        }
      }
    } catch (err) {
      console.warn("Geocode location search error:", err);
    } finally {
      setSearchingLocation(false);
    }
  }, []);

  /**
   * Initialize map center based on the user's city if known, else GPS / fallback
   */
  useEffect(() => {
    if (user?.city) {
      setGeoLoading(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(user.city + ", India")}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      )
        .then((r) => r.json())
        .then((data) => {
          if (data && data[0]) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            setPinLat(lat);
            setPinLng(lng);
            setLocation(`${user.city}, India`);
            setSearchQuery(`${user.city}, India`);
          } else {
            requestGpsPosition();
          }
        })
        .catch(() => requestGpsPosition())
        .finally(() => setGeoLoading(false));
    } else {
      requestGpsPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.city]);

  /**
   * IP-based geolocation fallback.
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
      // keep existing pin
    }
    reverseGeocode(pinLat, pinLng);
    setGeoLoading(false);
  }, [reverseGeocode, pinLat, pinLng]);

  /**
   * Attempt to get GPS position.
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
        () => onIpFallback(),
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

  // Stable callback for pin moves
  const handlePinMove = useCallback((lat: number, lng: number) => {
    setPinLat(lat);
    setPinLng(lng);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // Handle live location typing & autocomplete search
  const handleLocationInputChange = (value: string) => {
    setLocation(value);
    setSearchQuery(value);
    setGpsError("");

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim() || value.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchingLocation(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value.trim())}&format=json&addressdetails=1&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const list = await res.json();
          setSearchResults(list);
          setShowSearchResults(true);
        }
      } catch {
        // silent
      } finally {
        setSearchingLocation(false);
      }
    }, 600);
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      setPinLat(lat);
      setPinLng(lng);
      setLocation(result.display_name);
      setSearchQuery(result.display_name);
    }
    setShowSearchResults(false);
  };

  // Duplicate detection: fetch nearby issues with same category
  const [nearbyDuplicates, setNearbyDuplicates] = useState<ApiIssue[]>([]);
  useEffect(() => {
    if (!category) { setNearbyDuplicates([]); return; }
    issuesApi.nearby(pinLat, pinLng, 500).then((res) => {
      const matches = res.issues.filter((i) => i.category === category);
      setNearbyDuplicates(matches);
    }).catch(() => { });
  }, [category, pinLat, pinLng]);

  // Compress image if larger than 3MB
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

  // Add multiple files from file inputs (gallery or camera capture)
  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (imageFiles.length + newFiles.length >= 6) {
        setError("Maximum 6 photographs allowed per report.");
        break;
      }
      const compressed = await compressImage(file);
      newFiles.push(compressed);
      newPreviews.push(URL.createObjectURL(compressed));
    }

    setImageFiles((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (imageFiles.length === 0) {
      setError("Please upload at least one photograph or take a live photo as evidence.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!location.trim()) {
      setError("Please specify or search the incident location.");
      return;
    }
    if (!title.trim()) {
      setError("Please provide a concise title for the issue (at least 5 characters).");
      return;
    }
    if (title.trim().length < 5) {
      setError("Issue title must be at least 5 characters long.");
      return;
    }
    if (!category) {
      setError("Please select the municipal department or category.");
      return;
    }
    if (category === "Other" && !customCategory.trim()) {
      setError("Please specify the custom category/department for your report.");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a description of the issue (at least 10 characters).");
      return;
    }
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters long.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      imageFiles.forEach((file) => {
        formData.append("images", file);
      });
      // Also append as image for backward compatibility
      if (imageFiles[0]) {
        formData.append("image", imageFiles[0]);
      }

      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      if (customCategory) formData.append("customCategory", customCategory.trim());
      if (customDepartment) formData.append("customDepartment", customDepartment.trim());
      formData.append("location", location.trim());
      formData.append("lat", String(pinLat));
      formData.append("lng", String(pinLng));

      const res = await issuesApi.report(formData);
      setResponseMessage(res.message);
      setCreatedIssueId(res.issue?.id || null);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const isFormComplete = imageFiles.length > 0 && location.trim().length > 0 && !!category && description.trim().length >= 10 && title.trim().length >= 5;
  const pinCoords = useMemo<[number, number]>(() => [pinLat, pinLng], [pinLat, pinLng]);

  if (submitted) {
    return (
      <div className="civic-container civic-section">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-accent">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mb-3 text-h2 font-bold text-foreground">Report Submitted Successfully!</h1>
          <p className="mb-8 text-body text-muted-foreground">{responseMessage}</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate(createdIssueId ? `/dashboard/issue/${createdIssueId}` : "/dashboard")} className="gap-2">
              <Send className="h-4 w-4 rotate-[-45deg]" /> Track Issue
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="civic-container civic-section">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-h2 font-bold text-foreground">Report a Civic Issue</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Help us improve our city by reporting infrastructure problems, sanitation, or municipal concerns.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive">
            {error}
          </div>
        )}

        {/* Section 1: Upload & Camera */}
        <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
              <div>
                <h2 className="text-body font-semibold text-foreground">Upload Evidence (Multiple Photos)</h2>
                <p className="text-caption text-muted-foreground">
                  Take live photos with device camera or select multiple images from gallery (up to 6 photos).
                </p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-label font-medium text-secondary-foreground">
              {imageFiles.length}/6 photos
            </span>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleAddFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Previews grid */}
          {imagePreviews.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="group relative aspect-video overflow-hidden rounded-lg border bg-muted shadow-xs">
                  <img src={preview} alt={`Upload ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-destructive"
                    title="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    Photo {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-6 transition-all hover:border-primary hover:bg-muted/40"
            >
              <Upload className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="text-caption font-semibold text-foreground">Upload from Gallery</p>
                <p className="text-label text-muted-foreground">Select multiple images (JPEG, PNG, WebP)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-6 transition-all hover:border-primary hover:bg-primary/10"
            >
              <Camera className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="text-caption font-semibold text-primary">Take Live Photo</p>
                <p className="text-label text-muted-foreground">Open device camera to capture photo</p>
              </div>
            </button>
          </div>
        </div>

        {/* Section 2: Location & Dynamic Map */}
        <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
              <div>
                <h2 className="text-body font-semibold text-foreground">Issue Location & Dynamic Map</h2>
                <p className="text-caption text-muted-foreground">
                  Type any city, area, or address to automatically fly and zoom the map, or drag the pin.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-3 overflow-hidden rounded-xl border">
            <IssueMap
              issues={EMPTY_ISSUES}
              singlePin={pinCoords}
              draggablePin
              onPinMove={handlePinMove}
              height="h-64"
            />
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div className="relative flex-1">
                <Input
                  placeholder="Type any location, landmark, or city name…"
                  value={location}
                  onChange={(e) => handleLocationInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      geocodeLocationQuery(location);
                      setShowSearchResults(false);
                    }
                  }}
                  className="h-10 pr-9"
                />
                <button
                  type="button"
                  onClick={() => geocodeLocationQuery(location)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  title="Search location"
                >
                  {searchingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-primary text-caption font-semibold gap-1.5 shrink-0"
                disabled={geoLoading}
                onClick={requestGpsPosition}
              >
                {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                GPS
              </Button>
            </div>

            {/* Live Autocomplete Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-caption text-popover-foreground hover:bg-accent"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="line-clamp-2">{res.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {geoLoading && (
            <p className="mt-1.5 text-label text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Fetching location coordinates…
            </p>
          )}
          {gpsError && (
            <p className="mt-1.5 text-label text-destructive">{gpsError}</p>
          )}
        </div>

        {/* Section 3: Details & Expanded Categories */}
        <div className="mb-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
            <div>
              <h2 className="text-body font-semibold text-foreground">Complaint Categorization & Department</h2>
              <p className="text-caption text-muted-foreground">Select the official civic department or specify custom complaint.</p>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <Label>Issue Title</Label>
            <Input placeholder="E.g., Severe waterlogging blocking MG Road intersection" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Municipal Department / Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IssueCategory)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select official department / category" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="font-medium">{CATEGORY_LABELS[c]}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({DEPARTMENT_MAP[c]})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Category Input if "Other" is selected */}
            {category === "Other" && (
              <>
                <div className="space-y-2">
                  <Label>Specify Custom Category *</Label>
                  <Input
                    placeholder="E.g. Broken Park Bench / Street Name Sign"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="h-10 border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Department (Optional)</Label>
                  <Input
                    placeholder="E.g. Parks Department, Traffic Police"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    className="h-10"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Label>Detailed Description</Label>
            <Textarea
              placeholder="Describe the problem, hazard severity, landmarks, and duration..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={4}
            />
            <p className="text-right text-label text-muted-foreground">{description.length}/1000 characters</p>
          </div>
        </div>

        {/* Duplicate Detection */}
        {nearbyDuplicates.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-caption font-semibold text-amber-800">
              <Info className="h-4 w-4" /> Similar issues found nearby
            </div>
            <p className="mb-3 text-caption text-amber-700">
              We found {nearbyDuplicates.length} similar issue(s) within 500m. Your report may be consolidated to accelerate resolution.
            </p>
            <div className="space-y-2">
              {nearbyDuplicates.slice(0, 3).map((dup) => (
                <div key={dup.id} className="flex items-center justify-between rounded-lg bg-card p-3 shadow-xs">
                  <div>
                    <p className="text-caption font-medium text-foreground">{dup.title}</p>
                    <p className="text-label text-muted-foreground">{dup.location}</p>
                  </div>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-label font-medium text-amber-800">{dup.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-caption text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full gap-2 py-6 text-body font-semibold transition-all shadow-md ${isFormComplete
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-primary/80 hover:bg-primary text-primary-foreground"
              }`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting Report to Municipal Authorities…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit Report to Municipal Authorities
              </>
            )}
          </Button>

          {!isFormComplete && (
            <p className="text-center text-xs text-muted-foreground">
              Please ensure photo, location, category, title (min 5 chars), and description (min 10 chars) are filled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportIssue;


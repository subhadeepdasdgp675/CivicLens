// ── Re-export the User type from AuthContext ──
export type { User } from "@/contexts/AuthContext";
export type UserRole = "citizen" | "department" | "municipal";

// ── Issue Types ──
export type IssueStatus = "Pending" | "Ongoing" | "Resolved" | "Escalated";

// Minimal Issue type used by shared components like IssueMap
export interface Issue {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  image?: string;
  category?: string;
  description?: string;
  reporters?: number;
  createdAt?: string;
}

// Backend & Municipal categories (PascalCase, no spaces)
export type IssueCategory =
  | "Garbage"
  | "Pothole"
  | "WaterOverflow"
  | "StreetLight"
  | "Drainage"
  | "Footpath"
  | "Sewage"
  | "TrafficSignal"
  | "Encroachment"
  | "StrayAnimals"
  | "PublicToilet"
  | "TreePruning"
  | "HealthHazard"
  | "IllegalDumping"
  | "FireHazard"
  | "BuildingViolation"
  | "NoisePollution"
  | "Other";

// Display labels for categories
export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  Garbage: "Solid Waste & Garbage Dumps",
  Pothole: "Road Potholes & Cracks",
  WaterOverflow: "Water Pipeline Leakage / Overflow",
  StreetLight: "Street Light Outage / Broken Pole",
  Drainage: "Blocked Stormwater Drain / Waterlogging",
  Footpath: "Damaged Footpath / Pavement",
  Sewage: "Open Sewage / Manhole Overflow",
  TrafficSignal: "Traffic Signal Malfunction & Signage",
  Encroachment: "Illegal Encroachment & Unauthorized Stalls",
  StrayAnimals: "Stray Animal Menace & Cattle on Roads",
  PublicToilet: "Public Toilet Sanitation & Maintenance",
  TreePruning: "Fallen Tree Branches & Greenery Hazards",
  HealthHazard: "Mosquito Breeding & Public Health Hazard",
  IllegalDumping: "Illegal Debris & Chemical Dumping",
  FireHazard: "Fire Safety & Hazardous Wiring",
  BuildingViolation: "Unauthorized Construction & Dilapidated Building",
  NoisePollution: "Excessive Noise & Commercial Nuisance",
  Other: "Other Department / Specific Complaint",
};

export const ALL_CATEGORIES: IssueCategory[] = [
  "Garbage",
  "Pothole",
  "WaterOverflow",
  "StreetLight",
  "Drainage",
  "Footpath",
  "Sewage",
  "TrafficSignal",
  "Encroachment",
  "StrayAnimals",
  "PublicToilet",
  "TreePruning",
  "HealthHazard",
  "IllegalDumping",
  "FireHazard",
  "BuildingViolation",
  "NoisePollution",
  "Other",
];

// ── Department mapping ──
export const DEPARTMENT_MAP: Record<IssueCategory, string> = {
  Garbage: "Sanitation & Waste Management",
  Pothole: "Roads, Bridges & Infrastructure",
  WaterOverflow: "Water Supply & Distribution",
  StreetLight: "Street Lighting & Electrical",
  Drainage: "Stormwater Drainage & Flood Control",
  Footpath: "Roads, Bridges & Infrastructure",
  Sewage: "Sewerage & Wastewater Management",
  TrafficSignal: "Traffic & Transportation Management",
  Encroachment: "Town Planning & Anti-Encroachment",
  StrayAnimals: "Veterinary Services & Animal Control",
  PublicToilet: "Sanitation & Public Health",
  TreePruning: "Horticulture, Parks & Greenery",
  HealthHazard: "Public Health & Disease Prevention",
  IllegalDumping: "Sanitation & Waste Management",
  FireHazard: "Fire & Emergency Services",
  BuildingViolation: "Town Planning & Building Inspection",
  NoisePollution: "Environment & Pollution Control",
  Other: "General Municipal Grievances",
};


// ── Notification Types ──
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  issuePostId?: string | null;
  createdAt: string;
}

// ── Department Stats ──
export interface DepartmentStats {
  department: string;
  city: string;
  total: number;
  pending: number;
  ongoing: number;
  resolved: number;
  escalated: number;
  avgResolutionDays: number;
}

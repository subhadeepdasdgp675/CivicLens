import type { User } from "@/types";

export const mockUsers: User[] = [
  // Citizens
  {
    id: "c1",
    name: "Aarav Sharma",
    email: "citizen@civiclens.in",
    role: "citizen",
    city: "Pune",
    createdAt: "2025-12-01T10:00:00Z",
  },
  {
    id: "c2",
    name: "Priya Deshmukh",
    email: "priya@civiclens.in",
    role: "citizen",
    city: "Pune",
    createdAt: "2025-12-05T10:00:00Z",
  },
  {
    id: "c3",
    name: "Rohan Mehta",
    email: "rohan@civiclens.in",
    role: "citizen",
    city: "Mumbai",
    createdAt: "2025-12-10T10:00:00Z",
  },
  // Departments
  {
    id: "d1",
    name: "Sanitation Dept – Pune",
    email: "sanitation@pune.gov.in",
    role: "department",
    city: "Pune",
    department: "Sanitation",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "d2",
    name: "Roads & Infra – Pune",
    email: "roads@pune.gov.in",
    role: "department",
    city: "Pune",
    department: "Roads & Infrastructure",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "d3",
    name: "Water Supply – Pune",
    email: "water@pune.gov.in",
    role: "department",
    city: "Pune",
    department: "Water Supply",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "d4",
    name: "Electrical – Pune",
    email: "electrical@pune.gov.in",
    role: "department",
    city: "Pune",
    department: "Electrical",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "d5",
    name: "Drainage – Pune",
    email: "drainage@pune.gov.in",
    role: "department",
    city: "Pune",
    department: "Drainage",
    createdAt: "2025-01-01T00:00:00Z",
  },
  // Municipal Corporation
  {
    id: "m1",
    name: "PMC Admin",
    email: "admin@pmc.gov.in",
    role: "municipal",
    city: "Pune",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "m2",
    name: "BMC Admin",
    email: "admin@bmc.gov.in",
    role: "municipal",
    city: "Mumbai",
    createdAt: "2025-01-01T00:00:00Z",
  },
];

export const availableCities = ["Pune", "Mumbai", "Bangalore", "Delhi", "Chennai"];

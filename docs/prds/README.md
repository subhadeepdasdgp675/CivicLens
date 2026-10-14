# CivicConnect — Comprehensive System Documentation

> **A multi-city civic issue reporting platform** that enables citizens to report public problems, departments to manage and resolve them, and municipal corporations to oversee city-wide performance.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema](#4-database-schema)
5. [User Roles & Access Control](#5-user-roles--access-control)
6. [Authentication System](#6-authentication-system)
7. [Issue Lifecycle — End to End](#7-issue-lifecycle--end-to-end)
8. [Feature Breakdown by Role](#8-feature-breakdown-by-role)
   - [8.1 Citizen Features](#81-citizen-features)
   - [8.2 Department Features](#82-department-features)
   - [8.3 Municipal / Admin Features](#83-municipal--admin-features)
9. [Backend Services & Internal Logic](#9-backend-services--internal-logic)
   - [9.1 Duplicate Detection](#91-duplicate-detection)
   - [9.2 Escalation Job](#92-escalation-job)
   - [9.3 Notification System](#93-notification-system)
   - [9.4 Real-Time (Socket.IO)](#94-real-time-socketio)
   - [9.5 Email Service](#95-email-service)
   - [9.6 Image Upload (Cloudinary)](#96-image-upload-cloudinary)
10. [API Reference](#10-api-reference)
11. [Frontend Architecture](#11-frontend-architecture)
12. [File & Component Map](#12-file--component-map)
13. [Environment Variables](#13-environment-variables)
14. [Local Development Setup](#14-local-development-setup)
15. [Deployment](#15-deployment)

---

## 1. System Overview

CivicConnect is a **full-stack web application** designed to bridge the gap between citizens and local government. Citizens report civic issues (potholes, garbage, broken streetlights, etc.) with photos and GPS coordinates. The system automatically routes each issue to the correct department, tracks its progress, and escalates unresolved issues to the municipal corporation.

### Core Principles

| Principle | Implementation |
|---|---|
| **Multi-tenancy** | Each city operates as an isolated tenant — users, issues, and tickets are all city-scoped |
| **Smart routing** | Issues are automatically routed to departments based on category |
| **Deduplication** | A geospatial duplicate-detection engine merges nearby identical reports into one ticket |
| **Automatic escalation** | A nightly cron job escalates tickets unresolved for 7+ days |
| **Real-time updates** | Socket.IO pushes live updates to all relevant parties |

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite + React)                  │
│  Citizens / Departments / Municipal — served from Vercel        │
└─────────────────────────┬──────────────────────────────────────┘
                          │ HTTPS + WebSocket
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express + Node.js)                 │
│                                                                  │
│  REST API (/api/*)      Socket.IO server           Cron Jobs    │
│  ├─ authRoutes          ├─ JWT auth middleware     ├─ Escalation │
│  ├─ issueRoutes         ├─ Room management         │  (daily)   │
│  ├─ ticketRoutes        └─ Event broadcasting      └────────────│
│  ├─ municipalRoutes                                             │
│  └─ notificationRoutes                                         │
└──────────────┬────────────────────────────────┬────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────┐             ┌─────────────────────────┐
│  PostgreSQL (Supabase)│             │   Cloudinary             │
│  via Prisma ORM      │             │   (Image CDN)            │
│  ├─ Users            │             └─────────────────────────┘
│  ├─ Cities           │
│  ├─ Departments      │             ┌─────────────────────────┐
│  ├─ IssuePosts       │             │   Gmail SMTP             │
│  ├─ ConsolidatedTickets│            │   (Email confirmations) │
│  ├─ Comments         │             └─────────────────────────┘
│  ├─ Notifications    │
│  └─ Upvotes          │
└──────────────────────┘
```

### Key Design Decisions

- **City isolation**: Every query is scoped to `cityId` — no cross-city data leakage.
- **Stateless JWT auth**: The `auth` middleware decodes the JWT payload directly, avoiding a DB round-trip per request. The token embeds `id`, `role`, `cityId`, and `departmentId`.
- **Ticket aggregation**: Multiple `IssuePost` records (from different reporters) are grouped under one `ConsolidatedTicket`. This is the unit departments work with.
- **Fire-and-forget side effects**: Emails, socket emissions, and background notifications never block the HTTP response — they use `.catch(() => {})` to prevent crashes.

---

## 3. Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js + TypeScript | v22, TS 5.x | Runtime & type safety |
| Express.js | ^4.21 | HTTP server framework |
| Prisma ORM | ^6.6 | Database access layer |
| PostgreSQL (Supabase) | – | Primary database |
| Socket.IO | ^4.8 | Real-time bidirectional events |
| Multer + Cloudinary | – | File upload pipeline |
| JWT (jsonwebtoken) | ^9.0 | Stateless authentication |
| bcryptjs | ^2.4 | Password hashing |
| node-cron | ^3.0 | Scheduled escalation job |
| Nodemailer | ^8.0 | Transactional email via Gmail |
| Zod | ^3.x | Request body validation |
| compression | ^1.8 | gzip response compression |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React 18 | ^18.3 | UI framework |
| Vite | ^5.4 | Build tool & dev server |
| TypeScript | ^5.8 | Type safety |
| React Router DOM | ^6.30 | Client-side routing |
| TanStack Query | ^5.83 | Server state & caching |
| Socket.IO Client | ^4.8 | Real-time updates |
| Leaflet + React-Leaflet | ^1.9 | Interactive maps |
| Recharts | ^2.15 | Charts & analytics |
| Tailwind CSS | ^3.4 | Utility-first styling |
| Radix UI | – | Accessible UI primitives |
| React Hook Form + Zod | – | Form management & validation |
| Framer Motion | ^12 | Animations |
| Lucide React | ^0.462 | Icon library |

---

## 4. Database Schema

**File**: `backend/prisma/schema.prisma`

### Models

#### `User`
Represents all platform users (citizens, department staff, municipal admins).

```prisma
model User {
  id           String      @id @default(uuid())
  name         String
  email        String      @unique
  password     String      // bcrypt hash
  role         UserRole    // citizen | department | municipal
  avatar       String?
  otpCode      String?     // for password reset flow
  otpExpiresAt DateTime?   // 10-minute OTP window
  cityId       String?     // null only for department users without a city
  departmentId String?     // only set for department role users
}
```

#### `City`
Each city is a top-level tenant. All data is scoped to a city.

```prisma
model City {
  id   String @id @default(uuid())
  name String @unique  // e.g. "Mumbai", "Pune"
}
```

#### `Department`
Represents a city government department. Each department handles one `IssueCategory`.

```prisma
model Department {
  id           String        @id
  name         String        // e.g. "Roads Department"
  categoryType IssueCategory // e.g. Pothole
  cityId       String
  // @@unique([cityId, categoryType]) — one dept per category per city
}
```

#### `IssuePost`
The core record. Created when any user (citizen or guest) submits a report.

```prisma
model IssuePost {
  id                   String
  title                String
  description          String
  category             IssueCategory
  location             String         // human-readable address
  lat                  Float          // for duplicate detection & map
  lng                  Float
  status               IssueStatus    // Pending | Ongoing | Resolved | Escalated
  image                String         // Cloudinary URL
  reporters            Int            // count of duplicate reports merged here
  guestEmail           String?        // set for anonymous reporters
  consolidatedTicketId String?        // links to the department's ticket
  reportedById         String?        // null for guest reports
  cityId               String
}
```

#### `ConsolidatedTicket`
The unit of work for departments. One ticket groups all `IssuePosts` about the same problem.

```prisma
model ConsolidatedTicket {
  id                String
  status            IssueStatus   // mirrors all linked IssuePosts
  escalationFlag    Boolean       // true once auto-escalated
  proofImage        String?       // resolution proof (Cloudinary URL)
  resolutionComment String?
  escalatedAt       DateTime?
  resolvedAt        DateTime?
  departmentId      String
  cityId            String
}
```

#### `Comment`
A comment on any `IssuePost`. Department users' comments automatically have `isDepartmentUpdate: true`.

#### `Notification`
In-app notifications persisted to DB and pushed via Socket.IO. Linked to a user and optionally to an issue.

#### `Upvote`
A unique constraint on `(userId, issuePostId)` enforces one upvote per user per issue.

### Enums

| Enum | Values |
|---|---|
| `UserRole` | `citizen`, `department`, `municipal` |
| `IssueStatus` | `Pending`, `Ongoing`, `Resolved`, `Escalated` |
| `IssueCategory` | `Garbage`, `Pothole`, `WaterOverflow`, `StreetLight`, `Drainage`, `Footpath`, `Other` |
| `NotificationType` | `info`, `success`, `warning`, `error` |

---

## 5. User Roles & Access Control

Access control is enforced in two layers:
1. **`authenticate` middleware** — verifies the JWT and populates `req.user`
2. **`authorize(...roles)` middleware** — checks `req.user.role` against allowed roles

**File**: `backend/src/middleware/auth.ts`

| Role | Can Access | Description |
|---|---|---|
| `citizen` | `/dashboard/*` | Reports issues, upvotes, comments, views own profile |
| `department` | `/department/*` | Manages tickets assigned to their department only |
| `municipal` | `/municipal/*` | City-wide oversight, reports, escalations |
| *(anonymous)* | `/report-issue-guest` | Can report issues without an account |

### City Isolation Middleware

**File**: `backend/src/middleware/cityIsolation.ts`

Department and municipal routes also apply `cityIsolation` middleware, which ensures that a department user from City A cannot access tickets from City B, even if they somehow have the ticket ID.

---

## 6. Authentication System

**Backend file**: `backend/src/controllers/authController.ts`  
**Frontend files**: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/pages/Register.tsx`, `frontend/src/pages/ForgotPassword.tsx`

### Registration Flow

1. User submits: `name`, `email`, `password`, `city`
2. Backend validates with Zod (`registerSchema`)
3. Checks for duplicate email — `409` if exists
4. Finds or creates the `City` record by name
5. Hashes password with `bcrypt` (12 rounds)
6. Creates `User` with `role: "citizen"`, linked to city
7. Issues JWT containing `{ id, email, role, cityId, departmentId: null }`
8. Frontend stores token in `localStorage` as `civicconnect_token`
9. `AuthContext` stores the normalized user object in React state

### Login Flow

1. User submits: `email`, `password`
2. Backend finds user by email, compares password with `bcrypt.compare`
3. On success: issues new JWT, returns `user` (without password)
4. Frontend: `setToken()` → `setUser()` → redirect to role-specific dashboard via `DashboardRouter`

### Password Reset (OTP Flow)

1. **Forgot Password**: User submits email → backend generates 6-digit OTP, stores it with a 10-minute expiry on the `User` record, sends via Gmail
2. **Verify OTP**: User submits OTP → backend validates code and expiry → returns a `resetToken` (same as the OTP)
3. **Reset Password**: User submits new password + OTP → backend re-validates, hashes new password, clears `otpCode` and `otpExpiresAt`

Security note: The forgot-password endpoint always returns `200` regardless of whether the email exists, to prevent email enumeration attacks.

### JWT Structure

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "citizen",
  "cityId": "uuid",
  "departmentId": null,
  "iat": 1234567890,
  "exp": 1235172690
}
```

Token expiry is configured via `JWT_EXPIRES_IN` (default: `7d`).

---

## 7. Issue Lifecycle — End to End

This is the central feature of the system. An issue moves through the following states:

```
[REPORT] ──► Pending ──► Ongoing ──► Resolved
                │
                └──► Escalated (auto, after 7 days)
```

### Step-by-Step Lifecycle

#### Phase 1: Submission

**Citizen path** (`POST /api/issues`):
1. Citizen fills the report form: title, description, category, GPS location, photo
2. Frontend sends multipart form data to `POST /api/issues`
3. `upload.single("image")` (Multer) buffers the file in memory
4. `uploadToCloudinary` middleware streams the buffer to Cloudinary, receives a secure URL, stores it in `req.file.path`
5. `reportIssue` controller runs:
   - Validates fields with Zod
   - Checks `cityId` from the JWT
   - Runs **duplicate detection** and **department lookup** in parallel
   - If no duplicate: creates a new `ConsolidatedTicket`, creates the `IssuePost` linked to it
   - If duplicate found: links the new `IssuePost` to the existing ticket, increments `reporters` count
   - Fires background notifications: citizen gets "Issue Submitted", dept users get "New Issue Assigned"
   - Emits `issue:created` Socket.IO event to the city room
   - Sends confirmation email to citizen (fire-and-forget)
6. Returns `{ message, issue, isDuplicate }`

**Guest path** (`POST /api/issues/guest`):
- No auth required — route is defined before `router.use(authenticate)`
- Requires a `guest_email` field in the form body
- City assignment falls back to the first city in the database
- `guestEmail` is stored on the `IssuePost` for future email updates
- No in-app notifications are sent (no user account to notify)

#### Phase 2: Department Review

1. Department user logs in and sees their `DeptDashboard`
2. Dashboard calls `GET /api/tickets` — returns all `ConsolidatedTicket` records for their `departmentId` + `cityId`
3. Dept user clicks a ticket → `GET /api/tickets/:id` returns full detail with all linked `IssuePost` records, comments, and upvote counts
4. Dept user clicks **Mark as Ongoing** → `PATCH /api/tickets/:id/status` with `{ status: "Ongoing" }`
   - Updates the `ConsolidatedTicket.status`
   - Runs `updateMany` on all linked `IssuePosts` to sync their status
   - Notifies all authenticated reporters via in-app notification
   - Emits `ticket:statusChanged` socket event
   - Sends status update emails to both authenticated and guest reporters

#### Phase 3: Resolution

1. Dept user completes the fix, uploads a proof photo via `PATCH /api/tickets/:id/status` with `status: "Resolved"` + `proofImage`
   - **Proof image is mandatory** for resolution — the controller returns `400` if not provided
   - `resolvedAt` timestamp is set on the ticket
   - All linked issue posts are synced to `Resolved`
   - Reporters receive "Status Updated — Resolved" notification with the proof image URL in the email

#### Phase 4: Escalation (Automated)

**File**: `backend/src/jobs/escalationJob.ts`, `backend/src/services/escalationService.ts`

1. A `node-cron` job runs **every day at midnight** (`0 0 * * *`)
2. `runEscalation()` queries for all `ConsolidatedTicket` records where:
   - `status` is `Pending` or `Ongoing`
   - `escalationFlag` is `false`
   - `createdAt` is older than 7 days (`ESCALATION_DAYS` env var)
3. Batch-updates all eligible tickets to `Escalated`, sets `escalationFlag: true`, `escalatedAt: now()`
4. Batch-updates all linked `IssuePost` records
5. Sends notifications to:
   - Municipal users: "Escalation Alert" (type: `error`)
   - Issue reporters: "Issue Escalated" (type: `warning`)

---

## 8. Feature Breakdown by Role

### 8.1 Citizen Features

#### Dashboard (`/dashboard`)
**File**: `frontend/src/pages/citizen/CitizenDashboard.tsx`

- Displays the citizen's **issue feed** — all issues in their city, sorted by newest
- **Map view** toggle: switches to an interactive Leaflet map showing issue pins color-coded by status
- **Stats cards**: total reported, resolved, pending, escalated counts
- **Quick Report Banner**: shortcut to the report form
- Real-time: new issues from other citizens appear instantly via `issue:created` Socket.IO event

#### Report an Issue (`/dashboard/report`)
**File**: `frontend/src/pages/citizen/ReportIssue.tsx`

- Multi-step form: basic info → location (GPS or manual) → photo upload → preview → submit
- Uses the browser Geolocation API for auto-coordinates
- Photo preview before upload
- On submission:
  - If the backend detects a nearby duplicate: shows a "Duplicate Detected" notice
  - If new: shows success message with department name

#### Issue Detail (`/dashboard/issue/:id`)
**File**: `frontend/src/pages/citizen/IssueDetail.tsx`

- Full issue information: photo, status badge, reporter info, location map pin
- **Upvote**: toggle upvote via `POST /api/issues/:id/upvote` (optimistic atomic: creates upvote, rolls back to delete if P2002 unique constraint fires)
- **Comment thread**: paginated using cursor-based pagination — "Load more" button
- Department staff comments appear highlighted with a "Department Update" badge
- **Ticket status**: shows if the associated department ticket has proof image or resolution comment
- Real-time: new comments pushed via `issue:commented` socket event (user must join the `issue:<id>` room)

#### Search (`/dashboard/search`)
**File**: `frontend/src/pages/citizen/SearchPage.tsx`

- Searches across issue titles and locations via `GET /api/issues?search=<query>`
- Filter by category and status
- Results displayed as cards with status badge and reporter count

#### Profile (`/dashboard/profile`)
**File**: `frontend/src/pages/citizen/ProfilePage.tsx`

- Shows user details (name, email, city, role, join date)
- **My Issues** tab: paginated list of issues reported by the citizen
  - Filter by status, search by title/location
  - Fetched via `GET /api/issues/user/:userId`
- **Upvoted Issues** tab: issues the citizen has upvoted
  - Fetched via `GET /api/issues/upvoted`

#### Guest Reporting (`/report-issue-guest`)
**File**: `frontend/src/pages/GuestReportPage.tsx`

- A standalone page requiring no account
- Citizen provides email address (required — used for email status updates)
- Same form fields as the authenticated report form
- Submissions go to `POST /api/issues/guest` — no JWT required
- Guest receives confirmation email and future status update emails

#### Notifications (`/dashboard/notifications`)
**File**: `frontend/src/pages/NotificationsPage.tsx`

- Lists all notifications for the logged-in user
- Unread badge count shown in Navbar (powered by Socket.IO + `SocketContext`)
- Mark individual notifications as read or mark all as read
- Notification types: `info`, `success`, `warning`, `error` — displayed with color-coded icons

---

### 8.2 Department Features

Department accounts are **manually provisioned** by municipal admins (no self-registration). A department user is linked to exactly one `Department` and one `City`.

#### Department Dashboard (`/department`)
**File**: `frontend/src/pages/department/DeptDashboard.tsx`

- **Stats row**: total tickets, pending, ongoing, resolved, escalated, avg. resolution days
  - Fetched from `GET /api/tickets/stats`
- **Ticket list**: filtered by status (`All`, `Pending`, `Ongoing`, `Resolved`, `Escalated`)
  - Fetched from `GET /api/tickets` (scoped to dept + city in backend)
  - Each card shows: issue title, category, location, reporter count, age, current status
- Real-time: `ticket:statusChanged` event updates a ticket's status badge without a page refresh

#### Ticket Detail (`/department/ticket/:id`)
**File**: `frontend/src/pages/department/TicketDetail.tsx`

- Full consolidated ticket view with all linked issue posts
- **Reporter count**: sum of all `reporters` fields across linked posts
- **Comment on an issue**: department can post updates on individual issue posts (flagged as `isDepartmentUpdate: true`)
- **Upload Proof**: separate uploader or combined with status update
- **Status Update Panel**: dropdown to select `Ongoing`, `Resolved`, optional resolution comment + proof image
  - `Resolved` enforces a proof image — shown inline in the UI
  - On save → `PATCH /api/tickets/:id/status` — syncs all linked issues + sends notifications to all reporters

#### Performance (`/department/performance`)
**File**: `frontend/src/pages/department/DeptPerformance.tsx`

- Charts and KPIs specific to the current department:
  - Resolution rate over time
  - Ticket breakdown by status
  - Average resolution days
  - Category distribution

---

### 8.3 Municipal / Admin Features

Municipal accounts oversee an entire city. They have read-only visibility into department performance with no ability to modify tickets directly.

#### City Overview (`/municipal`)
**File**: `frontend/src/pages/municipal/MunicipalOverview.tsx`

- **KPI row**: total issues, resolved, pending, ongoing, escalated, resolution rate, citizen count, 7-day new issues
  - Fetched from `GET /api/municipal/overview`
  - Backend uses parallel `groupBy` queries — single DB round-trip for status counts
- **Department table**: per-department breakdown of Pending / Ongoing / Resolved / Escalated tickets
- **Issue Map**: interactive Leaflet map showing all city issues, color-coded by status
  - Uses `GET /api/issues/map` — lightweight geo-only endpoint, capped at 500 results
  - Filter by department, status, category
  - Click on a pin → popup with issue title, category, reporter count

#### Department Management (`/municipal/departments`)
**File**: `frontend/src/pages/municipal/MunicipalDepartments.tsx`

- Performance table for all departments in the city
- Metrics per department: total tickets, resolved, escalated, resolution rate %, avg. resolution days
- Computed by `GET /api/municipal/departments`
  - Uses a single `groupBy` for ticket status counts + a separate query for resolved tickets with timestamps to compute avg. days
- Best/worst performing department highlight cards

#### Escalations (`/municipal/escalations`)
**File**: `frontend/src/pages/municipal/MunicipalEscalations.tsx`

- Lists all `Escalated` status `ConsolidatedTicket` records for the city
- Paginated via `GET /api/municipal/escalations`
- Shows: department name, original issue title, location, reporter count, escalation date
- Interactive map panel showing escalated issue locations

#### Reports & Analytics (`/municipal/reports`)
**File**: `frontend/src/pages/municipal/MunicipalReports.tsx`

- **KPI Cards**: total, resolved, pending, escalated with resolution rate
- **Status Distribution Pie Chart** (Recharts)
- **Resolution Gauge**: RadialBarChart showing % resolved, color-coded Excellent / Needs Improvement / Critical
- **Issue Share by Department**: horizontal bar chart
- **Department Comparison Bar Chart**: total vs. resolved vs. escalated per department
- **Best / Worst Department Insight Cards**
- **Department Performance Table**: full breakdown
- **Export CSV**: downloads a CSV report via `GET /api/municipal/reports/export?format=csv`
  - Uses `import.meta.env.VITE_API_URL` (not `window.location.origin`) to ensure correct URL in production

---

## 9. Backend Services & Internal Logic

### 9.1 Duplicate Detection

**File**: `backend/src/services/duplicateDetection.ts`

Called during every issue submission (both citizen and guest). Uses the **Haversine formula** to compute great-circle distance between GPS coordinates.

**Algorithm**:
1. Query all `IssuePost` records in the same city, same category, with `status` in `[Pending, Ongoing]`
2. For each result, compute Haversine distance to the new report's coordinates
3. If any existing post is within `DUPLICATE_RADIUS_METERS` (default: 20 metres), return its `consolidatedTicketId`
4. Return `null` if no duplicate found

**On duplicate detected**:
- New `IssuePost` is linked to the existing `ConsolidatedTicket` (no new ticket created)
- `reporters` count is incremented on all posts in that ticket (`updateMany`)
- Response message informs the user their report was merged

**File**: `backend/src/utils/geo.ts` — contains the actual Haversine distance function.

### 9.2 Escalation Job

**Files**: `backend/src/jobs/escalationJob.ts`, `backend/src/services/escalationService.ts`

A `node-cron` scheduled job that:
- **Schedule**: daily at `00:00` (`0 0 * * *`)
- **Criteria**: tickets in `Pending` or `Ongoing` status, not yet escalated, older than `ESCALATION_DAYS` (default: 7)
- **Batch efficiency**: uses `updateMany` — escalates all eligible tickets in a single DB query
- **Notifications**: sends in-app alerts to municipal users (type: `error`) and reporters (type: `warning`) concurrently via `Promise.all`

### 9.3 Notification System

**File**: `backend/src/services/notificationService.ts`

Four helper functions, all using `createMany` for batch efficiency:

| Function | Who is notified | When |
|---|---|---|
| `createNotification(userId, ...)` | A single user | Issue submitted confirmation |
| `notifyIssueReporters(ticketId, ...)` | All reporters linked to a ticket | Status updates |
| `notifyDepartmentUsers(deptId, ...)` | All users in a department | New issue assigned |
| `notifyMunicipalUsers(cityId, ...)` | All municipal users in a city | Escalation alerts |

Every notification function also calls the matching Socket.IO emit function to push a real-time `notification:new` event to the user's personal room.

### 9.4 Real-Time (Socket.IO)

**Backend file**: `backend/src/config/socket.ts`  
**Backend events file**: `backend/src/services/socketEvents.ts`  
**Frontend file**: `frontend/src/contexts/SocketContext.tsx`

#### Server-Side Room Architecture

On connection, the server:
1. Verifies the JWT from `socket.handshake.auth.token`
2. Auto-joins the socket to:
   - `user:<userId>` — for personal notifications
   - `city:<cityId>` — for city-wide issue broadcasts
   - `department:<departmentId>` — for department ticket updates

Clients can also dynamically join/leave `issue:<issueId>` rooms for real-time comments on a specific issue.

#### Events

| Event | Emitted To | Triggered By |
|---|---|---|
| `issue:created` | `city:<cityId>` room | New issue submitted |
| `issue:upvoted` | `issue:<issueId>` room | Upvote toggled |
| `issue:commented` | `issue:<issueId>` room | New comment added |
| `ticket:statusChanged` | `department:<deptId>` + all `issue:<id>` rooms | Ticket status updated |
| `notification:new` | `user:<userId>` room | Any notification created |

#### Frontend Integration

`SocketContext` (`frontend/src/contexts/SocketContext.tsx`):
- Manages the socket lifecycle (connects on auth, disconnects on logout)
- Exposes `socket`, `isConnected`, `joinIssueRoom`, `leaveIssueRoom`
- Tracks `unreadCount` badge — increments on `notification:new`, decremented/cleared when user reads notifications

### 9.5 Email Service

**File**: `backend/src/services/emailService.ts`

Uses `Nodemailer` with Gmail SMTP (App Password). All email calls are **fire-and-forget** — they never block the HTTP response.

| Email Type | Trigger | Recipients |
|---|---|---|
| Issue Confirmation | New issue submitted | Citizen reporter / Guest email |
| OTP Email | Forgot password | User's registered email |
| Status Update | Ticket status changed | All authenticated reporters + guest reporters |

The status update email includes:
- New status label
- Resolution comment (if provided)
- Proof image URL (if status is `Resolved`)

### 9.6 Image Upload (Cloudinary)

**File**: `backend/src/middleware/upload.ts`

A two-stage pipeline:
1. **Multer** (`memoryStorage`): validates MIME type (JPEG, PNG, WebP, GIF, HEIC), enforces file size limit from `MAX_FILE_SIZE` env var
2. **`uploadToCloudinary` middleware**: streams the buffer to Cloudinary using `upload_stream`, applies `quality: "auto"` + `fetch_format: "auto"` (auto-converts to WebP for smaller files), stores the returned `secure_url` in `req.file.path`

Downstream controllers read `req.file.path` as the final Cloudinary URL and persist it to the database.

---

## 10. API Reference

All routes are prefixed with `/api`. Authenticated routes require `Authorization: Bearer <token>`.

### Auth Routes (`/api/auth`)

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| `POST` | `/register` | ❌ | `name, email, password, city` | Register citizen |
| `POST` | `/login` | ❌ | `email, password` | Login (all roles) |
| `GET` | `/me` | ✅ | – | Get current user |
| `POST` | `/forgot-password` | ❌ | `email` | Request OTP |
| `POST` | `/verify-otp` | ❌ | `email, otp` | Verify OTP |
| `POST` | `/reset-password` | ❌ | `email, otp, newPassword` | Reset password |

### Issue Routes (`/api/issues`)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/guest` | ❌ | – | Submit guest issue (requires `guest_email`) |
| `POST` | `/` | ✅ | citizen | Submit authenticated issue |
| `GET` | `/` | ✅ | all | List issues (filter: `cityId, category, status, search, page, limit`) |
| `GET` | `/map` | ✅ | all | Lightweight geo data (max 500 records) |
| `GET` | `/nearby` | ✅ | all | Issues within radius of coordinates |
| `GET` | `/upvoted` | ✅ | citizen | Issues upvoted by current user |
| `GET` | `/user/:userId` | ✅ | all | Issues by a specific user |
| `GET` | `/:id` | ✅ | all | Issue detail with comments + ticket |
| `GET` | `/:id/comments` | ✅ | all | Paginated comments (cursor-based) |
| `POST` | `/:id/upvote` | ✅ | citizen | Toggle upvote (atomic) |
| `POST` | `/:id/comments` | ✅ | all | Add comment (optional image) |

### Ticket Routes (`/api/tickets`)

All ticket routes require `department` role + city isolation.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/stats` | Department stats (groupBy — single query) |
| `GET` | `/` | List tickets (filter: `status, page, limit`) |
| `GET` | `/:id` | Full ticket detail with all linked issues |
| `PATCH` | `/:id/status` | Update status (proof image required for Resolved) |
| `POST` | `/:id/proof` | Upload proof image separately |

### Municipal Routes (`/api/municipal`)

All municipal routes require `municipal` role + city isolation.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/overview` | City KPIs + department breakdown |
| `GET` | `/departments` | Per-department performance stats |
| `GET` | `/escalations` | All escalated tickets (paginated) |
| `GET` | `/reports/analytics` | Monthly trends + category breakdown |
| `GET` | `/reports/export` | Export data as CSV or JSON (`?format=csv`) |

### Notification Routes (`/api/notifications`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | List user's notifications (`?unreadOnly=true`) |
| `PATCH` | `/:id/read` | Mark one notification as read |
| `PATCH` | `/read-all` | Mark all notifications as read |

---

## 11. Frontend Architecture

### Context Providers (in `App.tsx`)

```
QueryClientProvider               ← TanStack Query (server-state caching)
  └── AuthProvider                ← User auth state + login/logout/register
        └── GuestReportProvider  ← State for the guest report flow
              └── SocketProvider ← Real-time socket + unread badge count
                    └── TooltipProvider + Toaster + BrowserRouter
                          └── Routes
```

### Route Structure (`frontend/src/App.tsx`)

```
/                         → Landing page (Index)
/login                    → Login
/register                 → Register
/forgot-password          → Password reset flow
/report-issue-guest       → Guest reporting (no auth)
/dashboard-redirect       → Redirects based on role (DashboardRouter)

/dashboard/               → CitizenLayout (requires role: citizen)
  index                   → CitizenDashboard
  report                  → ReportIssue
  issue/:id               → IssueDetail
  search                  → SearchPage
  profile                 → ProfilePage
  notifications           → NotificationsPage

/department/              → DepartmentLayout (requires role: department)
  index                   → DeptDashboard
  ticket/:id              → TicketDetail
  performance             → DeptPerformance
  notifications           → NotificationsPage

/municipal/               → MunicipalLayout (requires role: municipal)
  index                   → MunicipalOverview
  departments             → MunicipalDepartments
  escalations             → MunicipalEscalations
  reports                 → MunicipalReports
  notifications           → NotificationsPage
```

### Route Protection (`frontend/src/components/ProtectedRoute.tsx`)

Wraps role-sensitive routes. Redirects to `/login` if not authenticated. Redirects to the user's role-appropriate dashboard if they try to access a forbidden section.

### API Client (`frontend/src/lib/api.ts`)

A centralized typed API client. Key design:

- `BACKEND_URL` = `import.meta.env.VITE_API_URL ?? ""` — empty string means Vite proxy is used locally (`/api → localhost:5001`), production uses the full backend URL
- `authHeaders()` reads the JWT from `localStorage` and injects `Authorization: Bearer <token>`
- `request<T>()` is the generic fetch wrapper used by all API methods
- `ApiError` class with HTTP `status` field for fine-grained error handling

---

## 12. File & Component Map

### Backend

```
backend/
├── prisma/
│   └── schema.prisma              ← Database schema (all models & enums)
└── src/
    ├── config/
    │   ├── db.ts                  ← Prisma client singleton
    │   ├── env.ts                 ← Environment variable validation
    │   └── socket.ts              ← Socket.IO server init + room logic
    ├── controllers/
    │   ├── authController.ts      ← Register, login, OTP, reset password
    │   ├── issueController.ts     ← CRUD + upvote + comments for issues
    │   ├── guestIssueController.ts← Unauthenticated issue reporting
    │   ├── ticketController.ts    ← Consolidated ticket management
    │   ├── municipalController.ts ← City overview, analytics, export
    │   └── notificationController.ts← List + mark read notifications
    ├── jobs/
    │   └── escalationJob.ts       ← node-cron scheduler (daily midnight)
    ├── middleware/
    │   ├── auth.ts                ← JWT authenticate + role authorize
    │   ├── cityIsolation.ts       ← Prevents cross-city data access
    │   ├── upload.ts              ← Multer + Cloudinary pipeline
    │   └── errorHandler.ts        ← Global Express error handler
    ├── routes/
    │   ├── authRoutes.ts
    │   ├── issueRoutes.ts
    │   ├── ticketRoutes.ts
    │   ├── municipalRoutes.ts
    │   └── notificationRoutes.ts
    ├── services/
    │   ├── duplicateDetection.ts  ← Haversine geo-dedup logic
    │   ├── escalationService.ts   ← Batch escalation logic
    │   ├── emailService.ts        ← Nodemailer templates
    │   ├── notificationService.ts ← Batch notification creation
    │   └── socketEvents.ts        ← Emit helpers for each event type
    └── utils/
        ├── geo.ts                 ← Haversine formula
        └── validators.ts          ← Zod schemas for request bodies
```

### Frontend

```
frontend/src/
├── App.tsx                        ← Root routing + providers
├── main.tsx                       ← ReactDOM entry point
├── contexts/
│   ├── AuthContext.tsx             ← Auth state, login/register/logout
│   ├── SocketContext.tsx           ← Socket.IO lifecycle + unread count
│   └── GuestReportContext.tsx      ← Guest report form state
├── lib/
│   └── api.ts                     ← Typed API client + all response types
├── layouts/
│   ├── CitizenLayout.tsx           ← Navbar + sidebar for citizen routes
│   ├── DepartmentLayout.tsx        ← Navbar + sidebar for dept routes
│   └── MunicipalLayout.tsx         ← Navbar + sidebar for municipal routes
├── components/
│   ├── ProtectedRoute.tsx          ← Auth + role guard
│   ├── DashboardRouter.tsx         ← Role-based redirect after login
│   ├── Navbar.tsx                  ← Top navigation with notification badge
│   ├── IssueCard.tsx               ← Issue list item card
│   ├── IssueFeed.tsx               ← Scrollable issue list
│   ├── IssueMap.tsx                ← Leaflet map component
│   ├── StatusBadge.tsx             ← Colored status pill
│   ├── QuickReportBanner.tsx       ← CTA shortcut to report form
│   └── ui/                         ← Radix UI + shadcn primitives
├── pages/
│   ├── Index.tsx                   ← Landing page
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── ForgotPassword.tsx          ← OTP reset flow (3 steps)
│   ├── GuestReportPage.tsx         ← Anonymous issue reporting
│   ├── NotificationsPage.tsx       ← Shared notification list page
│   ├── citizen/
│   │   ├── CitizenDashboard.tsx    ← Feed + map + stats
│   │   ├── ReportIssue.tsx         ← Multi-step report form
│   │   ├── IssueDetail.tsx         ← Full issue view + comments
│   │   ├── SearchPage.tsx          ← Search & filter
│   │   └── ProfilePage.tsx         ← User profile + issue history
│   ├── department/
│   │   ├── DeptDashboard.tsx       ← Ticket list + stats
│   │   ├── TicketDetail.tsx        ← Full ticket + status update
│   │   └── DeptPerformance.tsx     ← Charts + KPIs
│   └── municipal/
│       ├── MunicipalOverview.tsx   ← City dashboard + map
│       ├── MunicipalDepartments.tsx← Dept performance table
│       ├── MunicipalEscalations.tsx← Escalated ticket list + map
│       └── MunicipalReports.tsx    ← Analytics charts + CSV export
└── hooks/                          ← Custom React hooks
```

---

## 13. Environment Variables

### Backend (`backend/.env`)

| Variable | Example | Description |
|---|---|---|
| `PORT` | `5001` | Express server port |
| `NODE_ENV` | `development` | Environment flag |
| `DATABASE_URL` | `postgresql://...?pgbouncer=true` | Pooled DB URL (used by Prisma at runtime) |
| `DIRECT_URL` | `postgresql://...` | Direct DB URL (used by Prisma CLI for migrations) |
| `JWT_SECRET` | `your_super_secret` | HMAC secret for JWT signing |
| `JWT_EXPIRES_IN` | `7d` | Token lifespan |
| `FRONTEND_URL` | `https://civic-connect.live` | CORS + Socket.IO `origin` allowlist |
| `MAX_FILE_SIZE` | `5242880` | Max upload size in bytes (5 MB) |
| `CLOUDINARY_CLOUD_NAME` | `du6617jyc` | Cloudinary account |
| `CLOUDINARY_API_KEY` | `313655...` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `NxW4a9...` | Cloudinary API secret |
| `GMAIL_USER` | `user@gmail.com` | Gmail SMTP sender |
| `GMAIL_APP_PASSWORD` | `kmyq...` | Gmail App Password (not account password) |

### Frontend (`frontend/.env`)

| Variable | Example | Description |
|---|---|---|
| `VITE_API_URL` | `https://api.civicconnect.live` | Backend API base URL. Leave **empty** for local dev (Vite proxy handles it) |

> **Important**: In local development, `VITE_API_URL` should be unset or empty. The Vite dev server proxies `/api` to `localhost:5001`. In production, set it to your deployed backend URL so all API calls (including CSV downloads) go to the correct server.

---

## 14. Local Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (or Supabase project for hosted Postgres)
- Cloudinary account
- Gmail account with App Password enabled

### Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# → Edit .env with your DATABASE_URL, JWT_SECRET, Cloudinary keys, Gmail credentials

# 3. Push schema to database
npm run db:push

# 4. (Optional) Open Prisma Studio
npm run db:studio

# 5. Start development server
npm run dev
# Server runs at http://localhost:5001
```

### Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Create env file (leave VITE_API_URL empty for local dev)
echo "" > .env

# 3. Start development server
npm run dev
# App runs at http://localhost:5173
# Vite proxy: /api → http://localhost:5001
```

### Creating Department & Municipal Accounts

Department and municipal accounts cannot self-register — they must be seeded or created via Prisma Studio:

```bash
# Open Prisma Studio
cd backend && npm run db:studio
```

1. Create a `Department` record linked to a `City`
2. Create a `User` with `role: "department"` and the correct `departmentId`
3. For municipal, create a `User` with `role: "municipal"` and a `cityId`

Alternatively, run the seed script if one is configured:
```bash
npm run db:seed
```

---

## 15. Deployment

### Backend — Docker / Railway / Render

The backend includes a `Dockerfile`:

```dockerfile
# Compiles TypeScript, runs node dist/server.js
```

Key steps for deployment:
1. Set all env vars in your hosting platform
2. Run `npm run build` (compiles TS to `dist/`)
3. Start with `npm start` (`node dist/server.js`)
4. Ensure `FRONTEND_URL` matches your deployed frontend domain for CORS

### Frontend — Vercel

1. Connect your GitHub repository to Vercel
2. Set the build command: `npm run build`
3. Set the output directory: `dist`
4. Add environment variable:
   - `VITE_API_URL` = `https://your-backend-domain.com`
5. Deploy

> **Critical**: `VITE_API_URL` **must** be set in Vercel. Without it, the frontend uses `window.location.origin` for API calls (which in production points to the Vercel frontend domain, not the backend). This causes all API calls including CSV downloads to fail silently.

### Database — Supabase

The schema is configured for Supabase Postgres with connection pooling:
- `DATABASE_URL` = pooled connection via PgBouncer (used at runtime)
- `DIRECT_URL` = direct connection (used by Prisma CLI for `migrate` / `db push`)

Run migrations in CI/CD:
```bash
npx prisma migrate deploy
```

---

*This document covers the complete system as of April 2026. For any changes to the schema, API, or features, update this document accordingly.*

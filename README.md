# Civic Lens ( live -> )

**Multi-City Civic Issue Reporting, Real-Time Resolution, and Incident Intelligence Platform**

> Simple. Transparent. Accountable. Powered by Google Gemma 4 AI.

Civic Lens bridges the gap between citizens and municipal authorities. Citizens report local infrastructure problems — potholes, garbage accumulation, water overflow, broken streetlights — with photo evidence and GPS location. Reports are automatically evaluated using **Gemma 4 AI Incident Intelligence**, routed to the correct government department, tracked transparently on an interactive map, and escalated automatically if left unresolved beyond 7 days.

---

## Problem Statement

Urban infrastructure maintenance in Indian cities suffers from a fundamental disconnect between citizens who observe problems daily and municipal authorities responsible for resolving them. Existing grievance systems are fragmented, offer no transparency, and have zero accountability mechanisms.

| Problem | Impact | Civic Lens Solution |
|---|---|---|
| No structured reporting channel | Citizens resort to social media with no tracking | Standardized multi-image + GPS reporting flow with live status updates |
| Duplicate & clustered complaints | Departments waste triage time on identical issues | **Gemma 4 AI Incident Intelligence** + PostGIS spatio-temporal clustering |
| No status transparency | Citizens cannot tell if their report was received or ignored | Real-time WebSocket event broadcasts for every state change |
| No escalation mechanism | Issues remain unresolved indefinitely | 7-day auto-escalation cron job + Citizen High-Alert Dispute E-Complaint |
| No proof of resolution | Departments close tickets without evidence | Mandatory photographic proof upload required before closing tickets |
| Fragmented municipal data | Administrators have no city-wide visibility | Unified Municipal Command Centre & AI Incident Review Workspace |

Civic Lens solves all of the above in a single platform with four isolated user roles — **Guest**, **Citizen**, **Department**, and **Municipal Administrator**.

---

## Google Gemma 4 AI Incident Intelligence

Civic Lens integrates **Google Gemma 4** (`gemma-4-it`) via the official `@google/genai` SDK to bring automated reasoning, root-cause synthesis, and duplicate incident detection to city administration.

```
Incoming Citizen Report (GPS, Photo, Description)
                     │
                     ▼
  Spatio-Temporal Candidate Retrieval (PostGIS / Radius Window)
                     │
                     ▼
  Chronological Timeline & Municipal Audit Assembly
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Google Gemma 4 AI Engine                    │
│                    Model: gemma-4-it                        │
│                                                             │
│  • Chronological Event Continuity Reasoning                 │
│  • Contradictory Evidence & Intervening Repair Detection    │
│  • Multi-Report Root-Cause Synthesis                        │
│  • Actionable Municipal Department Recommendations          │
└────────────────────────────┬────────────────────────────────┘
                             │ Strict Zod Structured Output
                             ▼
 ┌───────────────────────────────────────────────────────────┐
 │               Automated Decision Engine                   │
 │                                                           │
 │  [SAME_INCIDENT]   ── Identical ongoing defect            │
 │  [RELATED_INCIDENT]── Nearby distinct fault (separate fix)│
 │  [NEW_INCIDENT]    ── Independent issue                   │
 │  [NEEDS_REVIEW]    ── Ambiguous / Disputed / Flagged      │
 └───────────────────────────┬───────────────────────────────┘
                             │
                             ▼
   Municipal Intelligence Workspace & Human-in-the-Loop Review
```

### Key Gemma 4 Capabilities in Civic Lens:

1. **Chronological Incident Continuity Reasoning**:
   Rather than performing simple keyword or naive distance matching, Gemma 4 evaluates the **entire chronological lifecycle** of nearby tickets. It distinguishes between an ongoing defect, an adjacent but distinct problem, and a recurring issue at a previously repaired location.

2. **Root-Cause Synthesis & Domain Clustering**:
   When multiple citizens report problems across an urban corridor (e.g., surface waterlogging, sinkholes, and low water pressure), Gemma 4 analyzes the cluster to synthesize the single core physical root cause (e.g., *"Collapsed storm drain line at Sector 2 causing downstream water pooling"*).

3. **Actionable Suggestions for Municipal Officers**:
   Gemma 4 generates concrete civic recommendations (e.g., *"Dispatch drainage inspection crew to verify underground blockage before closing road surface ticket"*), guiding field engineers on ground action.

4. **Human-in-the-Loop Review Workspace**:
   If evidence is contradictory, borderline, or involves a disputed closed ticket, Gemma 4 classifies the report as `NEEDS_REVIEW`. Municipal administrators can review AI reasoning, inspect candidate histories side-by-side, and **Accept**, **Override**, or **Reject** the recommendation.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│              React + TypeScript  (Vite / SWC)               │
│         React Router v6  │  AuthContext  │  SocketContext    │
│     Leaflet Maps  │  Shadcn UI  │  Dynamic Metric Counters  │
└─────────────────┬───────────────────────────┬───────────────┘
                  │  HTTP / REST              │  WebSocket
                  ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend Layer                         │
│                  Node.js  +  Express.js API                  │
│       Middleware: Auth (JWT) │ RBAC │ City Isolation         │
│           Socket.IO Real-Time Event Broadcasting             │
│        Google Gemma 4 SDK (@google/genai) AI Pipeline        │
└─────────────────┬───────────────────────────┬───────────────┘
                  │  Prisma ORM               │  Signed URLs
                  ▼                           ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│       PostgreSQL           │   │         Cloudinary           │
│  (Supabase hosted)        │   │        (Image CDN)           │
│  PostGIS for geo queries  │   └─────────────────────────────┘
└───────────────────────────┘
```

**Key architectural decisions:**
- **City isolation is enforced at the middleware level** on every authenticated API route — not just the UI. A department user cannot query data from another city or department.
- **PostGIS & Spatial Candidate Indexing** power 20-metre to 50-metre radius candidate retrieval for incident evaluation.
- **Socket.IO rooms** (`city:<id>`, `user:<id>`, `department:<id>`) enable targeted real-time push to individual users, department staff, or city-wide municipal admins without unnecessary broadcast overhead.
- **Dynamic Real-Time Counters**: Citizen and municipal metric cards update instantly upon report registration and status transitions without requiring page refreshes.
- The **escalation cron job** runs daily and automatically flags any unresolved ticket older than 7 days, notifying the municipal admin — this cannot be suppressed by department staff.

---

## Deployment Architecture

```
  User Browser / Device
          │
          │ HTTPS
          ▼
┌─────────────────────┐
│   Netlify (Frontend) │   ← React app at civic-connect.live
│   Global CDN        │   ← Automated builds on push to main
└──────────┬──────────┘
           │ HTTPS API Calls
           ▼
┌─────────────────────────────────────────────────┐
│             Backend Infrastructure (AWS EC2)     │
│                                                  │
│   ┌──────────────────────────────────────────┐  │
│   │   Nginx Reverse Proxy (SSL Termination)  │  │
│   │         api.civic-connect.live           │  │
│   └────────────────────┬─────────────────────┘  │
│                        │                         │
│   ┌────────────────────▼─────────────────────┐  │
│   │           Docker Environment             │  │
│   │       Node.js + Express (TypeScript)     │  │
│   └──┬──────────┬──────────┬─────────────┬──┘  │
└──────┼──────────┼──────────┼─────────────┼──────┘
       │          │          │             │
       ▼          ▼          ▼             ▼
  Supabase   Cloudinary  Nodemailer    Google Gemma 4
 (PostgreSQL) (Images)   (Emails/OTP)   (Incident AI)

─────────────────────────────────────────────────
CI/CD Pipeline (GitHub Actions)

  Push to main
      │
      ▼
  Build & lint TypeScript
      │
      ▼
  Build Docker image → push to Docker Hub
      │
      ▼
  SSH into AWS EC2 → pull latest image → restart container
      │
      ▼
  Live in production — zero manual steps
─────────────────────────────────────────────────
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **AI / ML** | **Google Gemma 4 (`gemma-4-it`)**, `@google/genai` SDK, Zod Schema Validation |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui, Leaflet / React-Leaflet, Recharts |
| **Backend** | Node.js, Express.js, Socket.IO (WebSockets), node-cron, Nodemailer |
| **Database** | PostgreSQL (Supabase), Prisma ORM, PostGIS spatial extensions |
| **Image Storage** | Cloudinary CDN |
| **Authentication** | JWT (RS256), Email OTP via SMTP, Role-Based Access Control (RBAC) |
| **DevOps** | Docker, AWS EC2, Nginx reverse proxy, Netlify |
| **CI/CD** | GitHub Actions |

---

## Running Locally

### Prerequisites

- Node.js 18+
- npm
- A Supabase PostgreSQL project with PostGIS enabled
- A Cloudinary account
- A Gmail account with App Password (or custom SMTP)
- A Google AI Studio API Key for Gemma 4 ([https://aistudio.google.com/](https://aistudio.google.com/))

---

### Backend Setup

1. Clone the repository and navigate to the backend directory:

```bash
git clone https://github.com/subhadeepdasdgp675/CivicLens.git
cd CivicLens/backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the `backend/` root:

```dotenv
PORT=5001
NODE_ENV=development

# Supabase PostgreSQL connection strings
DATABASE_URL=postgresql://postgres.xxx:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# JWT Secret & Expiry
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Frontend CORS Origin
FRONTEND_URL=http://localhost:8080

# File Upload Limit (5 MB)
MAX_FILE_SIZE=5242880

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# SMTP Email / OTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM="Civic Lens" <your_email@gmail.com>

# Google Gemma 4 AI Configuration
GEMMA_API_KEY=your_google_ai_studio_api_key
GEMMA_MODEL=gemma-4-it
CIVICLENS_CONFIDENCE_THRESHOLD=0.80
CIVICLENS_RADIUS_METERS=50
CIVICLENS_MAX_CANDIDATES=5
CIVICLENS_AUTO_MERGE=false
```

4. Run Prisma migrations and seed demo data:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

5. Start the backend server:

```bash
npm run dev
```

The backend starts on `http://localhost:5001`.

---

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd ../frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in `frontend/`:

```dotenv
VITE_API_URL=http://localhost:5001
```

4. Start the frontend development server:

```bash
npm run dev
```

The frontend will start on `http://localhost:8080` (or `http://localhost:5173`).

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooled PostgreSQL connection string |
| `DIRECT_URL` | ✅ | Supabase direct PostgreSQL connection string (for migrations) |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | ✅ | Token expiry — default `7d` |
| `FRONTEND_URL` | ✅ | Allowed CORS origin |
| `MAX_FILE_SIZE` | ✅ | Max upload size in bytes — default `5242880` (5 MB) |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `GEMMA_API_KEY` | ✅ | Google AI Studio API Key for Gemma 4 |
| `GEMMA_MODEL` | ✅ | Model identifier (defaults to `gemma-4-it`) |
| `SMTP_USER` / `SMTP_PASS` | ⚠️ Optional | SMTP credentials for email delivery & live OTP |
| `VITE_API_URL` | Frontend | Backend API base URL |

---

## User Roles & Workflows

| Role | Access & Capabilities |
|---|---|
| **Guest** | Quick Report with GPS pin and evidence photo (no account creation required). |
| **Citizen** | Live Dashboard with dynamic counters, Multi-Image Evidence Upload, Leaflet Incident Map, Issue Details, Timeline Audits, Community Upvoting, and High-Alert Dispute E-Complaint filing. |
| **Department** | Dedicated Department Queue, Ticket Lifecycle Updates, Mandatory Proof of Resolution Upload, Performance Analytics. |
| **Municipal Administrator** | Multi-City Command Center, Escalations Queue, **Gemma 4 AI Incident Intelligence Workspace**, Review Queue, Domain Clusters, CSV Export. |

---

## Key Features

- **Google Gemma 4 AI Incident Intelligence**: Full timeline evaluation, multi-report root-cause synthesis, and automated triage suggestions.
- **Dynamic Real-Time Metric Counters**: Citizen and municipal counters update immediately upon registration and status changes via WebSockets.
- **Spatio-Temporal Clustering**: PostGIS-assisted vicinity clustering prevents duplicate municipal dispatches.
- **Mandatory Proof of Resolution**: Department staff cannot mark an issue resolved without uploading photographic ground proof.
- **Citizen Dispute & Escalation**: Citizens can dispute improper resolutions with high-alert municipal re-opening.
- **7-Day Automated Escalation**: Scheduled cron job automatically flags stale unaddressed tickets to senior municipal leadership.
- **Fast 1-Click Demo & OTP Access**: Includes one-click instant admin login and dual password/email-OTP authentication for testing.

---

## Demo Credentials

For quick evaluation and testing, see [`TEST_CREDENTIALS.md`](./TEST_CREDENTIALS.md):
- **1-Click Admin Access**: Click *"Login as Admin (1-Click)"* on the login screen.
- **Demo Citizen**: `citizen@civiclens.in` (password: `password123`)
- **Demo Municipal Admin**: `admin@pmc.gov.in` (password: `password123`)
- **Demo Departments**: `sanitation@pune.gov.in`, `roads@pune.gov.in`, `water@pune.gov.in` (password: `password123`)

---

## Author & Maintainer

**Subhadeep Das**  
Project: **Civic Lens**

---

## License

This project is licensed under the MIT License.

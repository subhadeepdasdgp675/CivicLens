# Civic Lens ( live-> https://civic-connect.live/ )

**Multi-City Civic Issue Reporting and Resolution Platform**

> Simple. Transparent. Accountable.

Civic Lens bridges the gap between citizens and municipal authorities. Citizens report local infrastructure problems — potholes, garbage accumulation, water overflow, broken streetlights — with photo evidence and GPS location. Reports are automatically routed to the correct government department, tracked transparently, and escalated automatically if left unresolved beyond 7 days.

---

## Problem Statement

Urban infrastructure maintenance in Indian cities suffers from a fundamental disconnect between citizens who observe problems daily and municipal authorities responsible for resolving them. Existing grievance systems are fragmented, offer no transparency, and have zero accountability mechanisms.

| Problem | Impact |
|---|---|
| No structured reporting channel | Citizens resort to social media with no tracking |
| Duplicate complaints | Departments waste triage time on the same issue |
| No status transparency | Citizens cannot tell if their report was received or ignored |
| No escalation mechanism | Issues remain unresolved indefinitely |
| No proof of resolution | Departments close tickets without evidence |
| Fragmented data | Administrators have no city-wide visibility |

Civic Lens solves all of the above in a single platform with four user roles — **Guest**, **Citizen**, **Department**, and **Municipal Administrator** — each with isolated, purpose-built workflows.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│              React + TypeScript  (Vite / SWC)               │
│         React Router v6  │  AuthContext  │  SocketContext    │
└─────────────────┬───────────────────────────┬───────────────┘
                  │  HTTP / REST              │  WebSocket
                  ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend Layer                         │
│                  Node.js  +  Express.js API                  │
│       Middleware: Auth (JWT) │ RBAC │ City Isolation         │
│                    Socket.IO  Real-Time Events               │
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
- City isolation is enforced at the **middleware level** on every authenticated API route — not just the UI. A department user cannot query data from another city or department.
- **PostGIS `ST_DWithin`** powers 20-metre radius duplicate detection. When a new issue matches an existing one by category within 20 metres, it is linked to the existing consolidated ticket rather than creating a new one.
- **Socket.IO rooms** (`user:<id>`) enable targeted real-time push to individual users, department staff, or city-wide municipal admins without broadcasting to everyone.
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
  Supabase   Cloudinary  Nodemailer   Geolocation
 (PostgreSQL) (Images)   (Emails)       API

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
| Frontend | React, TypeScript, Vite, Tailwind CSS, Shadcn/ui, Recharts |
| Backend | Node.js, Express.js, Socket.IO, node-cron, Nodemailer |
| Database | PostgreSQL (Supabase), Prisma ORM, PostGIS |
| Image Storage | Cloudinary |
| Auth | JWT (RS256), HTTP-only cookie |
| DevOps | Docker, AWS EC2, Nginx |
| CI/CD | GitHub Actions |
| Frontend Hosting | Netlify |

---

## Running Locally

### Prerequisites

- Node.js 18+
- npm
- A Supabase project with PostGIS enabled
- A Cloudinary account
- A Gmail account with App Password enabled

---

### Backend Setup

1. Clone the repository and navigate to the backend directory:

```bash
git clone https://github.com/SubhadeepDas/civic-lense.git
cd civic-lense/backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the backend root and fill in the values:

```dotenv
PORT=5001
NODE_ENV=development

# Supabase PostgreSQL connection strings
DATABASE_URL=
DIRECT_URL=

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=https://civic-connect.live

# File upload limit (5 MB in bytes)
MAX_FILE_SIZE=5242880

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Gmail SMTP (use App Password, not your account password)
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

4. Run Prisma migrations:

```bash
npx prisma migrate dev
npx prisma generate
```

5. Seed the database:

```bash
npx prisma db seed
```

6. Start the backend server:

```bash
npm run dev
```

The backend will start on `http://localhost:5001`.

---

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd civic-connect/frontend
```

2. Install dependencies:

```bash
npm install
```

3. For local development the API URL defaults to `localhost:5001`. If you need to point to a remote backend, create a `.env.production` file:

```dotenv
# Required for Vercel/Netlify deployment — also set this in the hosting dashboard
VITE_API_URL=https://your-backend-url.onrender.com
```

4. Start the frontend development server:

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`.

---

### Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooled connection string |
| `DIRECT_URL` | ✅ | Supabase direct connection string (for migrations) |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | ✅ | Token expiry — default `7d` |
| `FRONTEND_URL` | ✅ | Allowed CORS origin |
| `MAX_FILE_SIZE` | ✅ | Max upload size in bytes — default `5242880` (5 MB) |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `GMAIL_USER` | ⚠️ Optional | Gmail address for sending email alerts |
| `GMAIL_APP_PASSWORD` | ⚠️ Optional | Gmail App Password (not account password) |
| `VITE_API_URL` | Frontend only | Backend URL for production frontend deployment |

> **Note:** If `GMAIL_USER` and `GMAIL_APP_PASSWORD` are not set, the email notification service will fail silently. All other platform features will continue working normally.

---

## User Roles

| Role | Access |
|---|---|
| **Guest** | Landing page, Quick Report (email only, no account needed) |
| **Citizen** | Dashboard, Report Issue, Issue Detail, Search, Profile, Notifications |
| **Department** | Department Dashboard, Ticket Detail, Performance Analytics, Notifications |
| **Municipal Admin** | City Overview, Escalations, Department Performance, Reports & CSV Export |

---

## Key Features

- **20-metre duplicate detection** via PostGIS — same category issues within 20 metres are merged into one ticket
- **Mandatory proof upload** — departments cannot mark a ticket resolved without uploading a photo
- **7-day auto-escalation** — cron job flags all unresolved tickets older than 7 days and notifies the municipal admin
- **Real-time updates** — Socket.IO pushes status changes, comments, and escalations live to all relevant users
- **Guest reporting** — no account required; guest receives email updates on their issue
- **Role-isolated API** — city and department scoping enforced at middleware level on every route
- **CSV export** — municipal admins can export department-wise issue reports

---

## Author & Maintainer

**Subhadeep Das**  
Project: **Civic Lens**

---

## License

This project is licensed under the MIT License.


masterplan.md

CivicTrack is a multi-city civic issue reporting platform that empowers citizens to report local problems with a photo and location.
Issues are automatically routed to the correct city department, tracked transparently, escalated if ignored, and resolved with proof.

Simple. Transparent. Accountable.

⸻

Problem & Mission

The Problem
	•	Civic issues go unreported or ignored.
	•	Citizens don’t know which department to contact.
	•	No transparency on status.
	•	Duplicate complaints overwhelm departments.
	•	No structured escalation system.

The Mission

Make civic governance:
	•	📸 Easy to report
	•	🔍 Easy to track
	•	🏢 Automatically assigned
	•	🔁 Transparent and accountable
	•	⏱ Escalated if neglected

Build civic tech that feels calm, trustworthy, and kind — not bureaucratic.

⸻

Target Audience

Primary Users
	•	Urban citizens (18–60)
	•	Smartphone-first users
	•	People frustrated with local civic problems

Secondary Users
	•	City Departments (Garbage, Water, Roads, Police, etc.)
	•	Municipal Corporations (City-level Admin Authority)

⸻

User Roles

0️⃣ Guest Reporter (No Account)
	•	No login required
	•	Quick Report via email — photo + category + auto location
	•	Receives email updates when issue status changes (Ongoing / Resolved / Escalated)
	•	Cannot comment, upvote, or view dashboard

1️⃣ Citizen
	•	Login required
	•	Report issue (photo + category + auto location)
	•	View nearby issues
	•	Search by keyword or location
	•	Comment & upvote
	•	Track resolution progress

2️⃣ Department (City-Specific)
	•	View assigned consolidated tickets
	•	See duplicate reporter count
	•	Update status (Pending → Ongoing → Resolved)
	•	Upload proof photo before resolution
	•	Cannot access other cities

3️⃣ Municipal Corporation (City Admin)
	•	View all issues within their city
	•	See department performance
	•	Receive auto-escalations after 7 days
	•	Download city-level reports
	•	Cannot access other cities

⸻

Core Features

Guest Reporter Experience
	•	⚡ Quick Report — no account needed
	•	📧 Email-based tracking (status updates sent automatically)
	•	📸 Photo + location reporting
	•	Entry points: Navbar, QuickReportBanner (above "How It Works"), CTA section

Citizen Experience
	•	📸 Photo-based reporting
	•	📍 Auto-location detection
	•	🏷 Category selection (Garbage, Water, Potholes, etc.)
	•	🔎 Location & keyword search
	•	👍 Upvote & comment
	•	🔄 Real-time status updates
	•	🔔 Real-time notifications via WebSockets
	•	⭐ Impact Score tracking

Smart System Logic
	•	🌍 Auto city detection
	•	🏢 Auto department assignment
	•	🔁 Duplicate detection within ~20m + same category
	•	🎟 Single consolidated department ticket
	•	🔗 Resolution synced across duplicate posts
	•	⏱ 7-day automatic escalation

Department Dashboard
	•	Total issues count
	•	Pending / Ongoing / Resolved
	•	Duplicate reporter visibility
	•	Proof upload required for resolution

Municipal Dashboard
	•	All issues in city
	•	Department-wise breakdown
	•	Escalation tracking
	•	Downloadable reports (city-only)

⸻

High-Level Tech Stack (Strategic Fit)

Frontend
	•	Modern web framework (e.g., Next.js / React)
	•	Fast rendering
	•	Scalable multi-city support
	•	Clean UI control

Backend
	•	Node.js
	•	Strong API ecosystem
	•	Easy role-based logic
	•	Good background job handling
	•	Socket.io for real-time events

Database
	•	PostgreSQL
	•	Geolocation support (PostGIS)
	•	Ideal for 20m duplicate detection radius

Storage
	•	Cloud object storage (for images)
	•	Secure
	•	Scalable
	•	Fast CDN delivery

Background Jobs
	•	Cron/Queue system
	•	7-day escalation automation
	•	Notification triggers

⸻

Conceptual Data Model (ERD in Words)

User
	•	id
	•	role (Citizen / Department / Municipal)
	•	city_id
	•	department_id (nullable)
	•	email, password

City
	•	id
	•	name
	•	municipal_admin_id

Department
	•	id
	•	city_id
	•	category_type

Issue_Post (Citizen & Guest-facing)
	•	id
	•	user_id (nullable — null for guest reports)
	•	guest_email (nullable — set for guest reports)
	•	city_id
	•	category
	•	location (lat, lng)
	•	status
	•	consolidated_ticket_id

Consolidated_Ticket (Department-facing)
	•	id
	•	department_id
	•	status
	•	escalation_flag
	•	created_at

Comment
	•	id
	•	issue_post_id
	•	user_id
	•	image_optional
	•	text

⸻

UI Design Principles (Krug-Driven)

Don’t Make Me Think
	•	One primary CTA per screen
	•	Clear status badges (Pending / Ongoing / Resolved / Escalated)
	•	Large location clarity
	•	Obvious escalation timeline

Self-Evident

Example:
Instead of:
“Submit”

Use:
“Report Issue”

Calm Civic Trust
	•	Soft green primary
	•	Clean cards
	•	Friendly microcopy
	•	Clear visual hierarchy
	•	Generous whitespace

Feels like:
A responsible, modern civic companion.

⸻

Security & Compliance Notes
	•	Guest reports require valid email (regex-validated server-side)
	•	Guest endpoint rate-limited; no account data stored beyond email
	•	Role-based access control (strict city isolation)
	•	Secure image storage (signed URLs)
	•	Escalation logs (non-editable audit trail)
	•	Department resolution proof required
	•	No cross-city data visibility

⸻

Phased Roadmap

MVP (Single Platform, Multi-City Enabled)
	•	Citizen reporting
	•	Auto-assignment
	•	Duplicate detection
	•	Department dashboard
	•	7-day escalation
	•	Status tracking

V1 (Implemented)
	•	✅ Guest Quick Report (no login) with email status notifications
	•	✅ Email service via Nodemailer (Gmail SMTP)
	•	✅ In-app real-time notifications via Socket.io for all registered roles
	•	Advanced city analytics
	•	Department performance metrics
	•	Report export (CSV/PDF)

V2
	•	AI-based issue category suggestion from image
	•	Duplicate similarity via image matching
	•	SLA tracking per department
	•	Public transparency scorecards

⸻

Risks & Mitigations

Risk: False Duplicate Merging

Mitigation:
	•	Allow manual separation by department admin.

Risk: Departments ignore updates

Mitigation:
	•	Escalation automation.
	•	Municipal visibility dashboard.

Risk: Citizen misuse/spam

Mitigation:
	•	Mandatory login for full features.
	•	Guest reports require email validation.
	•	Rate limits on guest endpoint.
	•	Report moderation tools.

Risk: Political sensitivity

Mitigation:
	•	Neutral civic branding.
	•	Transparent audit logs.

⸻

Future Expansion Ideas
	•	Mobile app (native iOS/Android)
	•	AI damage severity scoring
	•	Public heatmap view
	•	Integration with city IoT sensors
	•	API for open data initiatives
	•	Reward system for active citizens

⸻


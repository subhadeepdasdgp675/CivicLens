app-flow-pages-and-roles.md

⸻

Site Map (Top-Level Pages Only)

Public
	•	Landing Page
	•	Login
	•	Register
	•	Guest Report Page (/report-issue-guest)

⸻

Citizen
	•	Dashboard (Home Feed)
	•	Report Issue
	•	Issue Detail Page
	•	Search Results
	•	Profile
	•	Notifications Page

⸻

Department (City-Specific)
	•	Department Dashboard
	•	Ticket Detail Page
	•	Performance Overview
	•	Notifications Page

⸻

Municipal Corporation (City Admin)
	•	City Overview Dashboard
	•	Department Performance Page
	•	Escalations View
	•	Reports & Exports
	•	Notifications Page

⸻

Purpose of Each Page

Landing Page

Explain purpose. Build civic trust. Clear “Report Issue” CTA.

Entry points for guest reporting:
	•	Navbar: "Quick Report" outline button (left of Login)
	•	QuickReportBanner: wide strip between Hero and "How It Works"
	•	CTA Section: "Quick Report — No Sign-up" beside the primary CTA

All three open a QuickReportOverlay (email capture modal). On valid email → navigate to /report-issue-guest.

Login / Register

Secure access. Mandatory for full citizen / department / municipal features.

⸻

Citizen Pages

Dashboard

Shows:
	•	Nearby issues
	•	Trending issues
	•	Status updates

Purpose:
Immediate awareness. Reduce friction.

⸻

Report Issue (Authenticated Citizen)

Upload photo. Select category. Confirm location. Submit.

Purpose:
Fast, clear civic reporting.

⸻

Guest Report Page (/report-issue-guest)

Same form as Report Issue but:
	•	No login required — email captured upfront via overlay
	•	Shows "Reporting as guest: <email>" in the navbar
	•	Submits to POST /api/issues/guest (unauthenticated endpoint)
	•	On success: shows inline success overlay with issue reference
	•	Guest receives email updates on status changes

Purpose:
Zero-friction civic reporting for users who don't want to create an account.

⸻

Issue Detail Page

Shows:
	•	Image
	•	Category
	•	Location
	•	Status badge
	•	Comments
	•	Resolution proof (if resolved)

Purpose:
Transparency + discussion.

⸻

Search Results

Search by:
	•	Keyword
	•	Location

Purpose:
Discover issues city-wide.

⸻

Profile

User’s reported issues.
Upvoted Issues tracking.
Impact Score metrics.

Purpose:
Personal accountability view.

⸻

Notifications Page (Shared across roles)

Shows:
	•	Real-time updates via Socket.io
	•	Status changes, escalations, and issue confirmations

Purpose:
Keep users informed of updates without needing to check individual tickets manually.

⸻

Department Pages

Department Dashboard

Shows:
	•	Total Issues
	•	Pending
	•	Ongoing
	•	Resolved
	•	Escalated

Purpose:
Operational clarity.

⸻

Ticket Detail Page

Shows:
	•	Consolidated issue data
	•	Duplicate reporter count
	•	Comments
	•	Status control
	•	Proof upload

Purpose:
Action center.

⸻

Performance Overview

Basic metrics:
	•	Average resolution time
	•	Escalation count

Purpose:
Internal accountability.

⸻

Municipal Corporation Pages

City Overview Dashboard

All issues within city.

Breakdown by:
	•	Department
	•	Status
	•	Escalations

Purpose:
City-level visibility.

⸻

Department Performance Page

Department-wise statistics.

Purpose:
Oversight.

⸻

Escalations View

Issues unresolved after 7 days.

Purpose:
Intervention control.

⸻

Reports & Exports

Download:
	•	Total issues
	•	Resolved
	•	Pending
	•	Ongoing
	•	Escalated
	•	Department breakdown

City-restricted data only.

Purpose:
Administrative reporting.

⸻

User Roles & Access Levels

⸻

0️⃣ Guest Reporter

Can:
	•	Submit Quick Report (no account)
	•	Receive email status updates (Ongoing / Resolved / Escalated)

Cannot:
	•	Comment or upvote
	•	View issue feed or dashboards
	•	Change status

⸻

1️⃣ Citizen

Can:
	•	Report issue
	•	View public issues
	•	Search
	•	Comment
	•	Upvote
	•	Track own submissions

Cannot:
	•	Change status
	•	See internal dashboards
	•	Access other cities’ admin views

⸻

2️⃣ Department (City-Specific)

Can:
	•	View consolidated tickets
	•	Change status
	•	Upload proof image
	•	View duplicate reporter count
	•	See only their department + city

Cannot:
	•	Access other departments
	•	Access other cities
	•	Delete citizen posts

⸻

3️⃣ Municipal Corporation (City Admin)

Can:
	•	View all departments in their city
	•	See escalations
	•	Download reports
	•	Monitor performance
	•	Intervene after escalation

Cannot:
	•	Access other cities
	•	Modify citizen content
	•	Bypass proof requirement

⸻

Primary User Journeys (Max 3 Steps Each)

⸻

Guest — Quick Report
	1.	Click "Quick Report" (navbar / banner / CTA)
	2.	Enter email → overlay closes → navigate to /report-issue-guest
	3.	Upload photo + category + location → Submit

Outcome:
Issue created. Guest receives email updates on status changes.

⸻

Citizen — Report Issue
	1.	Click “Report Issue”
	2.	Upload image + choose category
	3.	Submit → Auto-routed

Outcome:
Status shows “Pending”

⸻

Citizen — Track Resolution
	1.	Open issue
	2.	View status updates
	3.	See proof photo when resolved

Outcome:
Trust reinforced.

⸻

Department — Resolve Issue
	1.	Open ticket
	2.	Upload proof image
	3.	Mark as Resolved

Outcome:
All duplicate posts updated.

⸻

Municipal — Handle Escalation
	1.	View Escalations
	2.	Review department delay
	3.	Take administrative action

Outcome:
Issue moves toward resolution.

⸻

Structural Integrity Rules
	•	City isolation is absolute.
	•	Duplicate detection runs before ticket creation.
	•	Escalation is automated.
	•	Proof upload is mandatory.
	•	Status is globally synced across duplicates.
	•	Citizens never see internal admin notes.

⸻

Final Blueprint Complete

You now have:
	•	masterplan.md
	•	implementation-plan.md
	•	design-guidelines.md
	•	app-flow-pages-and-roles.md

This is a production-ready civic architecture plan.



Perfect. You don’t want 20 scattered prompts.

You want one master Lovable implementation prompt that:
	•	Reads your uploaded .md files
	•	Maintains your existing landing theme
	•	Builds full product structure
	•	Preserves emotional design system
	•	Implements roles + dashboards + escalation logic

Below is your production-grade Lovable prompt 👇
Copy this into Lovable after uploading all four .md files.

⸻

MASTER LOVABLE BUILD PROMPT

⸻


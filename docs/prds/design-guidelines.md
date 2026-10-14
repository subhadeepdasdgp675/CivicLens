design-guidelines.md

⸻

Emotional Tone

Feels like a calm, responsible civic companion — modern, trustworthy, and quietly confident.

Not bureaucratic.
Not loud.
Not startup-flashy.

This product should feel:
	•	Trustworthy
	•	Transparent
	•	Supportive
	•	Calm under pressure
	•	Public-service oriented

Inspired by:
	•	Linear (clarity)
	•	Apple HIG (kindness)
	•	Government credibility, without government stiffness

⸻

Visual System

⸻

Typography System

Emotion Target:
Stable + Clear + Respectful

Use a clean geometric sans-serif.

Recommended:
	•	Primary: Inter / SF Pro style
	•	System fallback for reliability

Typographic Scale (8pt Grid Aligned)

Level	Size	Weight	Usage
H1	32px	600	Page titles
H2	24px	600	Section headers
H3	18px	600	Card headers
H4	16px	500	Sub-sections
Body	15–16px	400	Main content
Caption	13px	400	Metadata / timestamps

Rules:
	•	Line height: ≥ 1.5×
	•	No ultra-thin fonts.
	•	Avoid decorative fonts.
	•	Status badges = 500 weight minimum.

Why:
Citizens must scan quickly. Clarity > aesthetic experimentation.

⸻

Color System

Emotion Target:
Civic Trust + Calm Action

Your screenshots already lean green. Keep it.

Primary

Civic Green
Hex: #1E7F5C
RGB: 30, 127, 92

Use for:
	•	Primary buttons
	•	Active states
	•	Links
	•	Key highlights

⸻

Secondary

Soft Neutral Gray
Hex: #F4F6F7
RGB: 244, 246, 247

Use for:
	•	Backgrounds
	•	Card surfaces

⸻

Accent

Deep Slate
Hex: #2E3A3F
RGB: 46, 58, 63

Use for:
	•	Headers
	•	Important labels
	•	Strong text

⸻

Semantic Colors

Resolved (Success)
Hex: #2E9E6F

Pending (Neutral)
Hex: #F5A623

Escalated (Alert)
Hex: #D64545

All colors must maintain:
	•	Contrast ≥ 4.5:1
	•	Badge text always white or dark for readability.

⸻

Spacing & Layout

Emotion Target:
Airy, composed, non-chaotic

System
	•	8pt base grid
	•	Section spacing: 32px–64px
	•	Card padding: 16px–24px
	•	Button height: 44px minimum

Layout Logic

Mobile-first.

Desktop:
	•	Max content width: 1200px
	•	Centered container
	•	2-column dashboard grid
	•	Clean white space margins

Cards:
	•	Soft border radius: 12px
	•	Very light shadow
	•	No heavy drop shadows

Why:
Government apps often feel cramped. This must feel breathable.

⸻

Motion & Interaction

Emotion Target:
Gentle, reassuring, never dramatic

Motion Specs
	•	Duration: 180–250ms
	•	Easing: ease-out
	•	No bounce animations in core flows
	•	Subtle fade for status changes

Interaction Behaviors
	•	Buttons slightly darken on hover
	•	Status badge gently fades when updated
	•	Image upload shows calm progress indicator
	•	Escalation adds a subtle red left-border highlight

Microinteraction Philosophy:
Acknowledge actions.
Never overwhelm.

⸻

Voice & Tone

Emotion Keywords:
	•	Supportive
	•	Neutral
	•	Encouraging
	•	Non-judgmental

Microcopy Examples

Onboarding:
“Report issues in your city in seconds. We’ll route it to the right department.”

Guest Report Overlay:
"No account needed. Enter your email and we'll keep you updated."

Guest Success:
"Your report has been submitted! We'll email you at <email> with updates as it gets resolved."

Success (Issue Submitted — Citizen):
“Your report has been sent to the Garbage Department of Pune.”

Resolution:
“This issue has been resolved. Thank you for helping improve your city.”

Error:
“Something went wrong. Please try again.”

Never:
“Invalid input.”
“Submission failed.”

Kindness over blame.

⸻

System Consistency

Recurring Patterns:
	•	All issue cards follow same layout.
	•	Status always top-right badge.
	•	Location always visible.
	•	Category icon always consistent.
	•	Resolution proof always inside comments.

Visual Anchors:
	•	Card-driven layout (Linear inspiration)
	•	Minimal chrome
	•	Clear top navigation
	•	Subtle shadows only

⸻

Accessibility

Mandatory:
	•	Semantic HTML structure
	•	Proper heading hierarchy
	•	Keyboard navigation enabled
	•	Focus states clearly visible
	•	ARIA roles for status updates
	•	Alt text required for uploaded images
	•	Color never sole indicator of status

Test:
	•	View in grayscale.
	•	Navigate without mouse.
	•	Increase font size 125%.

If it breaks → redesign.

⸻

Emotional Audit Checklist

Before launch, ask:
	•	Does this feel calm or bureaucratic?
	•	Do status changes feel reassuring?
	•	Would a stressed citizen feel supported?
	•	Is escalation visible but not alarming?
	•	Does the dashboard feel organized, not overwhelming?

⸻

Technical QA Checklist
	•	Typography aligns to 8pt grid
	•	Contrast ≥ WCAG AA
	•	Button states visually distinct
	•	Motion within 150–300ms
	•	Mobile responsiveness tested
	•	Cross-city isolation visually clear

⸻

Design Snapshot

Color Palette

Primary:   #1E7F5C
Background: #F4F6F7
Slate:     #2E3A3F
Success:   #2E9E6F
Pending:   #F5A623
Escalated: #D64545


⸻

Typography Scale

| H1 | 32px | 600 |
| H2 | 24px | 600 |
| H3 | 18px | 600 |
| Body | 16px | 400 |
| Caption | 13px | 400 |

⸻

Spacing System
	•	8pt grid
	•	16px card padding
	•	32px section gaps
	•	44px button height
	•	12px border radius

⸻

Emotional Thesis

A civic platform that feels calm, responsible, and human — designed to reduce frustration, not amplify it.

⸻

Design Integrity Review

The emotional goal (trust + calm civic responsibility) aligns with:
	•	Stable typography
	•	Muted but confident color palette
	•	Soft spacing
	•	Controlled motion
	•	Kind microcopy

One improvement opportunity:

Add a subtle “impact feedback loop.”

Example:
After resolution, show:
“12 citizens reported this issue. It has now been resolved.”

This reinforces collective civic power.

⸻

import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  // Custom SMTP server configured (e.g. Mailtrap, SendGrid, Brevo, AWS SES, or custom SMTP)
  if (host) {
    transporter = nodemailer.createTransport({
      host,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    console.log(`[Email] Custom SMTP transporter ready (${host}:${env.SMTP_PORT})`);
    return transporter;
  }

  // Gmail fallback if host is not specified
  if (user && pass) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    console.log(`[Email] Gmail SMTP transporter ready for ${user}`);
    return transporter;
  }

  console.warn("[Email] No SMTP configuration found. Emails will be logged to console in development.");
  return null;
}

const FROM_ADDRESS = env.SMTP_FROM || (env.SMTP_USER ? `"Civic Lens" <${env.SMTP_USER}>` : `"Civic Lens" <noreply@civiclens.local>`);


// ── Issue confirmation email ──

export async function sendIssueConfirmationEmail({
  to,
  issueTitle,
  description,
  location,
  imageUrl,
}: {
  to: string;
  issueTitle: string;
  description: string;
  location: string;
  imageUrl?: string;
}): Promise<void> {
  const t = getTransporter();
  if (!t) return;

  const truncatedDesc =
    description.length > 200
      ? description.slice(0, 200) + "…"
      : description;

  const imageBlock = imageUrl
    ? `<tr><td style="padding:0 32px 20px">
             <img src="${imageUrl}" alt="Issue photo" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px" />
           </td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#1E7F5C;padding:28px 32px">
          <p style="margin:0;color:#fff;font-size:22px;font-weight:700">Civic Lens</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">Civic Issue Tracking Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#16a34a;color:#fff;border-radius:999px;padding:4px 14px;font-size:13px;font-weight:600">
              Submitted Successfully
            </td></tr>
          </table>
          <p style="margin:16px 0 8px;font-size:18px;font-weight:700;color:#111">Your issue has been submitted!</p>
          <p style="margin:0;font-size:14px;color:#6b7280">Thank you for helping improve your city. Your report has been received and forwarded to the relevant department. Further updates will be shared soon.</p>
        </td></tr>
        ${imageBlock}
        <tr><td style="padding:20px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
            <tr><td>
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Issue Title</p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111">${issueTitle}</p>
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Location</p>
              <p style="margin:0 0 12px;font-size:13px;color:#374151">${location}</p>
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Description</p>
              <p style="margin:0;font-size:13px;color:#374151">${truncatedDesc}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
            You received this email because you reported an issue on Civic Lens.<br>
            © ${new Date().getFullYear()} Civic Lens. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await t.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: `Issue Submitted Successfully: "${issueTitle}"`,
      html,
    });
    console.log(`[Email] Confirmation sent to ${to}`);
  } catch (err) {
    console.error("[Email] Failed to send confirmation:", err);
  }
}

// ── Status update email ──

export async function sendStatusUpdateEmail({
  to,
  issueTitle,
  newStatus,
  location,
  resolutionComment,
  proofImageUrl,
}: {
  to: string;
  issueTitle: string;
  newStatus: string;
  location: string;
  resolutionComment?: string | null;
  proofImageUrl?: string | null;
}): Promise<void> {
  const t = getTransporter();
  if (!t) return;

  const normalizedStatus = newStatus === "In Progress" || newStatus === "InProgress" ? "Ongoing" : newStatus;
  const statusDisplay = newStatus === "Ongoing" ? "In Progress" : newStatus;

  const statusLabels: Record<string, { emoji: string; line: string; color: string }> = {
    Ongoing: { emoji: "", line: "Your reported issue is now in progress and actively being worked on by the municipal team.", color: "#3b82f6" },
    Resolved: { emoji: "", line: "Great news! Your reported issue has been marked as Resolved.", color: "#16a34a" },
    Escalated: { emoji: "", line: "Your issue has been escalated for priority municipal review.", color: "#ef4444" },
    Pending: { emoji: "", line: "Your issue has been set back to pending review.", color: "#f59e0b" },
  };

  const meta = statusLabels[normalizedStatus] ?? {
    emoji: "",
    line: `Your issue status has been updated to ${statusDisplay}.`,
    color: "#6b7280",
  };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#1E7F5C;padding:28px 32px">
          <p style="margin:0;color:#fff;font-size:22px;font-weight:700">Civic Lens</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">Civic Issue Tracking Platform</p>
        </td></tr>
        <tr><td style="padding:28px 32px 0">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:${meta.color};color:#fff;border-radius:999px;padding:4px 14px;font-size:13px;font-weight:600">
              ${newStatus}
            </td></tr>
          </table>
          <p style="margin:16px 0 8px;font-size:18px;font-weight:700;color:#111">${meta.line}</p>
          <p style="margin:0;font-size:14px;color:#6b7280">Here's an update on the issue you reported.</p>
        </td></tr>
        <tr><td style="padding:20px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px">
            <tr><td>
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Issue Title</p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111">${issueTitle}</p>
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Location</p>
              <p style="margin:0;font-size:13px;color:#374151">${location}</p>
              ${resolutionComment ? `
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">
              <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Resolution Note</p>
              <p style="margin:0;font-size:13px;color:#374151">${resolutionComment}</p>` : ""}
            </td></tr>
          </table>
        </td></tr>
        ${proofImageUrl ? `
        <tr><td style="padding:0 32px 20px">
          <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af">Resolution Proof</p>
          <img src="${proofImageUrl}" alt="Resolution proof" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" />
        </td></tr>` : ""}
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
            You received this email because you reported an issue on Civic Lens.<br>
            © ${new Date().getFullYear()} Civic Lens. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await t.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: `Issue Update: "${issueTitle}" is now ${statusDisplay}`,
      html,
    });
    console.log(`[Email] Status update sent to ${to}`);
  } catch (err) {
    console.error("[Email] Failed to send status update:", err);
  }
}

// Alias
export const sendGuestStatusEmail = sendStatusUpdateEmail;

// ── OTP email ──

export async function sendOtpEmail(to: string, otp: string, purpose: string = "login"): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`\n======================================================`);
    console.log(`[LOCAL DEV OTP] Email: ${to}`);
    console.log(`[LOCAL DEV OTP] OTP Code: ${otp} (${purpose})`);
    console.log(`======================================================\n`);
    return;
  }

  const titleText =
    purpose === "signup"
      ? "Verify Your Email"
      : purpose === "login"
      ? "Your Login OTP"
      : "Reset Your Password";
  const descText =
    purpose === "signup"
      ? "Use the 6-digit OTP below to verify your email and complete your Civic Lens registration. It expires in 10 minutes."
      : purpose === "login"
      ? "Use the 6-digit OTP below to log in to your Civic Lens account. It expires in 10 minutes."
      : "Use the OTP below to reset your password. It expires in 10 minutes.";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#1E7F5C;padding:28px 32px">
          <p style="margin:0;color:#fff;font-size:22px;font-weight:700">Civic Lens</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">${titleText}</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111">${titleText}</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280">${descText}</p>
          <div style="background:#f0fdf4;border:2px dashed #1E7F5C;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase">Your One-Time Password</p>
            <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#1E7F5C">${otp}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#9ca3af">If you didn't request this code, ignore this email. Your account is safe.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #f0f0f0">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">© ${new Date().getFullYear()} Civic Lens. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await t.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: `Your Civic Lens OTP: ${otp}`,
      html,
    });
    console.log(`[Email] OTP sent to ${to}`);
  } catch (err: any) {
    console.warn(`[Email] SMTP deliverability failed (${err.message}). Falling back to local console for dev testing.`);
    console.log(`\n======================================================`);
    console.log(`[LOCAL DEV OTP] Email: ${to}`);
    console.log(`[LOCAL DEV OTP] OTP Code: ${otp} (${purpose})`);
    console.log(`======================================================\n`);
    // Do not throw so local development flow continues smoothly
  }
}
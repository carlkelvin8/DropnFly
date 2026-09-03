import nodemailer from "nodemailer";
import { getSystemSettings, setting } from "./settings";

interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo: string;
  companyName: string;
}

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function getEmailConfig(): Promise<EmailConfig> {
  const map = await getSystemSettings();
  const enabled = setting(map, "email_notifications_enabled", "true") !== "false";
  const host = setting(map, "smtp_host", "") || process.env.SMTP_HOST || "smtp.ethereal.email";
  const port = parseInt(setting(map, "smtp_port", process.env.SMTP_PORT || "587"));
  const fromAddress = setting(map, "smtp_from", "") || process.env.SMTP_FROM || "noreply@dropnfly.ph";
  const senderName = setting(map, "email_sender_name", "Dropnfly").replace(/[\r\n"]/g, "").trim() || "Dropnfly";
  const from = fromAddress.includes("<") ? fromAddress : `"${senderName}" <${fromAddress}>`;
  const replyTo = setting(map, "email_reply_to", "") || undefined;
  const companyName = setting(map, "email_company_name", "Dropnfly Logistics Inc.").replace(/[\r\n]/g, "").trim() || "Dropnfly Logistics Inc.";
  return {
    enabled,
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from,
    replyTo: replyTo || fromAddress,
    companyName,
  };
}

async function getTransporter() {
  const config = await getEmailConfig();
  if (!config.user || !config.pass) {
    throw new Error("SMTP is not configured. Set SMTP_USER and SMTP_PASS.");
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  }, { from: config.from, replyTo: config.replyTo });
}

export async function verifyConfirmationEmailService(): Promise<void> {
  const transporter = await getTransporter();
  await transporter.verify();
}

export async function sendCustomerActivationEmail({ to, customerName, token }: { to: string; customerName: string; token: string }) {
  const config = await getEmailConfig();
  if (!config.enabled) throw new Error("Email notifications are disabled");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const activationUrl = `${baseUrl}/my-account/activate?token=${encodeURIComponent(token)}`;
  const safeName = customerName.replace(/[<>&"']/g, "");
  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject: "Activate your DropnFly account",
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Activate your account</h2><p>Hi ${safeName},</p><p>Confirm this email address to securely activate your DropnFly account. This link expires in 30 minutes.</p><p><a href="${activationUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">Activate account</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
  });
}

export async function sendPasswordResetEmail({ to, token }: { to: string; token: string }) {
  const config = await getEmailConfig();
  if (!config.enabled) throw new Error("Email notifications are disabled");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject: "Reset your DropnFly password",
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Reset your password</h2><p>This single-use link expires in one hour.</p><p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">Reset password</a></p><p>If you did not request this, ignore this email.</p></div>`,
  });
}

export async function sendConfirmationEmail({
  to,
  customerName,
  referenceNumber,
  qrCodeBase64,
  pickupLocation,
  dropOffLocation,
  scheduledDate,
  numberOfBags,
  totalPrice,
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  qrCodeBase64: string;
  pickupLocation: string;
  dropOffLocation: string;
  scheduledDate: string;
  numberOfBags: number;
  totalPrice: number;
}): Promise<boolean> {
  const config = await getEmailConfig();
  // Booking confirmations are transactional receipts and are always required.
  // General notification preferences only apply to optional notification emails.

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ea7d3d; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${sanitizeHtml(customerName)}</strong>,</p>
        <p>Your luggage pickup has been scheduled successfully.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; color: #9ca3af;">Pickup Location</td>
            <td style="padding: 8px; font-weight: 600;">${sanitizeHtml(pickupLocation)}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; color: #9ca3af;">Drop-off Location</td>
            <td style="padding: 8px; font-weight: 600;">${sanitizeHtml(dropOffLocation)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #9ca3af;">Scheduled Date</td>
            <td style="padding: 8px; font-weight: 600;">${sanitizeHtml(scheduledDate)}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; color: #9ca3af;">Number of Bags</td>
            <td style="padding: 8px; font-weight: 600;">${numberOfBags}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #9ca3af;">Booking Total</td>
            <td style="padding: 8px; font-weight: 700; color: #166534;">₱${totalPrice.toFixed(2)}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <p style="color: #9ca3af; margin-bottom: 12px;">Scan this QR code to track your luggage:</p>
          <img src="cid:booking-qr" alt="QR Code" style="width: 180px; height: 180px;" />
        </div>

        <p style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/track"
             style="display: inline-block; background: #ea7d3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Track Your Luggage
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #d1d5db; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          ${sanitizeHtml(config.companyName)} &bull; Reference: ${referenceNumber}
        </p>
      </div>
    </div>
  `;

  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject: `Booking Confirmed - ${referenceNumber}`,
    html,
    attachments: [{
      filename: `${referenceNumber}-qr.png`,
      content: Buffer.from(qrCodeBase64, "base64"),
      cid: "booking-qr",
    }],
  });
  return true;
}

export async function sendRiderAssignedEmail({
  to,
  customerName,
  referenceNumber,
  riderName,
  riderProfilePic,
  vehicleType,
  plateNumber,
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  riderName: string;
  riderProfilePic?: string | null;
  vehicleType?: string | null;
  plateNumber?: string | null;
}) {
  const config = await getEmailConfig();
  const settings = await getSystemSettings();
  if (!config.enabled || setting(settings, "rider_assignment_email", "true") === "false") {
    if (process.env.NODE_ENV === "development") {
      console.warn("[EMAIL] Email notifications are disabled in settings");
    }
    return;
  }
  const profilePicUrl =
    riderProfilePic && (riderProfilePic.startsWith("https://") || riderProfilePic.startsWith("data:image/"))
      ? riderProfilePic
      : null;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #ea7d3d; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Rider Assigned!</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${sanitizeHtml(customerName)}</strong>,</p>
        <p>A rider has been assigned to your booking. Here are the details:</p>

        <div style="text-align: center; margin: 24px 0;">
          ${profilePicUrl ? `<img src="${profilePicUrl}" alt="${sanitizeHtml(riderName)}" style="width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 3px solid #ea7d3d;" />` : `<div style="width: 96px; height: 96px; border-radius: 50%; background: #ea7d3d; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; border: 3px solid #e3f0fb;">${sanitizeHtml(riderName.charAt(0))}</div>`}
          <h3 style="margin: 12px 0 4px;">${sanitizeHtml(riderName)}</h3>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${vehicleType ? `<tr><td style="padding: 8px; color: #9ca3af;">Vehicle</td><td style="padding: 8px; font-weight: 600;">${sanitizeHtml(vehicleType)}</td></tr>` : ""}
          ${plateNumber ? `<tr style="background: #f1f5f9;"><td style="padding: 8px; color: #9ca3af;">Plate Number</td><td style="padding: 8px; font-weight: 600;">${sanitizeHtml(plateNumber)}</td></tr>` : ""}
        </table>

        <p style="text-align: center; margin-top: 24px;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/track/${referenceNumber}"
             style="display: inline-block; background: #ea7d3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Track Your Luggage
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #d1d5db; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          ${sanitizeHtml(config.companyName)} &bull; Reference: ${referenceNumber}
        </p>
      </div>
    </div>
  `;

  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject: `Rider Assigned - ${referenceNumber}`,
    html,
  });
}

export async function sendIncidentEmail({  to,
  customerName,
  referenceNumber,
  incidentType,
  status,
  resolution,
  siteUrl,
  incidentId,
  description,
  submittedAt,
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  incidentType: string;
  status: string;
  resolution?: string | null;
  incidentId: string;
  siteUrl?: string;
  description?: string | null;
  submittedAt?: Date | string | null;
}) {
  const baseUrl = siteUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const trackUrl = `${baseUrl}/track/${referenceNumber}`;
  const typeLabel = incidentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const trackingNumber = `INC-${incidentId.slice(0, 8).toUpperCase()}`;

  const config = await getEmailConfig();
  if (!config.enabled) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[EMAIL] Email notifications are disabled in settings");
    }
    return;
  }

  let statusSection = "";
  if (status === "PENDING") {
    statusSection = `<p>Your report has been received and is pending review. Our team will investigate and get back to you shortly.</p>`;
  } else if (status === "INVESTIGATING") {
    statusSection = `<p>Your report is now being <strong>investigated by our Dropnfly team</strong>. We are actively looking into the matter and will keep you updated on the progress.</p>`;
  } else if (status === "RESOLVED") {
    statusSection = `
      <p>Your report has been <strong style="color: #16a34a;">resolved</strong>.</p>
      ${resolution ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #166534;"><strong>Resolution:</strong></p>
        <p style="margin: 8px 0 0; color: #166534;">${sanitizeHtml(resolution)}</p>
      </div>` : ""}
    `;
  } else if (status === "CLOSED") {
    statusSection = `<p>This report has been closed. Thank you for your patience.</p>`;
  }

  const detailsBlock = `
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; color: #991b1b;"><strong>Incident Tracking Number:</strong> ${trackingNumber}</p>
      <p style="margin: 8px 0 0; color: #991b1b;"><strong>Booking Reference:</strong> ${sanitizeHtml(referenceNumber)}</p>
      <p style="margin: 8px 0 0; color: #991b1b;"><strong>Status:</strong> ${status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
      <p style="margin: 8px 0 0; color: #991b1b;"><strong>Type:</strong> ${sanitizeHtml(typeLabel)}</p>
      ${submittedAt ? `<p style="margin: 8px 0 0; color: #7f1d1d;"><strong>Submitted:</strong> ${new Date(submittedAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p>` : ""}
      ${description ? `<p style="margin: 8px 0 0; color: #7f1d1d;"><strong>Report Details:</strong> ${sanitizeHtml(description)}</p>` : ""}
    </div>
  `;

  const subjectPrefix = status === "PENDING" ? "Incident Report Received" : "Incident Report Update";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${status === "PENDING" ? "Incident Report Received" : "Incident Report Update"}</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong> &bull; Tracking: <strong>${trackingNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${sanitizeHtml(customerName)}</strong>,</p>
        <p>${status === "PENDING" ? `Thank you for submitting your <strong>${typeLabel}</strong> report. Here are your report details for tracking:` : `There has been an update on your <strong>${typeLabel}</strong> report from our investigation team.`}</p>

        ${detailsBlock}

        ${statusSection}

        <p style="text-align: center; margin-top: 24px;">
          <a href="${trackUrl}"
             style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            ${status === "PENDING" ? "Track Your Report" : "View Investigation Update"}
          </a>
        </p>

        <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">You will continue to receive emails from our investigation team as the status changes (Pending → Investigating → Resolved/Closed). Keep your tracking number <strong>${trackingNumber}</strong> safe.</p>

        <hr style="border: none; border-top: 1px solid #d1d5db; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Dropnfly &bull; Reference: ${referenceNumber} &bull; Tracking: ${trackingNumber}
        </p>
      </div>
    </div>
  `;

  const subject = status === "PENDING"
    ? `Incident Report Received - ${referenceNumber} [${trackingNumber}]`
    : `Incident Report Update - ${referenceNumber} [${trackingNumber}]`;
  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject,
    html,
  });
}

export async function sendPaymentConfirmationEmail({
  to,
  customerName,
  referenceNumber,
  amount,
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  amount: number;
}) {
  const config = await getEmailConfig();
  if (!config.enabled) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[EMAIL] Email notifications are disabled in settings");
    }
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Payment Confirmed</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${sanitizeHtml(customerName)}</strong>,</p>
        <p>We have received your payment of <strong style="color: #16a34a;">₱${amount.toFixed(2)}</strong> for booking <strong>${referenceNumber}</strong>. Thank you!</p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/track/${referenceNumber}"
             style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Track Your Luggage
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #d1d5db; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Dropnfly &bull; Reference: ${referenceNumber}
        </p>
      </div>
    </div>
  `;

  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject: `Payment Confirmed - ${referenceNumber}`,
    html,
  });
}

export async function sendReceiptEmail({
  to,
  customerName,
  referenceNumber,
  pickupLocation,
  dropOffLocation,
  numberOfBags,
  totalPrice,
  createdAt,
  customerEmail,
  customerPhone,
  status,
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  pickupLocation: string;
  dropOffLocation: string;
  numberOfBags: number;
  totalPrice: number;
  createdAt: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
}) {
  const config = await getEmailConfig();
  if (!config.enabled) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[EMAIL] Email notifications are disabled in settings");
    }
    return false;
  }

  const formattedDate = new Date(createdAt).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const safeStatus = status.replace(/_/g, " ");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #f97316, #2563eb); color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Dropnfly</h2>
        <p style="margin: 4px 0 0; opacity: 0.9;">Luggage Storage &amp; Delivery</p>
        <p style="margin: 0; opacity: 0.9;">Metro Manila, Philippines</p>
      </div>
      <div style="padding: 24px;">
        <div style="background: #eff6ff; padding: 16px; text-align: center; border-radius: 8px;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">RECEIPT</p>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 700; letter-spacing: 1px;">${referenceNumber}</p>
        </div>
        <table style="width: 100%; margin-top: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Customer</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 500;">${sanitizeHtml(customerName)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Email</td>
            <td style="padding: 4px 0; text-align: right;">${sanitizeHtml(customerEmail)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Phone</td>
            <td style="padding: 4px 0; text-align: right;">${sanitizeHtml(customerPhone)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Date</td>
            <td style="padding: 4px 0; text-align: right;">${sanitizeHtml(formattedDate)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Status</td>
            <td style="padding: 4px 0; text-align: right; text-transform: capitalize;">${sanitizeHtml(safeStatus)}</td>
          </tr>
        </table>
        <table style="width: 100%; margin-top: 20px; font-size: 14px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #d1d5db; text-align: left; color: #6b7280;">
              <th style="padding: 8px 0;">Service</th>
              <th style="padding: 8px 0; text-align: right;">Qty</th>
              <th style="padding: 8px 0; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0;">
                <strong>Luggage Storage</strong>
                <div style="font-size: 12px; color: #6b7280;">${sanitizeHtml(pickupLocation)} &rarr; ${sanitizeHtml(dropOffLocation)}</div>
              </td>
              <td style="padding: 12px 0; text-align: right;">${numberOfBags}</td>
              <td style="padding: 12px 0; text-align: right;">&#8369;${totalPrice.toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="font-weight: 700;">
              <td style="padding: 12px 0;">Total</td>
              <td style="padding: 12px 0; text-align: right;">${numberOfBags}</td>
              <td style="padding: 12px 0; text-align: right;">&#8369;${totalPrice.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">Thank you for choosing Dropnfly!</p>
          <p style="margin: 4px 0 0;">This is your official receipt. Please keep it for your records.</p>
          <p style="margin: 4px 0 0;"><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/track/${referenceNumber}" style="color: #2563eb;">Track your luggage</a></p>
        </div>
      </div>
    </div>
  `;

  await (await getTransporter()).sendMail({
    from: config.from,
    to,
    subject: `Your Dropnfly Receipt - ${referenceNumber}`,
    html,
  });
  return true;
}

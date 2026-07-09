import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.SMTP_USER) {
    console.warn("[EMAIL] SMTP not configured — emails will not be sent. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
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
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  qrCodeBase64: string;
  pickupLocation: string;
  dropOffLocation: string;
  scheduledDate: string;
}) {
  const qrDataUri = `data:image/png;base64,${qrCodeBase64}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${customerName}</strong>,</p>
        <p>Your luggage pickup has been scheduled successfully.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; color: #64748b;">Pickup Location</td>
            <td style="padding: 8px; font-weight: 600;">${pickupLocation}</td>
          </tr>
          <tr style="background: #f1f5f9;">
            <td style="padding: 8px; color: #64748b;">Drop-off Location</td>
            <td style="padding: 8px; font-weight: 600;">${dropOffLocation}</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #64748b;">Scheduled Date</td>
            <td style="padding: 8px; font-weight: 600;">${scheduledDate}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 24px 0;">
          <p style="color: #64748b; margin-bottom: 12px;">Scan this QR code to track your luggage:</p>
          <img src="${qrDataUri}" alt="QR Code" style="width: 180px; height: 180px;" />
        </div>

        <p style="text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/track/${referenceNumber}"
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Track Your Luggage
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Dropnfly &bull; Reference: ${referenceNumber}
        </p>
      </div>
    </div>
  `;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || '"Dropnfly" <noreply@dropnfly.ph>',
    to,
    subject: `Booking Confirmed - ${referenceNumber}`,
    html,
  });
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
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Rider Assigned!</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${customerName}</strong>,</p>
        <p>A rider has been assigned to your booking. Here are the details:</p>

        <div style="text-align: center; margin: 24px 0;">
          ${riderProfilePic ? `<img src="${riderProfilePic}" alt="${riderName}" style="width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb;" />` : `<div style="width: 96px; height: 96px; border-radius: 50%; background: #2563eb; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; border: 3px solid #bfdbfe;">${riderName.charAt(0)}</div>`}
          <h3 style="margin: 12px 0 4px;">${riderName}</h3>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${vehicleType ? `<tr><td style="padding: 8px; color: #64748b;">Vehicle</td><td style="padding: 8px; font-weight: 600;">${vehicleType}</td></tr>` : ""}
          ${plateNumber ? `<tr style="background: #f1f5f9;"><td style="padding: 8px; color: #64748b;">Plate Number</td><td style="padding: 8px; font-weight: 600;">${plateNumber}</td></tr>` : ""}
        </table>

        <p style="text-align: center; margin-top: 24px;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/track/${referenceNumber}"
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Track Your Luggage
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Dropnfly &bull; Reference: ${referenceNumber}
        </p>
      </div>
    </div>
  `;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || '"Dropnfly" <noreply@dropnfly.ph>',
    to,
    subject: `Rider Assigned - ${referenceNumber}`,
    html,
  });
}

export async function sendIncidentEmail({
  to,
  customerName,
  referenceNumber,
  incidentType,
  status,
  resolution,
  incidentId,
  siteUrl,
}: {
  to: string;
  customerName: string;
  referenceNumber: string;
  incidentType: string;
  status: string;
  resolution?: string | null;
  incidentId: string;
  siteUrl?: string;
}) {
  const baseUrl = siteUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const trackUrl = `${baseUrl}/track/${referenceNumber}`;
  const typeLabel = incidentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let statusSection = "";
  if (status === "PENDING") {
    statusSection = `<p>Your report has been received and is pending review. Our team will investigate and get back to you.</p>`;
  } else if (status === "INVESTIGATING") {
    statusSection = `<p>Your report is now being investigated by our team. We will keep you updated on the progress.</p>`;
  } else if (status === "RESOLVED") {
    statusSection = `
      <p>Your report has been <strong style="color: #16a34a;">resolved</strong>.</p>
      ${resolution ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #166534;"><strong>Resolution:</strong></p>
        <p style="margin: 8px 0 0; color: #166534;">${resolution}</p>
      </div>` : ""}
    `;
  } else if (status === "CLOSED") {
    statusSection = `<p>This report has been closed. Thank you for your patience.</p>`;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Incident Report Update</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">Reference: <strong>${referenceNumber}</strong></p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${customerName}</strong>,</p>
        <p>There has been an update on your <strong>${typeLabel}</strong> report.</p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b;">Status: <strong>${status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</strong></p>
        </div>

        ${statusSection}

        <p style="text-align: center; margin-top: 24px;">
          <a href="${trackUrl}"
             style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Track Your Report
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Dropnfly &bull; Reference: ${referenceNumber}
        </p>
      </div>
    </div>
  `;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || '"Dropnfly" <noreply@dropnfly.ph>',
    to,
    subject: `Incident Report Update - ${referenceNumber}`,
    html,
  });
}

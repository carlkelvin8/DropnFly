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

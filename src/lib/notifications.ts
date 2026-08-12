import { prisma } from "./prisma";
import nodemailer from "nodemailer";
import { sendPushToUser, sendPushToCustomer } from "./push";

function createTransporter() {
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

interface SendNotificationParams {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
  sendEmail?: boolean;
}

export async function sendNotification({
  userId,
  type,
  title,
  message,
  link,
  sendEmail = false,
}: SendNotificationParams) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link },
    });
  } catch {
    console.warn("Failed to create in-app notification");
  }

  try {
    await sendPushToUser(userId, { title, body: message, url: link });
  } catch {
    console.warn("Failed to send push notification");
  }

  if (sendEmail) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user?.email) {
        const transporter = createTransporter();
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Dropnfly" <noreply@dropnfly.ph>',
          to: user.email,
          subject: title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #ea7d3d; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">${title}</h2>
              </div>
              <div style="padding: 24px; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hi <strong>${user.name}</strong>,</p>
                ${message ? `<p>${message}</p>` : ""}
                ${link ? `<p style="text-align: center; margin-top: 16px;"><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}${link}" style="display: inline-block; background: #ea7d3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Details</a></p>` : ""}
                <hr style="border: none; border-top: 1px solid #d1d5db; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">Dropnfly Notification</p>
              </div>
            </div>
          `,
        });
      }
    } catch {
      console.warn("Failed to send email notification");
    }
  }
}

export async function notifyBookingCreated(userIds: string[], bookingRef: string, customerName: string) {
  for (const userId of userIds) {
    await sendNotification({
      userId,
      type: "booking_created",
      title: "New Booking Created",
      message: `Booking ${bookingRef} created by ${customerName}`,
      link: `/dashboard/bookings`,
      sendEmail: true,
    });
  }
}

export async function notifyBookingStatusChanged(assignedUserIds: string[], bookingRef: string, status: string) {
  for (const userId of assignedUserIds) {
    await sendNotification({
      userId,
      type: "status_updated",
      title: "Booking Status Updated",
      message: `Booking ${bookingRef} is now ${status.replace("_", " ").toLowerCase()}`,
      link: `/dashboard/bookings`,
      sendEmail: true,
    });
  }
}

export async function notifyTaskAssigned(userId: string, bookingRef: string) {
  await sendNotification({
    userId,
    type: "task_assigned",
    title: "New Task Assigned",
    message: `You have been assigned to booking ${bookingRef}`,
    link: `/dashboard/my`,
    sendEmail: true,
  });
}

export async function notifyPickupStarted(userId: string, bookingRef: string) {
  await sendNotification({
    userId,
    type: "pickup_started",
    title: "Pickup Started",
    message: `Pickup for booking ${bookingRef} has started. Your live location is now shared with the customer for tracking.`,
    link: `/dashboard/my`,
    sendEmail: true,
  });
}

export async function notifyBookingCancelled(staffUserIds: string[], bookingRef: string, customerName: string) {
  for (const userId of staffUserIds) {
    await sendNotification({
      userId,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      message: `Booking ${bookingRef} was cancelled by ${customerName}`,
      link: `/dashboard/bookings`,
      sendEmail: true,
    });
  }
}

export async function notifyDropOffVerified(staffUserIds: string[], bookingRef: string, customerName: string) {
  for (const userId of staffUserIds) {
    await sendNotification({
      userId,
      type: "dropoff_verified",
      title: "Drop-off Verified",
      message: `${customerName} verified the drop-off of booking ${bookingRef}. Luggage is now In Storage.`,
      link: `/dashboard/bookings`,
      sendEmail: true,
    });
  }
}

export async function notifyNoShowReported(adminUserIds: string[], bookingRef: string, reporterName: string) {
  for (const userId of adminUserIds) {
    await sendNotification({
      userId,
      type: "no_show_report",
      title: "No-Show Report Pending Review",
      message: `${reporterName} reported booking ${bookingRef} as no-show/cancelled. Awaiting admin decision.`,
      link: `/dashboard/incidents`,
      sendEmail: true,
    });
  }
}

export async function notifyNoShowDecision(reporterUserId: string, bookingRef: string, decision: string) {
  await sendNotification({
    userId: reporterUserId,
    type: "no_show_decision",
    title: `No-Show Report ${decision === "accept" ? "Accepted" : "Dismissed"}`,
    message: `Admin ${decision === "accept" ? "accepted" : "dismissed"} your no-show report for booking ${bookingRef}.`,
    link: `/dashboard/bookings`,
    sendEmail: true,
  });
}

export async function sendCustomerNotification({
  customerId,
  type,
  title,
  message,
  link,
}: {
  customerId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
}) {
  try {
    await prisma.customerNotification.create({
      data: { customerId, type, title, message, link },
    });
  } catch {
    console.warn("Failed to send customer notification");
  }

  try {
    await sendPushToCustomer(customerId, { title, body: message, url: link });
  } catch {
    console.warn("Failed to send customer push notification");
  }
}

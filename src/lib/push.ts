import webpush from "web-push";
import { prisma } from "./prisma";

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:admin@dropnfly.ph";

  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables."
    );
  }

  return { publicKey, privateKey, email };
}

try {
  const { publicKey, privateKey, email } = getVapidKeys();
  webpush.setVapidDetails(email, publicKey, privateKey);
} catch {
  // Push sending will fail until VAPID keys are configured; callers handle errors.
}

export function getVapidPublicKey(): string {
  return getVapidKeys().publicKey;
}

export async function sendPushToUser(userId: string, payload: { title: string; body?: string; url?: string }) {
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const webpushErr = err as { statusCode?: number };
        if (webpushErr.statusCode === 410 || webpushErr.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("Push notification sending failed");
    }
  }
}

export async function sendPushToCustomer(customerId: string, payload: { title: string; body?: string; url?: string }) {
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { customerId } });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const webpushErr = err as { statusCode?: number };
        if (webpushErr.statusCode === 410 || webpushErr.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("Push notification sending failed");
    }
  }
}

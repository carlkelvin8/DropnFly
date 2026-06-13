import webpush from "web-push";
import { prisma } from "./prisma";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:support@dropnfly.ph",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export function getVapidPublicKey(): string {
  if (vapidPublicKey) return vapidPublicKey;
  const keys = webpush.generateVAPIDKeys();
  return keys.publicKey;
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
    console.warn("Push notification sending failed");
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
    console.warn("Push notification sending failed");
  }
}

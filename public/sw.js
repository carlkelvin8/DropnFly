self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Dropnfly", body: "", icon: "/icon.png", badge: "/badge.png" };

  const options = {
    body: data.body,
    icon: data.icon || "/icon.png",
    badge: data.badge || "/badge.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});

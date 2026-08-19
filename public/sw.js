// public/sw.js
//
// SERVICE WORKER DES NOTIFICATIONS PUSH (2026-08-18).
// Reçoit les notifications envoyées par le bureau (nouvelle tâche
// assignée, matériel commandé…) et les affiche même quand l'application
// technicien est fermée. Un tap ouvre l'application au bon endroit.

self.addEventListener("push", (evenement) => {
  let donnees = {};
  try {
    donnees = evenement.data ? evenement.data.json() : {};
  } catch {
    donnees = { corps: evenement.data ? evenement.data.text() : "" };
  }
  evenement.waitUntil(
    self.registration.showNotification(donnees.titre || "Fluxya", {
      body: donnees.corps || "",
      icon: "/icons/fluxya-192.png",
      badge: "/icons/fluxya-192.png",
      data: { url: donnees.url || "/technicien" },
    })
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const url = evenement.notification.data?.url || "/technicien";
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      // Une fenêtre de l'application est déjà ouverte : on la ramène
      // devant au lieu d'en ouvrir une deuxième.
      for (const f of fenetres) {
        if (f.url.includes("/technicien") && "focus" in f) return f.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

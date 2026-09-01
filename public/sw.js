// public/sw.js
//
// SERVICE WORKER : notifications push (2026-08-18) + CACHE HORS-LIGNE
// (2026-09-02 — « les gars hors ligne pèsent sur démarrer et ça ne part
// pas » : l'app ne se CHARGEAIT pas sans signal ; la mécanique de
// démarrage, elle, est locale depuis toujours).
//
// Stratégie du cache :
//   • NAVIGATIONS (ouvrir /technicien…) : réseau d'abord (toujours
//     frais), cache en secours (sous-sol sans signal → l'app s'ouvre
//     quand même avec sa dernière version) ;
//   • FICHIERS STATIQUES (/_next/static, icônes, manifest) : cache
//     d'abord (ils portent une empreinte unique — jamais périmés) ;
//   • JAMAIS les API (/api, Supabase, Google…) : les données restent
//     vraies ou absentes, jamais mensongères — les files hors-ligne de
//     l'app (heures, photos) s'occupent déjà du rejeu.

const CACHE_HORS_LIGNE = "fluxya-app-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith("fluxya-app-") && c !== CACHE_HORS_LIGNE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evenement) => {
  const req = evenement.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google… jamais touchés
  if (url.pathname.startsWith("/api/")) return; // les données, jamais en cache

  // Navigation : réseau d'abord, cache en secours.
  if (req.mode === "navigate") {
    evenement.respondWith(
      fetch(req)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE_HORS_LIGNE).then((c) => c.put(req, copie)).catch(() => {});
          return reponse;
        })
        .catch(() =>
          caches.match(req).then((trouvee) => trouvee || caches.match("/technicien"))
        )
    );
    return;
  }

  // Statiques empreintés : cache d'abord (réponse instantanée), réseau
  // au premier passage seulement.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith(".png") || url.pathname === "/manifest.json") {
    evenement.respondWith(
      caches.match(req).then(
        (trouvee) =>
          trouvee ||
          fetch(req).then((reponse) => {
            if (reponse.ok) {
              const copie = reponse.clone();
              caches.open(CACHE_HORS_LIGNE).then((c) => c.put(req, copie)).catch(() => {});
            }
            return reponse;
          })
      )
    );
  }
});

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

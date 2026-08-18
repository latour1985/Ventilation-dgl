// lib/notificationsPush.js
//
// NOTIFICATIONS PUSH (2026-08-18) — le technicien reçoit « nouvelle
// tâche assignée » ou « matériel commandé » sur son téléphone SANS
// ouvrir l'application.
//
// Côté TECHNICIEN : activerNotificationsPush() (au tap sur le bouton —
// la permission exige un geste) et resouscrireSiPermis() (au démarrage,
// silencieux, pour garder l'abonnement frais).
// Côté BUREAU : envoyerPushA(courriel, titre, corps) — la route serveur
// retrouve l'abonnement et signe l'envoi avec les clés VAPID.
//
// iPhone : les notifications exigent l'application AJOUTÉE À L'ÉCRAN
// D'ACCUEIL (iOS 16.4+). Android : fonctionne dès le navigateur.

import { supabase } from "./supabase/client";

const clePubliqueVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupporte() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!clePubliqueVapid
  );
}

// La clé VAPID publique au format attendu par PushManager.subscribe.
function cleEnOctets(base64) {
  const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(b);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

async function enregistrerAbonnement(abonnement) {
  const { data } = await supabase.auth.getSession();
  const jeton = data?.session?.access_token;
  if (!jeton) return false;
  const reponse = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ action: "abonner", abonnement }),
  });
  return reponse.ok;
}

// À appeler depuis un BOUTON (geste requis pour la permission).
// Retourne : "active" | "refuse" | "non_supporte" | "erreur".
export async function activerNotificationsPush() {
  if (!pushSupporte()) return "non_supporte";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "refuse";
    const enregistrement = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const abonnement =
      (await enregistrement.pushManager.getSubscription()) ||
      (await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleEnOctets(clePubliqueVapid),
      }));
    const ok = await enregistrerAbonnement(abonnement.toJSON());
    return ok ? "active" : "erreur";
  } catch {
    return "erreur";
  }
}

// Au démarrage : si la permission est DÉJÀ accordée, on rafraîchit
// l'abonnement en silence (il peut expirer côté navigateur).
export async function resouscrireSiPermis() {
  if (!pushSupporte() || Notification.permission !== "granted") return;
  try {
    const enregistrement = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const abonnement =
      (await enregistrement.pushManager.getSubscription()) ||
      (await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleEnOctets(clePubliqueVapid),
      }));
    await enregistrerAbonnement(abonnement.toJSON());
  } catch {
    // silencieux — le bouton d'activation reste le chemin de secours
  }
}

// BUREAU → TECHNICIEN. Ne lance jamais d'exception : la notification
// est un bonus, jamais un bloqueur du geste principal.
export async function envoyerPushA(courriel, titre, corps, url = "/technicien") {
  try {
    const { data } = await supabase.auth.getSession();
    const jeton = data?.session?.access_token;
    if (!jeton || !courriel) return false;
    const reponse = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "envoyer", courriel, titre, corps, url }),
    });
    return reponse.ok;
  } catch {
    return false;
  }
}

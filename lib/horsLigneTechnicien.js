// lib/horsLigneTechnicien.js
//
// COFFRE HORS-LIGNE DU TECHNICIEN (2026-08-27).
//
// Un sous-sol sans signal ne doit RIEN perdre. Le problème réglé ici :
// une photo prise hors-ligne vivait uniquement en mémoire (URL blob) —
// un rechargement de page et elle disparaissait, et le bon partait au
// bureau sans elle. localStorage ne peut pas stocker un blob ;
// IndexedDB, oui.
//
// Le contrat :
//   • CHAQUE photo est coffrée ICI d'abord, téléversée ensuite ;
//   • téléversement réussi → décoffrée (le stockage Supabase fait foi) ;
//   • échec (pas de réseau, bucket) → elle attend au coffre, l'aperçu
//     se restaure même après un rechargement, et le REJEU (au retour du
//     réseau) la téléverse et met la tâche à jour ;
//   • `coffreCle` = « tacheId|avant » ou « tacheId|apres » — le rejeu
//     sait exactement où la photo doit retourner.
//
// Toujours silencieux en cas d'échec : le coffre est un filet, jamais
// un bloqueur (navigateur privé sans IndexedDB → l'app continue comme
// avant, avec le comportement d'origine).

const NOM_BASE = "fluxya-hors-ligne";
const STORE_PHOTOS = "photos";

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const demande = indexedDB.open(NOM_BASE, 1);
    demande.onupgradeneeded = () => {
      const db = demande.result;
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: "id" });
      }
    };
    demande.onsuccess = () => resolve(demande.result);
    demande.onerror = () => reject(demande.error);
  });
}

function transaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, mode);
    const store = tx.objectStore(STORE_PHOTOS);
    const requete = operation(store);
    tx.oncomplete = () => resolve(requete?.result);
    tx.onerror = () => reject(tx.error);
  });
}

// Coffre une photo (blob + destination). Écrase silencieusement si le
// même id existe déjà (re-tentative du même ajout).
export async function coffrerPhoto({ id, blob, origine, coffreCle }) {
  try {
    const db = await ouvrirBase();
    await transaction(db, "readwrite", (store) =>
      store.put({ id, blob, origine: origine || "camera", coffreCle: coffreCle || null, coffreLe: Date.now() })
    );
    return true;
  } catch {
    return false;
  }
}

// Le blob d'une photo coffrée — pour restaurer l'aperçu après un
// rechargement de page hors-ligne.
export async function lireBlobPhoto(id) {
  try {
    const db = await ouvrirBase();
    const entree = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, "readonly");
      const requete = tx.objectStore(STORE_PHOTOS).get(id);
      requete.onsuccess = () => resolve(requete.result || null);
      requete.onerror = () => reject(requete.error);
    });
    return entree?.blob || null;
  } catch {
    return null;
  }
}

// Toutes les photos en attente de téléversement — pour le rejeu.
export async function listerPhotosCoffre() {
  try {
    const db = await ouvrirBase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTOS, "readonly");
      const requete = tx.objectStore(STORE_PHOTOS).getAll();
      requete.onsuccess = () => resolve(requete.result || []);
      requete.onerror = () => reject(requete.error);
    });
  } catch {
    return [];
  }
}

// Téléversement réussi (ou photo retirée) : le coffre n'a plus à la garder.
export async function decoffrerPhoto(id) {
  try {
    const db = await ouvrirBase();
    await transaction(db, "readwrite", (store) => store.delete(id));
  } catch {
    // le rejeu la retrouvera « déjà téléversée » et la décoffrera plus tard
  }
}

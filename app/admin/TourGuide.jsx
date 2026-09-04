"use client";

// ============================================================
// ❓ TOUR GUIDÉ DE FLUXYA (2026-09-04, chantier approuvé) — la visite
// de bienvenue : une carte flottante qui promène l'utilisateur
// d'onglet en onglet avec deux phrases simples par écran. Pensé pour
// un nouvel employé ou une nouvelle entreprise cliente — et
// relançable en tout temps par le bouton ❓ de l'en-tête.
//
// Choix assumés :
//   • le tour CHANGE d'onglet pour vrai (pas de surlignage fragile
//     d'éléments — les écrans bougent, les explications restent) ;
//   • les étapes suivent les PERMISSIONS : chacun ne visite que ce
//     qu'il a le droit de voir ;
//   • proposé UNE fois par navigateur (localStorage), jamais imposé.
// ============================================================

import { useEffect, useState } from "react";

const CLE_TOUR_FAIT = "fluxya_tour_fait";

// Les étapes, dans l'ordre des onglets. `onglet: null` = pas de
// navigation (bienvenue / mot de la fin).
const ETAPES = [
  {
    onglet: null,
    emoji: "👋",
    titre: "Bienvenue dans Fluxya !",
    texte:
      "Deux minutes pour faire le tour des écrans — chaque étape t'amène au bon endroit et t'explique à quoi il sert. Tu peux quitter n'importe quand : le bouton ❓ en haut relance le tour.",
  },
  {
    onglet: "tableau-de-bord",
    emoji: "📊",
    titre: "Tableau de bord",
    texte:
      "Le coup d'œil du matin : ce qui presse, ce qui rentre, ce qui accroche. C'est la page d'accueil de ta journée.",
  },
  {
    onglet: "recherche",
    emoji: "🔍",
    titre: "Recherche",
    texte:
      "Tout se retrouve ici — un client, un devis, une commande, une adresse. Astuce : la barre de recherche en haut de l'écran fonctionne de partout, sans changer de page.",
  },
  {
    onglet: "clients",
    emoji: "👥",
    titre: "Clients",
    texte:
      "Le dossier complet de chaque client : coordonnées, courriels d'envoi, devis, commandes et historique. Un client bien rempli, c'est des factures qui partent à la bonne adresse du premier coup.",
  },
  {
    onglet: "projets",
    emoji: "🏗️",
    titre: "Projets",
    texte:
      "Les chantiers au long cours : budget, heures, achats, rentabilité et numéro de suivi du client. Tout ce qui s'y rattache s'additionne tout seul.",
  },
  {
    onglet: "devis",
    emoji: "📄",
    titre: "Devis",
    texte:
      "Tes soumissions : le client les reçoit par courriel et répond en ligne (accepte, refuse ou demande un changement). L'œil 👁️ te dit s'il a ouvert son devis — et le bouton 🔔 le relance poliment.",
  },
  {
    onglet: "agenda",
    emoji: "📅",
    titre: "Agenda",
    texte:
      "La semaine de l'équipe : les tâches s'assignent ici, les techniciens les reçoivent sur leur téléphone. Un appel de service prend son dépôt et sa zone au passage.",
  },
  {
    onglet: "facturation",
    emoji: "🧾",
    titre: "Facturation",
    texte:
      "Les travaux finis attendent ici. Tu révises le prix suggéré (heures, transport, minimums — tout est calculé), et la facture part par QuickBooks. Les badges 💵 te disent qui a payé et qui est en retard.",
  },
  {
    onglet: "inspections",
    emoji: "🚚",
    titre: "Inspections",
    texte:
      "Les rondes de véhicules du matin : qui conduit quoi, kilométrage, photos et pépins signalés. L'historique du camion se bâtit tout seul.",
  },
  {
    onglet: "pieces",
    emoji: "📦",
    titre: "Pièces et commandes",
    texte:
      "Les bons de commande fournisseurs et l'inventaire courant de l'atelier. Une commande marquée 📦 STOCK s'ajoute au stock à sa réception, et le seuil 🛒 t'avertit quand il faut recommander.",
  },
  {
    onglet: "paies",
    emoji: "💰",
    titre: "Heures et paies",
    texte:
      "Les heures pointées par l'équipe, semaine par semaine, prêtes pour la paie. Les ajustements restent tracés — rien ne se perd.",
  },
  {
    onglet: "tarifs",
    emoji: "🏷️",
    titre: "Tarifs",
    texte:
      "Tes prix de zones, taux horaires et minimums d'heures. C'est ici que se règle ce que les suggestions de facturation utilisent.",
  },
  {
    onglet: "parametres",
    emoji: "⚙️",
    titre: "Paramètres",
    texte:
      "La fiche de l'entreprise : logo, adresses, courriels d'envoi et de copie, connexion QuickBooks. Ce qui est réglé ici habille tous tes documents.",
  },
  {
    onglet: "utilisateurs",
    emoji: "🔐",
    titre: "Utilisateurs",
    texte:
      "Les comptes de l'équipe et leurs accès : chacun voit seulement ses sections. C'est ici qu'on invite un nouvel employé.",
  },
  {
    onglet: null,
    emoji: "🎉",
    titre: "C'est tout !",
    texte:
      "Tu connais maintenant les grandes pièces de la maison. Le bouton ❓ en haut relance ce tour quand tu veux — bonne journée !",
  },
];

export function tourDejaFait() {
  try {
    return localStorage.getItem(CLE_TOUR_FAIT) === "oui";
  } catch {
    return true; // stockage indisponible : ne jamais s'imposer
  }
}

export function marquerTourFait() {
  try {
    localStorage.setItem(CLE_TOUR_FAIT, "oui");
  } catch {
    // stockage indisponible — tant pis, on ne bloque rien
  }
}

export default function TourGuide({ permissions, onAllerOnglet, onFermer }) {
  // Chacun ne visite que ce que ses accès lui montrent.
  const etapes = ETAPES.filter((e) => !e.onglet || (permissions || []).includes(e.onglet));
  const [index, setIndex] = useState(0);
  const etape = etapes[index];

  useEffect(() => {
    if (etape?.onglet) onAllerOnglet?.(etape.onglet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const terminer = () => {
    marquerTourFait();
    onFermer?.();
  };

  if (!etape) return null;
  const derniere = index === etapes.length - 1;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 pb-4 sm:pb-6">
      <div className="w-full max-w-md rounded-2xl border-2 border-[#131B2E] bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-extrabold text-slate-900">
            {etape.emoji} {etape.titre}
          </p>
          <button onClick={terminer} aria-label="Quitter le tour" className="shrink-0 text-xs font-bold text-slate-400 underline underline-offset-2">
            Quitter
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{etape.texte}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tabular-nums text-slate-400">
            {index + 1} / {etapes.length}
          </span>
          <div className="flex gap-1.5">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 active:scale-95"
              >
                ← Précédent
              </button>
            )}
            <button
              onClick={() => (derniere ? terminer() : setIndex((i) => i + 1))}
              className="rounded-lg bg-[#131B2E] px-4 py-1.5 text-xs font-bold text-white active:scale-95"
            >
              {derniere ? "Terminer ✓" : index === 0 ? "C'est parti →" : "Suivant →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

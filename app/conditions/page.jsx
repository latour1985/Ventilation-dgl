"use client";

// app/conditions/page.jsx
//
// TERMES ET CONDITIONS GÉNÉRALES — page PUBLIQUE, sans connexion
// (2026-08-24). Le message d'une facture QuickBooks est plafonné à
// ~900 caractères : impossible d'y écrire dix clauses. Il porte donc
// un LIEN vers cette page — le client qui reçoit la facture de dépôt
// peut lire l'intégralité des conditions AVANT de payer, ce qui est
// la condition même de leur opposabilité (un dépôt « non remboursable »
// dont la règle n'a jamais été montrée ne tient pas).
//
// Le texte vient de lib/termes.js — la même source que les documents
// (devis, bons) et le courriel de dépôt. Rien n'est recopié ici.
//
// 🏢 L'IDENTITÉ DE L'ENTREPRISE (2026-09-04, demande du propriétaire :
// « ça devrait être le logo de l'entreprise ») : le lien porte
// « ?e=<entreprise> » et la page affiche le NOM, le LOGO et les
// coordonnées de la compagnie concernée — plus jamais l'icône Fluxya
// à la place du logo de Ventilation DGL. Sans paramètre (vieux liens
// déjà envoyés) : repli sur « dgl », l'entreprise des liens d'époque.

import { useEffect, useState } from "react";
import TermesConditions from "@/components/TermesConditions";
import Logo from "@/components/Logo";

export default function Conditions() {
  const [ent, setEnt] = useState(null); // null = chargement ; false = introuvable
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("e") || "dgl";
    fetch(`/api/entreprise-publique?e=${encodeURIComponent(e)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => setEnt(x && x.id ? x : false))
      .catch(() => setEnt(false));
  }, []);

  // Logo : celui de la fiche d'abord ; DGL garde son fichier historique
  // en repli ; sinon l'icône de la plateforme (mieux qu'un trou).
  const logoSrc = ent && ent.logo ? ent.logo : ent && ent.id === "dgl" ? "/logo-dgl.png" : null;
  const nom = ent ? ent.nomLegal || ent.nom : "";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 md:p-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-slate-900">Termes et conditions générales</h1>
          {logoSrc ? (
            <img src={logoSrc} alt={nom || "Logo"} className="max-h-16 w-auto shrink-0 object-contain" />
          ) : ent === false || (ent && !logoSrc) ? (
            <Logo variant="icon" className="shrink-0" />
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {nom || " "}{nom ? " · " : ""}Ces conditions s&apos;appliquent à nos devis, appels de service, dépôts de
          réservation et travaux.
        </p>

        <TermesConditions />

        <p className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          {ent
            ? [nom, ent.adresse, ent.telephone].filter(Boolean).join(" · ")
            : " "}
        </p>
      </div>
    </div>
  );
}

"use client";

// app/admin/OngletClients.jsx
//
// CLIENTS (fiches, historique de travaux, devis du client, projets) —
// tranche T9 du découpage de page.jsx (2026-09-01). Extraction
// MÉCANIQUE : aucun comportement ne change, le code est déplacé tel
// quel — seuls des export/import s'ajoutent.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BarChart3, Briefcase, Camera, Check, ChevronRight, ClipboardList, Cloud, CreditCard, FileText, KeyRound, Lock, Mail, Phone, Plus, RefreshCw, Search, Trash2, UserPlus, X } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import { erreursClientPourQuickBooks } from "@/lib/validationQuickBooks";
import { sauvegarderClient } from "@/lib/supabase/clients";
import { synchroniserClientsQbo } from "@/lib/quickbooksClient";
import { ModalDetailProjet } from "./OngletProjets";
import { Button, BarrePagination, ITEMS_PAR_PAGE, todayISO, TERMES_FACTURATION, nomClientNormalise, nomAffichageClient, libelleAdresse, adresseFacturationClient, AutocompleteAdresse, GalerieAvantApres, ApercuDevisClient, ApercuBonTravailClient, calculerRentabiliteProjet, couleurSanteBudget, evaluerSanteProjet } from "./partage";

export function DevisDuClient({ devisListe, clientId, surlignerNumero, compact, onNouvelleVersion }) {
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [versionAffichee, setVersionAffichee] = useState(null);
  const [apercu, setApercu] = useState(null);
  // 📚 10 par page ICI AUSSI (2026-08-30, question du propriétaire) —
  // même règle que la liste principale des devis.
  const [pageDevisClient, setPageDevisClient] = useState(1);
  const refHautListe = useRef(null);

  // Regroupement par dossier : une entrée par devis, ses révisions dedans.
  const dossiers = (() => {
    const parBase = {};
    (devisListe || [])
      .filter((d) => (clientId ? d.clientId === clientId : true))
      .forEach((d) => {
        const base = d.numeroBase || d.numero;
        (parBase[base] = parBase[base] || []).push(d);
      });
    return Object.entries(parBase)
      .map(([base, versions]) => {
        const triees = versions.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
        const active = triees.find((v) => v.versionActive !== false) || triees[triees.length - 1];
        return { base, versions: triees, active };
      })
      .sort((a, b) => (b.active.creeLe || b.active.date || "").localeCompare(a.active.creeLe || a.active.date || ""));
  })();

  // 🎯 ARRIVÉE PAR LA RECHERCHE RAPIDE (2026-08-30, « arriver directement
  // à la bonne place du dossier client pour le devis ») : bonne page,
  // puis défilement jusqu'à la carte du devis cherché (surlignée).
  useEffect(() => {
    if (!surlignerNumero) return;
    const i = dossiers.findIndex((x) => x.versions.some((v) => v.numero === surlignerNumero));
    if (i < 0) return;
    setPageDevisClient(Math.floor(i / ITEMS_PAR_PAGE) + 1);
    const minuterie = setTimeout(() => {
      document.getElementById(`devis-client-${surlignerNumero}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    return () => clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surlignerNumero]);

  if (dossiers.length === 0) {
    return <p className="text-xs text-slate-400">Aucun devis pour ce client.</p>;
  }

  const pageCourante = Math.min(pageDevisClient, Math.max(1, Math.ceil(dossiers.length / ITEMS_PAR_PAGE)));
  const dossiersPage = dossiers.slice((pageCourante - 1) * ITEMS_PAR_PAGE, pageCourante * ITEMS_PAR_PAGE);

  return (
    <div ref={refHautListe} className="space-y-1.5">
      {dossiersPage.map(({ base, versions, active }) => {
        const ouvert = dossierOuvert === base;
        const affichee = ouvert ? versions.find((v) => v.numero === versionAffichee) || active : active;
        // Devis ciblé par la recherche : mis en évidence à l'ouverture.
        const cible = surlignerNumero && versions.some((v) => v.numero === surlignerNumero);
        return (
          <div
            key={base}
            id={cible ? `devis-client-${surlignerNumero}` : undefined}
            className={`rounded-lg border p-2.5 ${cible ? "border-[#FF6A13] bg-orange-50 ring-2 ring-orange-200" : "border-slate-200 bg-white"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900">
                  {affichee.numero}
                  {versions.length > 1 && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{versions.length} versions</span>
                  )}
                  {affichee.estContrat && (
                    <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                      CONTRAT · {affichee.frequenceFacturationAnnuelle}×/an
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400">
                  {affichee.date}
                  {affichee.noteVersion ? ` · ${affichee.noteVersion}` : ""}
                  {!compact && affichee.clientNom ? ` · ${affichee.clientNom}` : ""}
                </p>
                {/* 📌 CE QUE VEND CE DEVIS (2026-08-30, « plus facile de
                    les reconnaître ») : la première ligne fait office
                    d'étiquette — le devis n'a pas d'adresse propre,
                    elle se choisit seulement quand on le traite. */}
                {affichee.adresseTravaux && (
                  <p className="truncate text-[10px] font-semibold text-slate-600">🏠 {affichee.adresseTravaux}</p>
                )}
                {affichee.lignes?.[0]?.nom && (
                  <p className="truncate text-[10px] text-slate-500">
                    📌 {affichee.lignes[0].nom}
                    {affichee.lignes.length > 1 ? ` (+${affichee.lignes.length - 1})` : ""}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold tabular-nums text-slate-800">{affichee.totalVendant.toFixed(2)} $</p>
                <span
                  className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    affichee.statut === "accepte" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {affichee.statut === "accepte" ? "ACCEPTÉ" : "ENVOYÉ"}
                </span>
              </div>
            </div>

            {/* ONGLETS DES VERSIONS */}
            {versions.length > 1 && (
              <div className="mt-1.5 flex flex-wrap gap-1 rounded-md border border-slate-200 p-0.5">
                {versions.map((v) => (
                  <button
                    key={v.numero}
                    onClick={() => {
                      setDossierOuvert(base);
                      setVersionAffichee(v.numero);
                    }}
                    title={v.noteVersion || undefined}
                    className={`rounded px-1.5 py-1 text-[9px] font-extrabold ${
                      v.numero === affichee.numero ? "bg-[#131B2E] text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {v.version === 0 ? "Originale" : `v${v.version}`}
                    {v.numero === active.numero ? " ★" : ""}
                  </button>
                ))}
              </div>
            )}
            {affichee.numero !== active.numero && (
              <p className="mt-1 text-[9px] font-bold text-slate-400">🔒 Version archivée — la courante est {active.numero}</p>
            )}
            {affichee.traite && (
              <p className="mt-1 text-[9px] font-bold text-blue-600">
                ✓ Traité — {affichee.modeTraitement === "projet" ? "converti en projet" : "converti en bon de travail"}
              </p>
            )}
            <div className="mt-1.5 flex gap-1.5">
              <Button variant="outline" onClick={() => setApercu(affichee)} className="min-h-0 flex-1 gap-1 py-1.5 text-[11px]">
                <FileText size={11} /> Voir version client
              </Button>
              {/* ✏️ MODIFIER D'ICI (2026-08-30, « si un client appelle ou
                  qu'on a un oubli ») : ouvre l'onglet Devis avec la
                  fenêtre d'édition déjà chargée — nouvelle version, la
                  version envoyée reste intacte. */}
              {onNouvelleVersion && !active.traite && (
                <Button onClick={() => onNouvelleVersion(active)} className="min-h-0 flex-1 gap-1 py-1.5 text-[11px]">
                  ✏️ Modifier (nouvelle version)
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <BarrePagination total={dossiers.length} page={pageDevisClient} onPage={setPageDevisClient} refHaut={refHautListe} libelle="devis" />
      {apercu && <ApercuDevisClient devis={apercu} onFermer={() => setApercu(null)} />}
    </div>
  );
}


// ============================================================
// ✏️ MODIFIER LA FICHE CLIENT — après la création
// ------------------------------------------------------------
// Demande du propriétaire (2026-08-15) : tout se corrige après coup —
// le nom du contact, l'entreprise, LE NOM AFFICHÉ (personne vs
// entreprise — ex. afficher « Toitures Lavallée inc. » plutôt que le
// contact), le téléphone et l'ADRESSE DE FACTURATION. La sauvegarde
// passe par l'effet de persistance existant (clients modifiés =
// réécrits automatiquement en base).
// ============================================================
export function ModalEditionClient({ client, onFermer, onEnregistrer }) {
  const [nom, setNom] = useState(client.nom || "");
  const [entreprise, setEntreprise] = useState(client.entreprise || "");
  const [nomAffichage, setNomAffichage] = useState(client.nomAffichage || "nom");
  const [telephone, setTelephone] = useState(client.telephone || "");
  // Adresse de facturation : l'actuelle (règle complète) affichée, une
  // nouvelle choisie via Google la remplace.
  const [nouvelleAdresse, setNouvelleAdresse] = useState(null);
  const [nouvelleAdresseUnite, setNouvelleAdresseUnite] = useState("");
  const actuelle = adresseFacturationClient(client);
  // 📇 CARNET DE CONTACTS SUR PLACE (SQL 72, 2026-08-17) — chargé de
  // projet, concierge, gérant… réutilisables de chantier en chantier.
  const [contacts, setContacts] = useState(() => (client.contacts || []).map((c) => ({ ...c })));
  // 📌 NOTE GÉNÉRALE (2026-08-30) — « s'il y a un problème on peut le
  // noter » : libre, interne au bureau, jamais vue du client ni du
  // technicien.
  const [note, setNote] = useState(client.note || "");
  const majContact = (id, champs) =>
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...champs } : c)));
  const ajouterContact = () =>
    setContacts((prev) => [...prev, { id: `ct-${Date.now()}`, nom: "", role: "", telephone: "" }]);
  const retirerContact = (id) => setContacts((prev) => prev.filter((c) => c.id !== id));

  // PERSONNE OU ENTREPRISE + téléphone obligatoire (2026-08-17) —
  // mêmes règles qu'à la création.
  const personneOk = nom.trim().length > 0 && nom.trim() !== entreprise.trim();
  const identiteOk = personneOk || entreprise.trim().length > 0;
  const raisonsFiche = [];
  if (!identiteOk) raisonsFiche.push("une personne OU une entreprise");
  if (!telephone.trim()) raisonsFiche.push("un téléphone");
  const enregistrer = () => {
    if (raisonsFiche.length > 0) return;
    onEnregistrer({
      // Entreprise seule : elle sert de nom et d'affichage.
      nom: personneOk ? nom.trim() : entreprise.trim(),
      entreprise: entreprise.trim(),
      nomAffichage: personneOk ? (entreprise.trim() ? nomAffichage : "nom") : "entreprise",
      telephone: telephone.trim(),
      note: note.trim(),
      // Lignes vides écartées (un contact sans nom ne sert à rien).
      contacts: contacts
        .map((c) => ({ ...c, nom: (c.nom || "").trim(), role: (c.role || "").trim(), telephone: (c.telephone || "").trim() }))
        .filter((c) => c.nom),
      ...(nouvelleAdresse
        ? {
            adresseFacturation: [nouvelleAdresse.label, nouvelleAdresseUnite.trim() ? `app. ${nouvelleAdresseUnite.trim()}` : ""]
              .filter(Boolean)
              .join(", "),
          }
        : {}),
    });
    onFermer();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">✏️ Modifier la fiche — {nomAffichageClient(client)}</h3>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Nom du contact</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Entreprise (optionnel)</label>
            <input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Ex : Toitures Lavallée inc." className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          {entreprise.trim() && (
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Nom affiché (listes, devis, factures)</label>
              <div className="flex flex-wrap gap-3">
                {[["nom", "Nom de la personne"], ["entreprise", "Entreprise"], ["nom-entreprise", "Nom — Entreprise"]].map(([val, lib]) => (
                  <label key={val} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <input type="radio" name="edition-nom-affichage" checked={nomAffichage === val} onChange={() => setNomAffichage(val)} />
                    {lib}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Téléphone</label>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Adresse de facturation</label>
            {nouvelleAdresse ? (
              <p className="mb-1 flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700">
                <Check size={11} /> {nouvelleAdresse.label}
                <button onClick={() => setNouvelleAdresse(null)} className="ml-auto text-emerald-600 underline">annuler</button>
              </p>
            ) : (
              <p className="mb-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                {actuelle || <span className="italic text-amber-600">aucune — choisis-en une ci-dessous</span>}
              </p>
            )}
            <AutocompleteAdresse onSelection={setNouvelleAdresse} />
            <input
              value={nouvelleAdresseUnite}
              onChange={(e) => setNouvelleAdresseUnite(e.target.value)}
              placeholder="App. / bureau / casier postal (facultatif)"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <p className="mt-0.5 text-[9px] text-slate-400">
              Cette adresse s'imprime sous « Facturé à » sur les devis, bons de travail et factures.
            </p>
          </div>

          {/* 📌 NOTE GÉNÉRALE — l'aide-mémoire du bureau sur ce client
              (paiements difficiles, code d'accès, chien dans la cour…).
              Rappelée sur sa carte et à la création d'une tâche. */}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">📌 Note générale (interne au bureau)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex : facture toujours en retard — demander un dépôt. Code d'accès du garage : 4523."
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <p className="mt-0.5 text-[9px] text-slate-400">
              Visible au bureau seulement — jamais sur un document, jamais au client, jamais au technicien. Rappelée à la création d&apos;une tâche pour ce client.
            </p>
          </div>

          {/* 📇 CONTACTS SUR PLACE — le carnet du client. Offerts en
              liste déroulante à la création de tâche ; le technicien
              voit le contact choisi avec son bouton d'appel. */}
          <div>
            <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Contacts sur place (chantiers)</label>
            {contacts.length === 0 && (
              <p className="mb-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] italic text-slate-500">
                Aucun contact — ajoute la personne à voir sur place (chargé de projet, concierge…).
              </p>
            )}
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={c.nom}
                      onChange={(e) => majContact(c.id, { nom: e.target.value })}
                      placeholder="Nom (ex. : Marc Tremblay)"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      value={c.role || ""}
                      onChange={(e) => majContact(c.id, { role: e.target.value })}
                      placeholder="Rôle (chargé de projet…)"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      value={c.telephone || ""}
                      onChange={(e) => majContact(c.id, { telephone: e.target.value })}
                      placeholder="Téléphone"
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => retirerContact(c.id)}
                      className="shrink-0 rounded-lg border border-red-200 px-2 py-1.5 text-[10px] font-bold text-red-600"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={ajouterContact}
              className="mt-1.5 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-bold text-slate-500"
            >
              ➕ Ajouter un contact
            </button>
          </div>

          {raisonsFiche.length > 0 && (
            <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
              Pour enregistrer, il manque : {raisonsFiche.join(" · ")}.
            </p>
          )}
          <Button onClick={enregistrer} disabled={raisonsFiche.length > 0} className="w-full">Enregistrer les modifications</Button>
        </div>
      </div>
    </div>
  );
}



export function DetailTravail({ travail, clients, onFermer, onReactiver }) {
  const [apercuClientOuvert, setApercuClientOuvert] = useState(false);
  const complete = travail.statut === "complete";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                complete ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-[#B14E0E]"
              }`}
            >
              {complete ? "COMPLÉTÉ" : "À VENIR"}
            </span>
            <h3 className="mt-1.5 text-sm font-extrabold text-slate-900">{travail.titre}</h3>
            <p className="text-xs text-slate-500">{travail.date}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {complete && travail.montant != null && (
          <p className="mb-3 text-sm font-bold tabular-nums text-slate-800">{travail.montant.toFixed(2)} $</p>
        )}

        {complete && (
          <Button variant="outline" onClick={() => setApercuClientOuvert(true)} className="mb-3 w-full min-h-0 gap-1.5 py-2 text-xs">
            <FileText size={13} /> Voir version client
          </Button>
        )}

        {travail.estTransport && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Kilométrage transport</p>
              <p className="text-sm font-bold tabular-nums text-slate-800">{(travail.distanceKm || 0).toFixed(1)} km</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Temps de transport</p>
              <p className="text-sm font-bold tabular-nums text-slate-800">{(travail.heures || 0).toFixed(2)} h</p>
            </div>
          </div>
        )}

        {complete && (() => {
          const DELAI_MODIFICATION_MS = 10 * 60 * 1000;
          const dansDelai = travail.envoyeA && Date.now() - travail.envoyeA <= DELAI_MODIFICATION_MS;
          return (
            <div className={`mb-3 rounded-xl border p-3 ${travail.modifReactivee || dansDelai ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <KeyRound size={13} />
                    Modification par l'employé
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {travail.modifReactivee
                      ? "Réactivée — l'employé peut modifier ce travail (2e signature client requise)."
                      : dansDelai
                      ? "Encore dans la fenêtre de 10 minutes suivant l'envoi — l'employé peut modifier sans réactivation (2e signature client requise)."
                      : "Verrouillée — le délai de 10 minutes suivant l'envoi est écoulé."}
                  </p>
                </div>
                <Button
                  variant={travail.modifReactivee ? "outline" : "primary"}
                  onClick={() => onReactiver(travail.id, !travail.modifReactivee)}
                  className="min-h-0 px-3 py-1.5 text-xs"
                >
                  {travail.modifReactivee ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            </div>
          );
        })()}

        <div className="mb-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes de terrain
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-emerald-700">
              Visible au client
            </span>
          </p>
          <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {travail.noteTerrain || "Aucune note pour l'instant."}
          </p>
        </div>

        <div className="mb-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes internes
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-slate-600">
              Non visible au client
            </span>
          </p>
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
            {travail.noteInterne || "Aucune note interne."}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Photos</p>
          {travail.photosAvantUrls?.length > 0 || travail.photosApresUrls?.length > 0 ? (
            <GalerieAvantApres travail={travail} />
          ) : travail.photos.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune photo pour l'instant.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {travail.photos.map((label, i) => (
                <div key={i} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 p-1.5 text-center">
                  <Camera size={16} className="text-slate-400" />
                  <span className="text-[9px] leading-tight text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Cette réactivation doit se synchroniser vers l'app technicien (via Supabase Realtime en prod) pour que l'employé y ait accès de son côté.
        </p>
      </div>
      {apercuClientOuvert && <ApercuBonTravailClient travail={travail} clients={clients} onFermer={() => setApercuClientOuvert(false)} />}
    </div>
  );
}


export const LigneProjetClient = React.memo(function LigneProjetClient({ p, travaux, transactionsQb, utilisateurs, tauxMetiers, onOuvrir }) {
  const r = useMemo(() => calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers), [p, travaux, transactionsQb, utilisateurs, tauxMetiers]);
  const sante = evaluerSanteProjet(p, r);
  return (
    <button
      onClick={() => onOuvrir(p.id)}
      className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${sante.pastille}`} />
          <div>
            <p className="text-xs font-bold text-slate-800">{p.nom}</p>
            <p className="text-[10px] text-slate-400">{p.statut} · {p.dateDebut} → {p.dateFin || "?"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-right">
          <p className={`text-xs font-bold tabular-nums ${sante.texte}`}>
            {r.pourcentageMarge.toFixed(0)}% marge
          </p>
          <ChevronRight size={12} className="text-slate-300" />
        </div>
      </div>
      {/* Micro-jauge : budget consommé (coût réel / budget), couleur = santé */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${couleurSanteBudget(r.pourcentageDepense).barre}`}
            style={{ width: `${Math.min(100, r.pourcentageDepense)}%` }}
          />
        </div>
        <span className="shrink-0 text-[9px] font-semibold tabular-nums text-slate-400">
          {r.pourcentageDepense.toFixed(0)}%
        </span>
      </div>
    </button>
  );
});


export function OngletClients({ clients, setClients, ajouterJournal, travaux, setTravaux, projets, setProjets, devisListe, transactionsQb, utilisateurs, tauxMetiers, syncQbEnCours, onSyncQuickBooksProjets, peutSyncQb, fournisseurs, setFournisseurs, clientCible, devisCible, onCreerDevis, onNouvelleVersionDevis, bons, inspections, achatsLibres = [] }) {
  // Taux camion par défaut — pour le coût réel des travaux du client.
  const configClients = useEntreprise();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [entreprise, setEntreprise] = useState("");
  // Nom affiché dans les listes quand nom ET entreprise existent.
  const [nomAffichageChoix, setNomAffichageChoix] = useState("nom");
  const [prenom, setPrenom] = useState("");
  const [nomFamille, setNomFamille] = useState("");
  const [courriel, setCourriel] = useState("");
  const [telephone, setTelephone] = useState("");
  const [termeFacturation, setTermeFacturation] = useState(TERMES_FACTURATION[0]);
  const [adresseFacturation, setAdresseFacturation] = useState(null);
  // 🚪 App./bureau/casier postal — certains clients fonctionnent ainsi.
  const [adresseFacturationApp, setAdresseFacturationApp] = useState("");
  const [dejaSyncQb, setDejaSyncQb] = useState(false);
  const [syncEnCours, setSyncEnCours] = useState(false);
  const [clientOuvertId, setClientOuvertId] = useState(null);
  // ✏️ Fiche client en cours de MODIFICATION (fenêtre d'édition).
  const [clientEnEditionId, setClientEnEditionId] = useState(null);
  // Arrivée depuis la RECHERCHE RAPIDE : le dossier du client visé
  // s'ouvre tout seul (et son devis est mis en évidence par DevisDuClient).
  useEffect(() => {
    if (clientCible) setClientOuvertId(clientCible);
  }, [clientCible, devisCible]);
  // Recherche rapide dans la liste des clients (nom, entreprise,
  // courriel, téléphone, adresse, nº QuickBooks).
  const [rechercheClients, setRechercheClients] = useState("");
  const qClients = rechercheClients.trim().toLowerCase();
  // 📄 Pagination (2026-08-26) : 10 fiches par page — sans recherche,
  // TOUTE la liste s'affichait (mur garanti à 200 clients). Taper une
  // recherche ramène page 1.
  const [pageClients, setPageClients] = useState(1);
  const refListeClients = useRef(null);
  useEffect(() => { setPageClients(1); }, [qClients]);
  const clientsFiltres = !qClients
    ? clients
    : clients.filter((c) =>
        [
          c.nom,
          c.entreprise,
          c.telephone,
          c.quickbooksCustomerId,
          ...(c.courriels || []).map((cc) => cc.email),
          ...(c.adresses || []).map((a) => `${a.nom} ${a.ligne1}`),
        ]
          .filter(Boolean)
          .some((champ) => String(champ).toLowerCase().includes(qClients))
      );
  // Recherche rapide dans « Travaux (passés et à venir) » du client ouvert.
  const [rechercheTravaux, setRechercheTravaux] = useState("");
  const [filtreTravauxStatut, setFiltreTravauxStatut] = useState("tous"); // "tous" | "a_venir" | "complete"
  // Repart à neuf quand on change de client ouvert.
  useEffect(() => {
    setRechercheTravaux("");
    setFiltreTravauxStatut("tous");
  }, [clientOuvertId]);
  const [nouveauCourrielLabel, setNouveauCourrielLabel] = useState("");
  // ✏️ Édition en place d'un courriel existant — { clientId, courrielId, email, label }.
  const [editionCourriel, setEditionCourriel] = useState(null);
  const [nouveauCourrielEmail, setNouveauCourrielEmail] = useState("");

  // ✏️ MODIFIER un courriel existant — y compris le PRINCIPAL (avant,
  // le courriel unique ne pouvait ni s'éditer ni se supprimer : angle
  // mort constaté par le propriétaire, 2026-08-17).
  const modifierCourrielClient = (clientId, courrielId, email, label) => {
    const propre = (email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) return false;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              courriels: (c.courriels || []).map((cc) =>
                cc.id === courrielId ? { ...cc, email: propre, label: (label || "").trim() || cc.label } : cc
              ),
            }
          : c
      )
    );
    ajouterJournal(`✏️ Courriel corrigé sur la fiche : ${propre}`);
    // La fiche QuickBooks suit — plus jamais de divergence.
    synchroniserClientsQbo({ clientId, forcer: true }).catch(() => {});
    return true;
  };

  const ajouterCourrielClient = (clientId) => {
    if (!nouveauCourrielEmail.trim()) return;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              courriels: [
                ...(c.courriels || []),
                {
                  id: `cc-${Date.now()}`,
                  label: nouveauCourrielLabel.trim() || "Autre",
                  email: nouveauCourrielEmail.trim(),
                  defaut: (c.courriels || []).length === 0,
                },
              ],
            }
          : c
      )
    );
    const c = clients.find((x) => x.id === clientId);
    ajouterJournal(`📧 Courriel "${nouveauCourrielLabel.trim() || "Autre"}" ajouté pour ${c?.nom} (${nouveauCourrielEmail.trim()})`);
    synchroniserClientsQbo({ clientId, forcer: true }).catch(() => {});
    setNouveauCourrielLabel("");
    setNouveauCourrielEmail("");
  };

  const retirerCourrielClient = (clientId, courrielId) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const restants = (c.courriels || []).filter((cc) => cc.id !== courrielId);
        // Si on retire celui marqué par défaut, le premier restant
        // reprend automatiquement ce rôle — jamais 0 courriel par
        // défaut tant qu'il en reste au moins un.
        if (restants.length > 0 && !restants.some((cc) => cc.defaut)) restants[0].defaut = true;
        return { ...c, courriels: restants };
      })
    );
  };

  const definirCourrielDefaut = (clientId, courrielId) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, courriels: (c.courriels || []).map((cc) => ({ ...cc, defaut: cc.id === courrielId })) }
          : c
      )
    );
    // Le courriel PAR DÉFAUT est celui que QuickBooks utilise — il suit.
    synchroniserClientsQbo({ clientId, forcer: true }).catch(() => {});
  };

  const [travailOuvertId, setTravailOuvertId] = useState(null);
  const travailOuvert = travaux.find((t) => t.id === travailOuvertId) || null;
  const [projetOuvertId, setProjetOuvertId] = useState(null);
  const projetOuvert = projets.find((p) => p.id === projetOuvertId) || null;
  const [formulaireProjetPourClient, setFormulaireProjetPourClient] = useState(null); // clientId ou null
  const [nouveauProjetNom, setNouveauProjetNom] = useState("");
  const [nouveauProjetDebut, setNouveauProjetDebut] = useState(todayISO());
  const [nouveauProjetFin, setNouveauProjetFin] = useState("");
  const [nouveauProjetAdresseId, setNouveauProjetAdresseId] = useState("");
  const [nouveauProjetNouvelleAdresse, setNouveauProjetNouvelleAdresse] = useState(null);
  // Ventilation du budget PRÉVU (Étape A). Le RÉEL viendra plus tard :
  // les heures depuis l'app employé (travaux), et les coûts matériaux /
  // sous-traitance depuis QuickBooks (rattachés par numéro de projet).
  const [nouveauProjetMoHeures, setNouveauProjetMoHeures] = useState("");
  const [nouveauProjetMoFacture, setNouveauProjetMoFacture] = useState("");
  const [nouveauProjetMoCoutant, setNouveauProjetMoCoutant] = useState("");
  const [nouveauProjetTrHeures, setNouveauProjetTrHeures] = useState("");
  const [nouveauProjetTrFacture, setNouveauProjetTrFacture] = useState("");
  const [nouveauProjetTrCoutant, setNouveauProjetTrCoutant] = useState("");
  const [nouveauProjetMatFacture, setNouveauProjetMatFacture] = useState("");
  const [nouveauProjetMatCoutant, setNouveauProjetMatCoutant] = useState("");
  const [nouveauProjetSousTraitants, setNouveauProjetSousTraitants] = useState([]);
  const nb = (v) => parseFloat(v) || 0;
  const ajouterSousTraitant = () =>
    setNouveauProjetSousTraitants((p) => [...p, { id: `st-${Date.now()}`, nom: "", facture: "", coutant: "" }]);
  const majSousTraitant = (id, champ, val) =>
    setNouveauProjetSousTraitants((p) => p.map((st) => (st.id === id ? { ...st, [champ]: val } : st)));
  const retirerSousTraitant = (id) =>
    setNouveauProjetSousTraitants((p) => p.filter((st) => st.id !== id));
  const totalFactureProjet =
    nb(nouveauProjetMoFacture) + nb(nouveauProjetTrFacture) + nb(nouveauProjetMatFacture) +
    nouveauProjetSousTraitants.reduce((s, st) => s + nb(st.facture), 0);
  const totalCoutantProjet =
    nb(nouveauProjetMoCoutant) + nb(nouveauProjetTrCoutant) + nb(nouveauProjetMatCoutant) +
    nouveauProjetSousTraitants.reduce((s, st) => s + nb(st.coutant), 0);
  const margeProjet = totalFactureProjet - totalCoutantProjet;
  const margePctProjet = totalFactureProjet > 0 ? (margeProjet / totalFactureProjet) * 100 : 0;

  const [nouveauProjetSecteur, setNouveauProjetSecteur] = useState("commercial");
  const creerProjet = (clientId) => {
    if (!nouveauProjetNom.trim() || totalFactureProjet <= 0) return;
    const client = clients.find((c) => c.id === clientId);
    let adresseTravaux = null;
    if (nouveauProjetNouvelleAdresse) {
      adresseTravaux = nouveauProjetNouvelleAdresse.label;
    } else if (nouveauProjetAdresseId) {
      const a = client?.adresses?.find((x) => x.id === nouveauProjetAdresseId);
      if (a) adresseTravaux = `${a.nom} — ${libelleAdresse(a)}`;
    }
    const moHeures = nb(nouveauProjetMoHeures);
    const moCoutant = nb(nouveauProjetMoCoutant);
    const nouveau = {
      id: `projet-${Date.now()}`,
      nom: nouveauProjetNom.trim(),
      clientId,
      adresseTravaux,
      dateDebut: nouveauProjetDebut,
      dateFin: nouveauProjetFin,
      // Secteur CCQ du chantier — chaque tâche du projet en HÉRITE
      // (changeable tâche par tâche à la création).
      secteur: nouveauProjetSecteur === "residentiel" ? "residentiel" : "commercial",
      statut: "À planifier",
      // budgetTotal et tauxHoraireCoutant sont dérivés de la ventilation
      // ci-dessous (le calcul de rentabilité existant s'en sert toujours).
      budgetTotal: totalFactureProjet,
      tauxHoraireCoutant: moHeures > 0 ? moCoutant / moHeures : 45,
      bonsCommande: [],
      // Ventilation du budget PRÉVU. Le RÉEL viendra de l'app employé
      // (heures) et de QuickBooks (matériaux / sous-traitance).
      budgetPrevu: {
        mainOeuvreChantier: { heures: moHeures, facture: nb(nouveauProjetMoFacture), coutant: moCoutant },
        transport: { heures: nb(nouveauProjetTrHeures), facture: nb(nouveauProjetTrFacture), coutant: nb(nouveauProjetTrCoutant) },
        materiaux: { facture: nb(nouveauProjetMatFacture), coutant: nb(nouveauProjetMatCoutant) },
        sousTraitants: nouveauProjetSousTraitants.map((st) => ({ nom: st.nom.trim(), facture: nb(st.facture), coutant: nb(st.coutant) })),
        totalFacture: totalFactureProjet,
        totalCoutant: totalCoutantProjet,
        marge: margeProjet,
      },
    };
    setProjets((prev) => [...prev, nouveau]);
    ajouterJournal(`🏗️ Projet "${nouveau.nom}" créé pour ${client?.nom} — budget ${totalFactureProjet.toFixed(2)} $, marge prévue ${margeProjet.toFixed(2)} $`);
    setNouveauProjetNom("");
    setNouveauProjetDebut(todayISO());
    setNouveauProjetFin("");
    setNouveauProjetMoHeures(""); setNouveauProjetMoFacture(""); setNouveauProjetMoCoutant("");
    setNouveauProjetTrHeures(""); setNouveauProjetTrFacture(""); setNouveauProjetTrCoutant("");
    setNouveauProjetMatFacture(""); setNouveauProjetMatCoutant("");
    setNouveauProjetSousTraitants([]);
    setNouveauProjetAdresseId("");
    setNouveauProjetNouvelleAdresse(null);
    setFormulaireProjetPourClient(null);
  };

  const ajouterBonCommandeProjet = (projetId, bc) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, bonsCommande: [...(p.bonsCommande || []), bc] } : p)));
    const p = projets.find((x) => x.id === projetId);
    ajouterJournal(`📦 BC ${bc.numeroBC} (${bc.montantHT.toFixed(2)} $) ajouté au projet "${p?.nom}"`);
  };

  const changerStatutProjet = (projetId, statut) => {
    setProjets((prev) => prev.map((p) => (p.id === projetId ? { ...p, statut } : p)));
  };

  const reactiverModification = (id, actif) => {
    setTravaux((prev) => prev.map((t) => (t.id === id ? { ...t, modifReactivee: actif } : t)));
    const t = travaux.find((x) => x.id === id);
    ajouterJournal(
      actif
        ? `🔓 Modification réactivée pour l'employé sur « ${t?.titre} »`
        : `🔒 Réactivation retirée sur « ${t?.titre} »`
    );
  };

  const reinitialiserFormulaire = () => {
    setEntreprise("");
    setPrenom("");
    setNomFamille("");
    setCourriel("");
    setTelephone("");
    setTermeFacturation(TERMES_FACTURATION[0]);
    setAdresseFacturation(null);
    setAdresseFacturationApp("");
    setNomAffichageChoix("nom");
  };

  // PERSONNE OU ENTREPRISE (retour de tests 2026-08-17) : bien des
  // clients n'ont qu'un nom d'entreprise — l'un OU l'autre débloque.
  // TÉLÉPHONE désormais obligatoire (il voyage jusqu'au technicien).
  const personneRemplie = !!(prenom.trim() && nomFamille.trim());
  const peutCreer = (personneRemplie || entreprise.trim()) && courriel.trim() && telephone.trim();
  const raisonsCreation = [];
  if (!personneRemplie && !entreprise.trim()) raisonsCreation.push("une personne (prénom + nom) OU une entreprise");
  if (!courriel.trim()) raisonsCreation.push("un courriel");
  if (!telephone.trim()) raisonsCreation.push("un téléphone");
  // Erreurs de validation bloquantes avant le transfert vers QuickBooks.
  const [erreursCreation, setErreursCreation] = useState([]);

  const creerClient = () => {
    if (!peutCreer) return;
    // Conformité : aucune donnée invalide ne part vers QuickBooks —
    // courriel au bon format et adresse complète (ligne + ville) exigés.
    const erreurs = erreursClientPourQuickBooks({ courriel, adresse: adresseFacturation });
    if (erreurs.length > 0) {
      setErreursCreation(erreurs);
      return;
    }
    setErreursCreation([]);
    const id = `c-${Date.now()}`;
    const nouveauClient = {
      id,
      entreprise: entreprise.trim(),
      // Entreprise seule : elle sert de nom ET d'affichage — aucune
      // fiche « sans nom » ne circule (listes, QuickBooks, documents).
      nomAffichage: personneRemplie ? (entreprise.trim() ? nomAffichageChoix : "nom") : "entreprise",
      nom: personneRemplie ? `${prenom.trim()} ${nomFamille.trim()}` : entreprise.trim(),
      courriels: [{ id: `cc-${Date.now()}`, label: "Principal", email: courriel.trim(), defaut: true }],
      telephone: telephone.trim(),
      termeFacturation,
      // 🚪 L'unité suit l'adresse partout : chaîne de facturation (QB et
      // documents) ET fiche d'adresse (champ appartement).
      adresseFacturation: adresseFacturation
        ? [adresseFacturation.label, adresseFacturationApp.trim() ? `app. ${adresseFacturationApp.trim()}` : ""].filter(Boolean).join(", ")
        : "",
      adresses: adresseFacturation
        ? [{ id: `a-${Date.now()}`, nom: "Facturation", ligne1: adresseFacturation.label, ...(adresseFacturationApp.trim() ? { appartement: adresseFacturationApp.trim() } : {}), codePostal: adresseFacturation.codePostal }]
        : [],
      quickbooksCustomerId: null,
      syncQb: "en_cours",
    };
    setClients((prev) => [...prev, nouveauClient]);
    ajouterJournal(`👤 Client "${nouveauClient.nom}" créé — transfert vers QuickBooks en cours...`);
    setFormulaireOuvert(false);
    reinitialiserFormulaire();

    // VRAI transfert QuickBooks (2026-08-15) — décision du propriétaire :
    // TOUS les clients existent dans QuickBooks (sa pratique d'avant,
    // quand ses devis s'y faisaient). Persistance d'abord, puis liaison.
    sauvegarderClient(nouveauClient)
      .then(() => synchroniserClientsQbo({ clientId: id }))
      .then((r) => {
        if (r?.fait > 0) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "synchronise" } : c)));
          ajouterJournal(`🔄 Client "${nouveauClient.nom}" créé/relié dans QuickBooks (Sandbox)`);
        } else if (r?.simule) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🧪 QuickBooks non configuré ici — client local seulement (normal en développement)");
        } else if (r?.nonConnecte) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🔌 QuickBooks non connecté — le client sera repris par « Synchroniser les clients » (Paramètres → Connexions)");
        } else {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal(`⚠️ Client "${nouveauClient.nom}" non transféré : ${(r?.erreurs || [])[0] || r?.erreur || "erreur"} — repris plus tard par la synchronisation`);
        }
      })
      .catch(() => ajouterJournal(`⚠️ Client "${nouveauClient.nom}" enregistré localement mais transfert QuickBooks à reprendre`));
  };

  // ⬇️ VRAIE DESCENTE QuickBooks → Fluxya (2026-08-29 — remplace la
  // simulation de démonstration qui vivait ici depuis les débuts et
  // inventait un faux client). Décision du propriétaire : TOUS les
  // clients de QuickBooks — « si le client appelle, qu'il soit facile à
  // retrouver ». La route relie les homonymes (jamais de doublon) et
  // crée les fiches manquantes ; le Realtime rafraîchit la liste seul.
  const synchroniserDepuisQuickbooks = async () => {
    if (syncEnCours) return;
    setSyncEnCours(true);
    const r = await synchroniserClientsQbo({ descendre: true });
    setSyncEnCours(false);
    if (r?.erreur || r?.nonConnecte || r?.simule) {
      ajouterJournal(
        `⚠️ Descente des clients QuickBooks impossible : ${r?.erreur || (r?.nonConnecte ? "QuickBooks non connecté (Paramètres → Connexions)" : "mode simulé — clés absentes")}`
      );
      return;
    }
    setDejaSyncQb(true);
    if ((r?.crees || 0) === 0 && (r?.relies || 0) === 0) {
      ajouterJournal(`✅ Clients à jour avec QuickBooks — ${r?.totalQb ?? 0} clients vérifiés, rien de nouveau.`);
      return;
    }
    ajouterJournal(
      `⬇️ Clients QuickBooks descendus : ${r?.crees || 0} fiche${(r?.crees || 0) > 1 ? "s" : ""} créée${(r?.crees || 0) > 1 ? "s" : ""}, ${r?.relies || 0} reliée${(r?.relies || 0) > 1 ? "s" : ""} par nom (sur ${r?.totalQb ?? 0} clients QuickBooks).`
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Clients</h2>
        {/* 🔐 Règle du propriétaire (2026-08-30) : les synchronisations
            de CLIENTS sont ouvertes aux Admin principal ET régulier —
            seul ce qui touche les PRIX reste à l'Admin principal. */}
        <Button
          variant="outline"
          onClick={peutSyncQb ? synchroniserDepuisQuickbooks : undefined}
          disabled={!peutSyncQb}
          loading={syncEnCours}
          title={peutSyncQb ? undefined : "Réservé aux administrateurs"}
          className="min-h-0 px-3 py-1.5 text-xs"
        >
          {!syncEnCours && (peutSyncQb ? <RefreshCw size={13} /> : <Lock size={13} />)}
          {dejaSyncQb ? "✓ Synchroniser depuis QuickBooks" : "Synchroniser depuis QuickBooks"}
        </Button>
      </div>

      {/* "NOUVEAU CLIENT" — toujours en premier dans la liste */}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white">
        <button
          onClick={() => setFormulaireOuvert((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6A13]/10">
            <UserPlus size={18} className="text-[#FF6A13]" />
          </div>
          <span className="font-bold text-slate-800">Nouveau client</span>
        </button>

        {formulaireOuvert && (
          <div className="space-y-3 border-t border-slate-200 p-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nom d'entreprise (optionnel)</label>
              <input
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                placeholder="Ex: Toitures Lavallée inc."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {/* NOM AFFICHÉ (retour de tests) : avec une entreprise, on
                  choisit ce que les listes montrent. */}
              {entreprise.trim() && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Nom affiché dans les listes</p>
                  <div className="flex flex-wrap gap-3">
                    {[["nom", "Nom de la personne"], ["entreprise", "Entreprise"], ["nom-entreprise", "Nom — Entreprise"]].map(([val, lib]) => (
                      <label key={val} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                        <input
                          type="radio"
                          name="nom-affichage-client"
                          checked={nomAffichageChoix === val}
                          onChange={() => setNomAffichageChoix(val)}
                        />
                        {lib}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Prénom</label>
                <input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Nom</label>
                <input
                  value={nomFamille}
                  onChange={(e) => setNomFamille(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Adresse de facturation</label>
              <AutocompleteAdresse onSelection={setAdresseFacturation} />
              {adresseFacturation && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <Check size={12} /> {adresseFacturation.label}
                </p>
              )}
              <input
                value={adresseFacturationApp}
                onChange={(e) => setAdresseFacturationApp(e.target.value)}
                placeholder="App. / bureau / casier postal (facultatif)"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Terme de facturation</label>
              <select
                value={termeFacturation}
                onChange={(e) => setTermeFacturation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                {TERMES_FACTURATION.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Courriel</label>
                <input
                  type="email"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Téléphone</label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {(() => {
              const nomSaisi = nomClientNormalise(`${prenom} ${nomFamille}`);
              const doublon =
                nomSaisi.length > 3 && (clients || []).find((c) => nomClientNormalise(c.nom) === nomSaisi);
              return doublon ? (
                <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  ⚠️ Un client nommé <span className="font-extrabold">{doublon.nom}</span> existe déjà — vérifie sa
                  fiche avant de créer un doublon (les devis et tâches se rattachent par client).
                </p>
              ) : null;
            })()}
            {erreursCreation.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-red-700">
                  <AlertCircle size={14} /> Envoi vers QuickBooks bloqué — corrige d'abord :
                </p>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-red-700">
                  {erreursCreation.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {raisonsCreation.length > 0 && (
              <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
                Pour créer le client, il manque : {raisonsCreation.join(" · ")}.
              </p>
            )}
            <Button onClick={creerClient} disabled={!peutCreer} className="w-full">
              Créer le client et transférer vers QuickBooks
            </Button>
          </div>
        )}
      </div>

      {/* RECHERCHE RAPIDE DE CLIENTS */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          value={rechercheClients}
          onChange={(e) => setRechercheClients(e.target.value)}
          placeholder="Rechercher un client (nom, entreprise, courriel, téléphone, adresse…)"
          className="w-full text-sm outline-none"
        />
        {rechercheClients && (
          <button onClick={() => setRechercheClients("")} aria-label="Effacer la recherche">
            <X size={14} className="text-slate-400" />
          </button>
        )}
        {qClients && (
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
            {clientsFiltres.length}/{clients.length}
          </span>
        )}
      </div>

      {/* LISTE DES CLIENTS EXISTANTS */}
      <div ref={refListeClients} className="space-y-2">
        {qClients && clientsFiltres.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
            Aucun client ne correspond à « {rechercheClients.trim()} ».
          </p>
        )}
        {clientEnEditionId && (() => {
          const cible = clients.find((x) => x.id === clientEnEditionId);
          if (!cible) return null;
          return (
            <ModalEditionClient
              client={cible}
              onFermer={() => setClientEnEditionId(null)}
              onEnregistrer={(champs) => {
                setClients((prev) => prev.map((x) => (x.id === cible.id ? { ...x, ...champs } : x)));
                ajouterJournal(`✏️ Fiche client modifiée : ${champs.entreprise && champs.nomAffichage !== "nom" ? champs.entreprise : champs.nom}`);
              }}
            />
          );
        })()}
        {clientsFiltres.slice((Math.min(pageClients, Math.max(1, Math.ceil(clientsFiltres.length / ITEMS_PAR_PAGE))) - 1) * ITEMS_PAR_PAGE, Math.min(pageClients, Math.max(1, Math.ceil(clientsFiltres.length / ITEMS_PAR_PAGE))) * ITEMS_PAR_PAGE).map((c) => {
          const ouvert = clientOuvertId === c.id;
          return (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white">
              <button
                onClick={() => setClientOuvertId(ouvert ? null : c.id)}
                className="flex w-full items-start justify-between gap-2 p-3.5 text-left"
              >
                <p className="text-sm font-bold text-slate-900">{c.nom}</p>
                {c.quickbooksCustomerId ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {c.quickbooksCustomerId}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    Synchronisation...
                  </span>
                )}
              </button>

              {ouvert && (
                <div className="space-y-1.5 border-t border-slate-100 px-3.5 pb-3.5 pt-2 text-xs text-slate-500">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-extrabold text-[#131B2E]">{c.entreprise || "Particulier (aucune entreprise)"}</p>
                    <button
                      onClick={() => setClientEnEditionId(c.id)}
                      className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      ✏️ Modifier la fiche
                    </button>
                  </div>
                  {/* ADRESSE DE FACTURATION — la règle : champ explicite,
                      sinon l'adresse PRINCIPALE (première de la fiche). */}
                  <p className="flex items-center gap-1.5">
                    🧾 <span className="font-bold text-slate-600">Facturation :</span>
                    {adresseFacturationClient(c) || <span className="italic text-amber-600">aucune adresse — à compléter via ✏️</span>}
                  </p>

                  <div className="space-y-1 rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Courriels ({(c.courriels || []).length})</p>
                    {(c.courriels || []).map((cc) =>
                      editionCourriel?.courrielId === cc.id && editionCourriel?.clientId === c.id ? (
                        <div key={cc.id} className="flex items-center gap-1.5">
                          <input
                            value={editionCourriel.email}
                            onChange={(e) => setEditionCourriel((prev) => ({ ...prev, email: e.target.value }))}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                          />
                          <input
                            value={editionCourriel.label}
                            onChange={(e) => setEditionCourriel((prev) => ({ ...prev, label: e.target.value }))}
                            placeholder="Étiquette"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                          />
                          <button
                            onClick={() => {
                              if (modifierCourrielClient(c.id, cc.id, editionCourriel.email, editionCourriel.label)) setEditionCourriel(null);
                            }}
                            className="shrink-0 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white"
                          >
                            OK
                          </button>
                          <button onClick={() => setEditionCourriel(null)} className="shrink-0 text-slate-400"><X size={12} /></button>
                        </div>
                      ) : (
                        <div key={cc.id} className="flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Mail size={11} className="shrink-0" />
                            <span>{cc.email}</span>
                            <span className="text-[10px] text-slate-400">({cc.label})</span>
                            {cc.defaut && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">Défaut</span>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => setEditionCourriel({ clientId: c.id, courrielId: cc.id, email: cc.email, label: cc.label || "" })}
                              className="text-slate-300 hover:text-slate-600"
                              title="Modifier ce courriel"
                            >
                              ✏️
                            </button>
                            {!cc.defaut && (
                              <button onClick={() => definirCourrielDefaut(c.id, cc.id)} className="text-[10px] font-semibold text-blue-600">
                                Définir par défaut
                              </button>
                            )}
                            {(c.courriels || []).length > 1 && (
                              <button onClick={() => retirerCourrielClient(c.id, cc.id)} className="text-slate-300 hover:text-red-500">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    )}
                    <div className="mt-1.5 grid grid-cols-3 gap-1">
                      <input
                        value={nouveauCourrielLabel}
                        onChange={(e) => setNouveauCourrielLabel(e.target.value)}
                        placeholder="Ex: Projet X"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                      />
                      <input
                        type="email"
                        value={nouveauCourrielEmail}
                        onChange={(e) => setNouveauCourrielEmail(e.target.value)}
                        placeholder="courriel@..."
                        className="col-span-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                      />
                      <Button variant="outline" onClick={() => ajouterCourrielClient(c.id)} className="min-h-0 gap-1 py-1 text-[10px]">
                        <Plus size={10} /> Ajouter
                      </Button>
                    </div>
                  </div>

                  {c.telephone && (
                    <div className="flex items-center gap-1.5"><Phone size={11} /> {c.telephone}</div>
                  )}
                  {c.termeFacturation && (
                    <div className="flex items-center gap-1.5"><CreditCard size={11} /> {c.termeFacturation}</div>
                  )}
                  {/* 📌 La note générale SAUTE AUX YEUX sur la carte —
                      c'est sa raison d'être : le problème noté se voit
                      sans ouvrir la fiche. */}
                  {c.note && (
                    <p className="mt-1 whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800">
                      📌 {c.note}
                    </p>
                  )}

                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                      <ClipboardList size={12} /> Travaux (passés et à venir)
                    </p>
                    {travaux.filter((t) => t.clientId === c.id || (t.clientNom && t.clientNom === c.nom)).length === 0 ? (
                      <p className="text-xs text-slate-400">Aucun travail enregistré pour ce client.</p>
                    ) : (
                      <>
                        {/* RECHERCHE RAPIDE dans les travaux du client */}
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <div className="flex min-w-[160px] flex-1 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                            <Search size={12} className="shrink-0 text-slate-400" />
                            <input
                              value={rechercheTravaux}
                              onChange={(e) => setRechercheTravaux(e.target.value)}
                              placeholder="Rechercher un travail (titre, date, note…)"
                              className="w-full text-xs outline-none"
                            />
                            {rechercheTravaux && (
                              <button onClick={() => setRechercheTravaux("")} aria-label="Effacer la recherche">
                                <X size={12} className="text-slate-400" />
                              </button>
                            )}
                          </div>
                          {[["tous", "Tous"], ["a_venir", "À venir"], ["complete", "Complétés"]].map(([val, label]) => (
                            <button
                              key={val}
                              onClick={() => setFiltreTravauxStatut(val)}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                filtreTravauxStatut === val ? "bg-[#131B2E] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const q = rechercheTravaux.trim().toLowerCase();
                          const listeFiltree = travaux
                            .filter((t) => t.clientId === c.id || (t.clientNom && t.clientNom === c.nom))
                            .filter((t) =>
                              filtreTravauxStatut === "tous"
                                ? true
                                : filtreTravauxStatut === "complete"
                                ? t.statut === "complete"
                                : t.statut !== "complete"
                            )
                            .filter((t) =>
                              !q
                                ? true
                                : [t.titre, t.date, t.noteTerrain, t.noteInterne]
                                    .filter(Boolean)
                                    .some((champ) => champ.toLowerCase().includes(q))
                            )
                            .sort((a, b) => a.date.localeCompare(b.date));
                          if (listeFiltree.length === 0) {
                            return (
                              <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-center text-xs text-slate-400">
                                Aucun travail ne correspond à la recherche.
                              </p>
                            );
                          }
                          return (
                            <div className="overflow-hidden rounded-lg border border-slate-100">
                              {listeFiltree.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setTravailOuvertId(t.id)}
                              className="flex w-full items-center justify-between gap-2 border-b border-slate-100 bg-white px-2.5 py-2 text-left last:border-0 hover:bg-slate-50"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-800">{t.titre}</p>
                                <p className="text-[10px] text-slate-400">{t.date}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                    t.statut === "complete"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-orange-100 text-[#B14E0E]"
                                  }`}
                                >
                                  {t.statut === "complete" ? "COMPLÉTÉ" : "À VENIR"}
                                </span>
                                <ChevronRight size={13} className="text-slate-300" />
                              </div>
                            </button>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                        <Briefcase size={12} /> Projets / chantiers
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setFormulaireProjetPourClient(formulaireProjetPourClient === c.id ? null : c.id)}
                        className="min-h-0 gap-1 px-2 py-1 text-[10px]"
                      >
                        <Plus size={10} /> Créer un projet
                      </Button>
                    </div>

                    {formulaireProjetPourClient === c.id && (
                      <div className="mb-2 space-y-1.5 rounded-lg bg-slate-50 p-2">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Nom du projet</label>
                          <input value={nouveauProjetNom} onChange={(e) => setNouveauProjetNom(e.target.value)} placeholder="Nom du projet" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        </div>

                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse des travaux</label>
                          {(c.adresses || []).length > 0 && (
                            <select
                              value={nouveauProjetAdresseId}
                              onChange={(e) => { setNouveauProjetAdresseId(e.target.value); setNouveauProjetNouvelleAdresse(null); }}
                              className="mb-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            >
                              <option value="">— Choisir une adresse enregistrée —</option>
                              {(c.adresses || []).map((a) => (
                                <option key={a.id} value={a.id}>{a.nom} — {libelleAdresse(a)}</option>
                              ))}
                            </select>
                          )}
                          <AutocompleteAdresse
                            onSelection={(place) => { setNouveauProjetNouvelleAdresse(place); setNouveauProjetAdresseId(""); }}
                          />
                          {nouveauProjetNouvelleAdresse && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                              <Check size={10} /> {nouveauProjetNouvelleAdresse.label}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Secteur CCQ du chantier</label>
                            <div className="mb-2 flex gap-1.5">
                              {[["commercial", "🏢 Commercial"], ["residentiel", "🏠 Résidentiel"]].map(([val, lib]) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setNouveauProjetSecteur(val)}
                                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${
                                    nouveauProjetSecteur === val ? "border-[#131B2E] bg-[#131B2E] text-white" : "border-slate-300 bg-white text-slate-600"
                                  }`}
                                >
                                  {lib}
                                </button>
                              ))}
                            </div>
                            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date de début</label>
                            <input type="date" value={nouveauProjetDebut} onChange={(e) => setNouveauProjetDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date de fin</label>
                            <input type="date" value={nouveauProjetFin} onChange={(e) => setNouveauProjetFin(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                        <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">Heures — prévu vs réel (suivi)</p>
                          <p className="mb-1.5 text-[9px] text-blue-500">Le réel se remplit au fur et à mesure que les techniciens pointent (app employé). Aucun impact sur les montants $.</p>
                          <div className="grid grid-cols-[1fr_3rem_3rem_2.75rem] items-center gap-1.5">
                            <span></span>
                            <span className="text-center text-[9px] font-bold uppercase text-blue-600">Prévu</span>
                            <span className="text-center text-[9px] font-bold uppercase text-blue-600">Réel</span>
                            <span className="text-center text-[9px] font-bold uppercase text-blue-600">Reste</span>

                            <span className="text-[10px] font-bold text-blue-900">Chantier</span>
                            <input type="number" min={0} step="0.5" value={nouveauProjetMoHeures} onChange={(e) => setNouveauProjetMoHeures(e.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-1.5 py-1 text-center text-xs" />
                            <input value="0" readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 text-center text-xs text-slate-500" />
                            <span className="text-center text-[11px] font-bold text-emerald-600">{nb(nouveauProjetMoHeures)} h</span>

                            <span className="text-[10px] font-bold text-blue-900">Transport</span>
                            <input type="number" min={0} step="0.5" value={nouveauProjetTrHeures} onChange={(e) => setNouveauProjetTrHeures(e.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-1.5 py-1 text-center text-xs" />
                            <input value="0" readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-1.5 py-1 text-center text-xs text-slate-500" />
                            <span className="text-center text-[11px] font-bold text-emerald-600">{nb(nouveauProjetTrHeures)} h</span>
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Ventilation du budget ($)</p>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Main d'œuvre chantier</p>
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMoFacture} onChange={(e) => setNouveauProjetMoFacture(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMoCoutant} onChange={(e) => setNouveauProjetMoCoutant(e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Transport</p>
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetTrFacture} onChange={(e) => setNouveauProjetTrFacture(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetTrCoutant} onChange={(e) => setNouveauProjetTrCoutant(e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Matériaux</p>
                            <p className="text-[9px] text-slate-400">Coût réel à venir depuis QuickBooks (nº de projet).</p>
                            <div className="mt-1 grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMatFacture} onChange={(e) => setNouveauProjetMatFacture(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                <input type="number" min={0} step="0.01" value={nouveauProjetMatCoutant} onChange={(e) => setNouveauProjetMatCoutant(e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-2">
                            <p className="text-[11px] font-bold text-slate-700">Sous-traitants</p>
                            <p className="text-[9px] text-slate-400">Coût réel à venir depuis QuickBooks (nº de projet).</p>
                            {nouveauProjetSousTraitants.map((st) => (
                              <div key={st.id} className="mt-1.5 rounded-md bg-slate-50 p-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input value={st.nom} onChange={(e) => majSousTraitant(st.id, "nom", e.target.value)} placeholder="Nom de l'entreprise" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                                  <button type="button" onClick={() => retirerSousTraitant(st.id)} className="shrink-0 rounded-md p-1 text-red-500 hover:bg-red-50" aria-label="Retirer le sous-traitant">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <div className="mt-1 grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="mb-0.5 block text-[9px] font-bold text-slate-400">Facturé $</label>
                                    <input type="number" min={0} step="0.01" value={st.facture} onChange={(e) => majSousTraitant(st.id, "facture", e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                                  </div>
                                  <div>
                                    <label className="mb-0.5 block text-[9px] font-bold text-orange-500">Coûtant $</label>
                                    <input type="number" min={0} step="0.01" value={st.coutant} onChange={(e) => majSousTraitant(st.id, "coutant", e.target.value)} className="w-full rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs" />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={ajouterSousTraitant} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                              <Plus size={11} /> Ajouter un sous-traitant
                            </button>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-200 pt-2 text-center">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Facturé</p>
                              <p className="text-xs font-extrabold text-slate-800 tabular-nums">{totalFactureProjet.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-orange-500">Coûtant</p>
                              <p className="text-xs font-extrabold text-orange-700 tabular-nums">{totalCoutantProjet.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Marge</p>
                              <p className="text-xs font-extrabold text-emerald-700 tabular-nums">{margeProjet.toFixed(0)} $ · {margePctProjet.toFixed(0)} %</p>
                            </div>
                          </div>
                        </div>
                        <Button onClick={() => creerProjet(c.id)} disabled={!nouveauProjetNom.trim() || totalFactureProjet <= 0} className="w-full min-h-0 py-1.5 text-xs">
                          Créer le projet
                        </Button>
                      </div>
                    )}

                    {/* REGISTRE D'ÉQUIPEMENTS — se remplit tout seul à
                        partir des appels de service : le technicien
                        relève modèle et numéro de série, ils atterrissent
                        ici. Dans deux ans, quand ce client rappelle, on
                        sait déjà ce qu'il a. Sert aussi à partir avec la
                        bonne pièce et à retrouver les clients touchés par
                        un rappel de fabricant. */}
                    {(() => {
                      const unites = [];
                      // Toutes les unités de chaque bon (un immeuble peut
                      // en avoir 3) — avant, seule la première comptait.
                      // L'EMPLACEMENT (« RTU toit côté nord », 2026-08-19)
                      // suit et se complète au fil des visites.
                      (bons || [])
                        .filter((b) => b.client === c.nom)
                        .forEach((b) => {
                          const listeU =
                            Array.isArray(b.unites) && b.unites.length > 0
                              ? b.unites
                              : b.modeleUnite || b.serieUnite
                                ? [{ modele: b.modeleUnite, serie: b.serieUnite }]
                                : [];
                          listeU.forEach((ub) => {
                            if (!(ub.modele || ub.serie || ub.emplacement)) return;
                            const cle = `${ub.modele || ""}|${ub.serie || ""}`;
                            const existe = unites.find((u) => `${u.modele || ""}|${u.serie || ""}` === cle);
                            if (existe) {
                              if (b.date > existe.derniereVisite) existe.derniereVisite = b.date;
                              if (ub.emplacement && !existe.emplacement) existe.emplacement = ub.emplacement;
                            } else {
                              unites.push({ modele: ub.modele, serie: ub.serie, emplacement: ub.emplacement || "", derniereVisite: b.date });
                            }
                          });
                        });
                      if (unites.length === 0) return null;
                      return (
                        <div className="mb-2 rounded-xl border border-slate-200 bg-white p-2.5">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            <Cloud size={11} /> Équipements relevés ({unites.length})
                          </p>
                          <div className="space-y-1">
                            {unites.map((u, i) => (
                              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                                <span className="text-[11px] font-bold text-slate-700">
                                  {u.emplacement ? <span className="mr-1.5 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-bold text-slate-600">📍 {u.emplacement}</span> : null}
                                  {u.modele || "Modèle non relevé"}
                                  {u.serie ? <span className="ml-1.5 font-normal text-slate-500">Nº {u.serie}</span> : null}
                                </span>
                                <span className="text-[10px] text-slate-400">vu le {u.derniereVisite}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ============================================================
                        💵 COÛT DES TRAVAUX DU CLIENT — SANS BESOIN DE PROJET
                        (2026-08-25, demande du propriétaire : « où voit-on
                        les coûts par client si on ne voit pas les projets ? »)
                        ------------------------------------------------------------
                        Le bloc « Rentabilité » ci-dessous n'apparaît que si le
                        client a des PROJETS — or presque tous les clients n'en
                        ont pas : appels de service et temps-et-matériel. Leurs
                        chiffres existaient (bons + heures) mais restaient
                        invisibles ici. Même calcul que l'analyse « par client »
                        du tableau de bord : facturé (factures émises), coût
                        réel (heures pointées × taux FIGÉ + camion selon
                        l'inspection du matin + matériel au coûtant du devis
                        lié). Écran ADMIN uniquement — jamais sur un document
                        client. */}
                    {(() => {
                      const bonsDuClient = (bons || []).filter((b) => b.client === c.nom);
                      if (bonsDuClient.length === 0) return null;
                      const camionDefautClient = Number(configClients?.coutCamionHoraire) || 0;
                      const cumul = { facture: 0, cout: 0, heures: 0, jobs: 0 };
                      const tachesVues = new Set();
                      bonsDuClient.forEach((b) => {
                        cumul.facture += (b.facturesEmises || []).reduce((s, f) => s + (Number(f.montant) || 0), 0);
                        const cleTache = b.tacheId || b.id;
                        if (tachesVues.has(cleTache)) return; // heures/matériel comptés UNE fois par tâche
                        tachesVues.add(cleTache);
                        cumul.jobs += 1;
                        const lignesHeures = (travaux || []).filter(
                          (t) => String(t.tacheId || "").split("::")[0] === b.tacheId && (t.categorieHeures || "projet") === "projet"
                        );
                        lignesHeures.forEach((t) => {
                          const h = Number(t.heures) || 0;
                          cumul.heures += h;
                          cumul.cout += h * (Number(t.tauxCoutantFige) || 0);
                          const insp = (inspections || []).find(
                            (i) =>
                              i.date === t.date &&
                              !i.sansVehicule &&
                              !i.passagerDeNom &&
                              (i.technicienEmail && t.employeEmail ? i.technicienEmail === t.employeEmail : i.technicienNom === t.employeNom)
                          );
                          if (insp) cumul.cout += h * (insp.coutCamionHoraire != null ? insp.coutCamionHoraire : camionDefautClient);
                        });
                        const devisLie = b.devisNumero ? (devisListe || []).find((d) => d.numero === b.devisNumero) : null;
                        if (devisLie) {
                          cumul.cout += (devisLie.lignes || [])
                            .filter((l) => !l.estRabais)
                            .reduce((s, l) => s + (Number(l.prix_coutant) || 0) * (Number(l.quantite) || 1), 0);
                        }
                        // 📦 Matériel du stock (coût standard posé sur le
                        // bon) + 🧾 achats rattachés à la tâche (part
                        // attribuée) — les deux chemins du matériel.
                        cumul.cout += (b.materielStock || []).reduce(
                          (s, it) => s + (Number(it.coutant) || 0) * (Number(it.quantite) || 1),
                          0
                        );
                        cumul.cout += (achatsLibres || [])
                          .filter((a) => a.tacheId && a.tacheId === b.tacheId)
                          .reduce((s, a) => s + (a.montantAttribue != null ? a.montantAttribue : a.montantHT), 0);
                      });
                      const profit = cumul.facture - cumul.cout;
                      const marge = cumul.facture > 0 ? (profit / cumul.facture) * 100 : null;
                      return (
                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            💵 Coût des travaux — {cumul.jobs} tâche{cumul.jobs > 1 ? "s" : ""} · {cumul.heures.toFixed(1)} h
                          </p>
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Facturé</p>
                              <p className="text-xs font-extrabold tabular-nums text-slate-800">{cumul.facture.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-orange-500">Coût réel</p>
                              <p className="text-xs font-extrabold tabular-nums text-orange-600">{cumul.cout.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Profit</p>
                              <p className={`text-xs font-extrabold tabular-nums ${profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{profit.toFixed(0)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Marge</p>
                              <p className={`text-xs font-extrabold tabular-nums ${marge != null && marge < (Number(configClients?.seuilMargeAlerte) || 25) ? "text-red-600" : "text-emerald-700"}`}>
                                {marge != null ? `${marge.toFixed(0)} %` : "—"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] leading-snug text-slate-400">
                            Heures pointées × taux figés + camion (inspection du jour) + matériel : coûtant du devis lié,
                            stock au coût standard et achats rattachés (part attribuée).
                            {cumul.facture === 0 ? " Rien de facturé encore — le coût court déjà." : ""}
                          </p>
                        </div>
                      );
                    })()}

                    {/* RENTABILITÉ DU CLIENT — coûtant vs vendant sur
                        l'ensemble de ses projets. Le coûtant vient des
                        heures réelles à taux FIGÉ + les matériaux (bons
                        de commande et dépenses QuickBooks, sans double
                        comptage) ; le vendant, du montant vendu.
                        Écran ADMIN uniquement : ces chiffres ne sortent
                        jamais sur un devis ni sur un bon de travail. */}
                    {(() => {
                      const projetsDuClient = projets.filter((p) => p.clientId === c.id);
                      if (projetsDuClient.length === 0) return null;
                      const cumul = projetsDuClient.reduce(
                        (acc, p) => {
                          const r = calculerRentabiliteProjet(p, travaux, transactionsQb, utilisateurs, tauxMetiers);
                          acc.vendant += Number(p.budgetTotal) || 0;
                          acc.coutant += r.coutTotalReel || 0;
                          return acc;
                        },
                        { vendant: 0, coutant: 0 }
                      );
                      const profit = cumul.vendant - cumul.coutant;
                      const marge = cumul.vendant > 0 ? (profit / cumul.vendant) * 100 : null;
                      const bon = profit >= 0;
                      return (
                        <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                            <BarChart3 size={11} /> Rentabilité — {projetsDuClient.length} projet{projetsDuClient.length > 1 ? "s" : ""}
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Vendant</p>
                              <p className="text-xs font-bold tabular-nums text-slate-800">{cumul.vendant.toFixed(2)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-orange-500">Coûtant</p>
                              <p className="text-xs font-bold tabular-nums text-orange-600">{cumul.coutant.toFixed(2)} $</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Profit</p>
                              <p className={`text-xs font-extrabold tabular-nums ${bon ? "text-emerald-600" : "text-red-600"}`}>
                                {profit.toFixed(2)} $
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Marge</p>
                              <p className={`text-xs font-extrabold tabular-nums ${bon ? "text-emerald-600" : "text-red-600"}`}>
                                {marge != null ? `${marge.toFixed(1)} %` : "—"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] text-slate-400">
                            Marge = (vendant − coûtant) ÷ vendant · coûtant calculé aux taux figés à la saisie
                          </p>
                        </div>
                      );
                    })()}

                    {(() => {
                      const projetsDuClient = projets.filter((p) => p.clientId === c.id);
                      return projetsDuClient.length === 0 ? (
                        <p className="text-xs text-slate-400">Aucun projet pour ce client.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {projetsDuClient.map((p) => (
                            <LigneProjetClient
                              key={p.id}
                              p={p}
                              travaux={travaux}
                              transactionsQb={transactionsQb}
                              utilisateurs={utilisateurs}
                              tauxMetiers={tauxMetiers}
                              onOuvrir={setProjetOuvertId}
                            />
                          ))}
                        </div>
                      );
                    })()}

                    {/* DEVIS DU CLIENT — chaque dossier avec ses versions.
                        C'est ici qu'on retrouve les devis, plutôt que dans
                        une grande liste générale qui devient vite illisible. */}
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Devis ({(devisListe || []).filter((d) => d.clientId === c.id).length})
                        </p>
                        {/* Amène à l'éditeur de devis avec CE client déjà
                            choisi. On n'y recopie pas un mini-formulaire :
                            l'éditeur porte la recherche dans le catalogue,
                            les marges, les versions et les conditions —
                            deux copies finiraient par ne plus donner le
                            même prix selon la porte d'entrée utilisée. */}
                        <Button
                          variant="outline"
                          onClick={() => onCreerDevis?.(c.id)}
                          className="min-h-0 gap-1 px-2 py-1 text-[10px]"
                        >
                          <Plus size={10} /> Créer un devis
                        </Button>
                      </div>
                      <DevisDuClient devisListe={devisListe} clientId={c.id} surlignerNumero={devisCible} compact onNouvelleVersion={onNouvelleVersionDevis} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <BarrePagination total={clientsFiltres.length} page={pageClients} onPage={setPageClients} refHaut={refListeClients} libelle="clients" />
      </div>

      {travailOuvert && (
        <DetailTravail
          travail={travailOuvert}
          clients={clients}
          onFermer={() => setTravailOuvertId(null)}
          onReactiver={reactiverModification}
        />
      )}
      {projetOuvert && (
        <ModalDetailProjet
          inspections={inspections}
          onMajMateriel={(liste) => setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, materielStock: liste } : px)))}
          onMajReprise={(reprise) => setProjets((prev) => prev.map((px) => (px.id === projetOuvert.id ? { ...px, reprise } : px)))}
          projet={projetOuvert}
          travaux={travaux}
          devisListe={devisListe}
          transactionsQb={transactionsQb}
          clients={clients}
          utilisateurs={utilisateurs}
          tauxMetiers={tauxMetiers}
          onFermer={() => setProjetOuvertId(null)}
          onAjouterBC={ajouterBonCommandeProjet}
          onChangerStatut={changerStatutProjet}
          onSyncQuickBooks={onSyncQuickBooksProjets}
          peutSyncQb={peutSyncQb}
          syncQbEnCours={syncQbEnCours}
          fournisseurs={fournisseurs}
          setFournisseurs={setFournisseurs}
          ajouterJournal={ajouterJournal}
        />
      )}
    </div>
  );
}

// ============================================================
// SÉLECTION DU COURRIEL DE DESTINATION — affichée avant chaque envoi
// (devis, bon de travail, facture) quand le client a plusieurs
// courriels enregistrés. Le choix par défaut est pré-sélectionné mais
// toujours modifiable.
// ============================================================
// Sélection des courriels de destination — CHOIX MULTIPLE : un même
// client peut avoir plusieurs contacts (propriétaire, gestionnaire,
// comptabilité...) et recevoir le document à plusieurs adresses d'un
// coup. `onConfirmer` reçoit la LISTE des courriels cochés (le premier
// sert d'affichage principal pour la compatibilité).

// ============================================================
// RETRAIT DE FACTURATION — la DEMANDE (raison prédéfinie + note).
// ------------------------------------------------------------
// Personne ne « perd » une facture en un clic : la demande est tracée
// (qui, quand, pourquoi) et un Admin principal doit valider avant que
// le bon quitte la pile. « Travaux en cours » = simple report.
// ============================================================

// ============================================================
// FENÊTRE « NOUVEAU CLIENT » PARTAGÉE — ouverte depuis le devis OU la
// création de tâche (agenda). Mêmes validations que l'onglet Clients
// (courriel valide + adresse complète, exigences QuickBooks), avec
// avertissement anti-doublon. `onSelection(id)` est rappelé avec le
// client créé (ou l'existant choisi) pour le sélectionner sur place.
// ============================================================
// L'enregistrement des clients est assuré par la sauvegarde automatique
// de l'App (voir « SAUVEGARDE AUTOMATIQUE ») — aucun appel à faire ici.
export function ModalNouveauClient({ clients, setClients, ajouterJournal, onFermer, onSelection }) {
  const [ncPrenom, setNcPrenom] = useState("");
  const [ncNomFamille, setNcNomFamille] = useState("");
  const [ncEntreprise, setNcEntreprise] = useState("");
  const [ncCourriel, setNcCourriel] = useState("");
  const [ncTelephone, setNcTelephone] = useState("");
  const [ncAdresse, setNcAdresse] = useState(null);
  const [ncAdresseApp, setNcAdresseApp] = useState("");
  const [ncErreurs, setNcErreurs] = useState([]);
  // Doublon probable : même courriel, ou nom identique à un client existant.
  // PERSONNE OU ENTREPRISE (retour de tests 2026-08-17) + téléphone
  // obligatoire — mêmes règles que le grand formulaire de l'onglet
  // Clients (une seule logique, deux portes d'entrée).
  const ncPersonne = !!(ncPrenom.trim() && ncNomFamille.trim());
  const ncIdentiteOk = ncPersonne || !!ncEntreprise.trim();
  const ncComplet = ncIdentiteOk && ncCourriel.trim() && ncTelephone.trim();
  const ncRaisons = [];
  if (!ncIdentiteOk) ncRaisons.push("une personne (prénom + nom) OU une entreprise");
  if (!ncCourriel.trim()) ncRaisons.push("un courriel");
  if (!ncTelephone.trim()) ncRaisons.push("un téléphone");
  const doublonPossible = (clients || []).find((c) => {
    const courrielSaisi = ncCourriel.trim().toLowerCase();
    // Insensible aux ACCENTS et aux espaces : « Raphaël  Gélinas » =
    // « raphael gelinas » — c'est comme ça que le doublon est passé.
    const nomSaisi = nomClientNormalise(ncPersonne ? `${ncPrenom} ${ncNomFamille}` : ncEntreprise);
    if (courrielSaisi && (c.courriels || []).some((cc) => cc.email.toLowerCase() === courrielSaisi)) return true;
    return nomSaisi.length > 3 && (nomClientNormalise(c.nom) === nomSaisi || nomClientNormalise(c.entreprise || "") === nomSaisi);
  });
  const creer = () => {
    if (!ncComplet) return;
    // Conformité : aucune donnée invalide ne part vers QuickBooks.
    const erreurs = erreursClientPourQuickBooks({ courriel: ncCourriel, adresse: ncAdresse });
    if (erreurs.length > 0) {
      setNcErreurs(erreurs);
      return;
    }
    const id = `c-${Date.now()}`;
    const nouveauClient = {
      id,
      entreprise: ncEntreprise.trim(),
      // Entreprise seule : elle sert de nom et d'affichage.
      nomAffichage: ncPersonne ? "nom" : "entreprise",
      nom: ncPersonne ? `${ncPrenom.trim()} ${ncNomFamille.trim()}` : ncEntreprise.trim(),
      courriels: [{ id: `cc-${Date.now()}`, label: "Principal", email: ncCourriel.trim(), defaut: true }],
      telephone: ncTelephone.trim(),
      termeFacturation: TERMES_FACTURATION[0],
      adresseFacturation: ncAdresse
        ? [ncAdresse.label, ncAdresseApp.trim() ? `app. ${ncAdresseApp.trim()}` : ""].filter(Boolean).join(", ")
        : "",
      adresses: ncAdresse
        ? [{ id: `a-${Date.now()}`, nom: "Facturation", ligne1: ncAdresse.label, ...(ncAdresseApp.trim() ? { appartement: ncAdresseApp.trim() } : {}), codePostal: ncAdresse.codePostal }]
        : [],
      quickbooksCustomerId: null,
      syncQb: "en_cours",
    };
    setClients((prev) => [...prev, nouveauClient]);
    ajouterJournal(`👤 Client "${nouveauClient.nom}" créé — transfert vers QuickBooks en cours...`);
    onSelection?.(id);
    onFermer();
    // VRAI transfert QuickBooks — même flux que l'onglet Clients.
    sauvegarderClient(nouveauClient)
      .then(() => synchroniserClientsQbo({ clientId: id }))
      .then((r) => {
        if (r?.fait > 0) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "synchronise" } : c)));
          ajouterJournal(`🔄 Client "${nouveauClient.nom}" créé/relié dans QuickBooks (Sandbox)`);
        } else if (r?.simule) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🧪 QuickBooks non configuré ici — client local seulement (normal en développement)");
        } else if (r?.nonConnecte) {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal("🔌 QuickBooks non connecté — le client sera repris par « Synchroniser les clients » (Paramètres → Connexions)");
        } else {
          setClients((prev) => prev.map((c) => (c.id === id ? { ...c, syncQb: "a_faire" } : c)));
          ajouterJournal(`⚠️ Client "${nouveauClient.nom}" non transféré : ${(r?.erreurs || [])[0] || r?.erreur || "erreur"} — repris plus tard par la synchronisation`);
        }
      })
      .catch(() => ajouterJournal(`⚠️ Client "${nouveauClient.nom}" enregistré localement mais transfert QuickBooks à reprendre`));
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(evFond) => { if (evFond.target !== evFond.currentTarget) return; (onFermer)(); }}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">➕ Nouveau client</h3>
            <p className="text-xs text-slate-500">Créé au répertoire clients et sélectionné sur place.</p>
          </div>
          <button onClick={onFermer} aria-label="Fermer"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={ncPrenom} onChange={(e) => setNcPrenom(e.target.value)} placeholder="Prénom" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <input value={ncNomFamille} onChange={(e) => setNcNomFamille(e.target.value)} placeholder="Nom" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>
          <input value={ncEntreprise} onChange={(e) => setNcEntreprise(e.target.value)} placeholder="Entreprise" className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          <p className="text-[10px] leading-snug text-slate-400">
            Personne (prénom + nom) OU entreprise — au moins un des deux. Les deux ensemble : encore mieux.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input value={ncCourriel} onChange={(e) => setNcCourriel(e.target.value)} placeholder="Courriel *" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            <input value={ncTelephone} onChange={(e) => setNcTelephone(e.target.value)} placeholder="Téléphone *" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Adresse de facturation *</label>
            <AutocompleteAdresse onSelection={(place) => setNcAdresse(place)} />
            {ncAdresse ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <Check size={11} className="shrink-0" /> {ncAdresse.label}
                <button onClick={() => setNcAdresse(null)} aria-label="Retirer l'adresse" className="ml-1 text-slate-400 hover:text-red-500"><X size={11} /></button>
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Écris le numéro et la rue, puis précise la ville et clique « Utiliser cette adresse ».</p>
            )}
            <input
              value={ncAdresseApp}
              onChange={(e) => setNcAdresseApp(e.target.value)}
              placeholder="App. / bureau / casier postal (facultatif)"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>
          {doublonPossible && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
              ⚠️ Un client semblable existe déjà : <span className="font-bold">{doublonPossible.nom}</span>.
              <button
                onClick={() => { onSelection?.(doublonPossible.id); onFermer(); }}
                className="ml-1 underline"
              >
                L'utiliser plutôt
              </button>
            </div>
          )}
          {ncErreurs.length > 0 && (
            <ul className="space-y-0.5 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] font-semibold text-red-600">
              {ncErreurs.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
          {ncRaisons.length > 0 && (
            <p className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
              Pour créer le client, il manque : {ncRaisons.join(" · ")}.
            </p>
          )}
          <Button onClick={creer} disabled={!ncComplet} className="w-full">
            Créer le client et l'utiliser
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FENÊTRE « NOUVEAU FOURNISSEUR » — ouverte depuis le formulaire de bon
// de commande. Plusieurs adresses courriel possibles (achats,
// comptabilité, représentant) : le BC peut partir à plusieurs d'un coup.
// `onSelection(id)` sélectionne le fournisseur créé sur place.
// ============================================================

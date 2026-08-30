"use client";

// app/admin/BlocReponsesClients.jsx
//
// 💬 RÉPONSES DE TES CLIENTS (2026-08-28)
//
// Retour du propriétaire : « la modification demandée peut se perdre
// rapidement si on a plusieurs devis envoyés en même temps — il faut
// une meilleure place, plus lisible, qu'on n'oublie pas de répondre. »
//
// Avant, la demande d'un client dormait DANS la carte de son devis :
// il fallait tomber dessus. Ici, tout ce à quoi un client a répondu se
// retrouve au même endroit, par ordre d'urgence :
//   ✏️ modification demandée — QUELQU'UN ATTEND une réponse de toi ;
//   ✅ accepté pas encore traité — de l'argent à convertir ;
//   ❌ refusé — pour information, se range d'un clic.
//
// Le même bloc sert dans l'onglet Devis et sur le tableau de bord, et
// la pastille du menu compte les deux premiers.
//
// SE RANGE TOUT SEUL : le calcul ne regarde que la VERSION ACTIVE d'un
// devis — faire une nouvelle version (la réponse normale à une demande
// de modification) suffit donc à sortir la ligne, sans rien cocher.

import { useState } from "react";
import { Check, FileText, Mail, Plus } from "lucide-react";

const GENRES = {
  modification: {
    icone: "✏️",
    titre: "Modification demandée",
    carte: "border-amber-300 bg-amber-50",
    texte: "text-amber-800",
  },
  accepte: {
    icone: "✅",
    titre: "Accepté — à traiter",
    carte: "border-emerald-300 bg-emerald-50",
    texte: "text-emerald-800",
  },
  refuse: {
    icone: "❌",
    titre: "Refusé",
    carte: "border-slate-200 bg-slate-50",
    texte: "text-slate-500",
  },
};

// « il y a 3 jours » — un client qui attend depuis une semaine, ça se voit.
function depuisQuand(iso) {
  if (!iso) return "";
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  return `il y a ${jours} jours`;
}

export function BlocReponsesClients({ reponses, compact = false, onOuvrirDevis, onNouvelleVersion, onTraiterDevis, onRenvoyer, onClasser, onEffacerErreur }) {
  const [replie, setReplie] = useState(false);
  if (!reponses || reponses.length === 0) {
    if (compact) return null; // tableau de bord : rien à dire, rien à montrer
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">💬 Réponses de tes clients</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Aucune réponse en attente. Dès qu&apos;un client accepte, refuse ou demande une modification, ça apparaît ici.
        </p>
      </div>
    );
  }
  const aRepondre = reponses.filter((r) => r.genre === "modification").length;
  return (
    <div className={`rounded-2xl border bg-white p-3 ${aRepondre > 0 ? "border-amber-300" : "border-slate-200"}`}>
      <button onClick={() => setReplie(!replie)} className="flex w-full items-center justify-between gap-2 text-left">
        <p className={`text-xs font-extrabold uppercase tracking-wide ${aRepondre > 0 ? "text-amber-700" : "text-slate-500"}`}>
          💬 Réponses de tes clients ({reponses.length})
          {aRepondre > 0 && <span className="ml-1.5 normal-case">— {aRepondre} attend{aRepondre > 1 ? "ent" : ""} ta réponse</span>}
        </p>
        <span className="shrink-0 text-[11px] font-bold text-slate-400">{replie ? "▼ Ouvrir" : "▲ Replier"}</span>
      </button>

      {!replie && (
        <div className="mt-2 space-y-1.5">
          {reponses.map(({ devis: d, genre }) => {
            const g = GENRES[genre];
            return (
              <div key={d.id} className={`rounded-xl border p-2.5 ${g.carte}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-extrabold ${g.texte}`}>
                      {g.icone} {g.titre}
                      <span className="ml-1.5 font-normal text-slate-500">
                        {d.numero} · {d.clientNom} · {(Number(d.totalVendant) || 0).toFixed(2)} $
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {d.reponduParNom ? `${d.reponduParNom} · ` : ""}{depuisQuand(d.reponduLe)}
                    </p>
                    {/* LE MESSAGE DU CLIENT, en toutes lettres — c'est
                        l'information qu'on venait chercher. */}
                    {d.messageClient && (
                      <p className="mt-1 rounded-lg bg-white/70 px-2 py-1 text-[11px] italic leading-snug text-slate-700">
                        « {d.messageClient} »
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-2">
                  {onOuvrirDevis && (
                    <button
                      onClick={() => onOuvrirDevis(d)}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 active:scale-95"
                    >
                      <FileText size={11} /> Voir le devis
                    </button>
                  )}
                  {genre === "modification" && onNouvelleVersion && (
                    <button
                      onClick={() => onNouvelleVersion(d)}
                      className="flex items-center gap-1 rounded-lg bg-[#131B2E] px-2.5 py-1 text-[10px] font-bold text-white active:scale-95"
                    >
                      <Plus size={11} /> Nouvelle version
                    </button>
                  )}
                  {genre === "accepte" && onTraiterDevis && (
                    <button
                      onClick={() => onTraiterDevis(d)}
                      className="rounded-lg bg-[#131B2E] px-2.5 py-1 text-[10px] font-bold text-white active:scale-95"
                    >
                      Traiter le devis →
                    </button>
                  )}
                  {/* 📧 RENVOYER — le geste après avoir répondu à sa
                      question au téléphone : le devis repart, et le
                      client peut ACCEPTER en ligne (sa réponse est
                      rouverte, sinon son lien resterait mort). */}
                  {genre !== "accepte" && onRenvoyer && (
                    <button
                      onClick={() => onRenvoyer(d)}
                      title="Le devis repart au client, qui pourra répondre de nouveau (accepter, refuser…)"
                      className="flex items-center gap-1 rounded-lg border border-[#131B2E] bg-white px-2.5 py-1 text-[10px] font-bold text-[#131B2E] active:scale-95"
                    >
                      <Mail size={11} /> Renvoyer le devis
                    </button>
                  )}
                  {/* 🗑️ Envoyée PAR ERREUR (« salut ») : la demande
                      s'efface — le devis redevient « envoyé » et le lien
                      du client refonctionne. Trace gardée au journal. */}
                  {genre === "modification" && onEffacerErreur && (
                    <button
                      onClick={() => onEffacerErreur(d)}
                      title="Le client a envoyé ça par erreur : efface la demande — il pourra répondre de nouveau sur le même lien"
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-red-500"
                    >
                      🗑️ Erreur du client
                    </button>
                  )}
                  {/* Classer : pour les cas réglés autrement (un appel au
                      client, un refus pris en note). Jamais offert sur un
                      devis accepté — celui-là se règle en le traitant. */}
                  {genre !== "accepte" && onClasser && (
                    <button
                      onClick={() => onClasser(d)}
                      title={genre === "modification" ? "J'ai répondu au client (par téléphone, par courriel…)" : "Pris en note"}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 active:scale-95"
                    >
                      <Check size={11} /> {genre === "modification" ? "J'ai répondu" : "Pris en note"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

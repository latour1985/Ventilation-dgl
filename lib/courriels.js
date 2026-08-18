// lib/courriels.js
//
// Envoi de courriels depuis l'interface (admin et technicien).
// Parle à NOTRE route serveur (/api/courriel) — jamais à Resend
// directement : la clé d'envoi n'existe que côté serveur.
//
// Retourne toujours un objet { envoye, simule, erreur } — jamais
// d'exception : l'appelant décide quoi afficher dans le journal.

import { supabase } from "./supabase/client";

export async function envoyerCourriel({ a, sujet, html, copieExpediteur = false }) {
  try {
    const { data } = await supabase.auth.getSession();
    const jeton = data?.session?.access_token;
    if (!jeton) return { envoye: false, simule: false, erreur: "Session expirée — reconnecte-toi." };

    const reponse = await fetch("/api/courriel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      // copieExpediteur : l'utilisateur connecté reçoit le courriel en
      // copie et les réponses lui reviennent (bons de commande).
      body: JSON.stringify({ a, sujet, html, copieExpediteur }),
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (resultat?.simule) return { envoye: false, simule: true, erreur: null };
    if (!reponse.ok) return { envoye: false, simule: false, erreur: resultat?.erreur || "Envoi refusé." };
    return { envoye: true, simule: false, erreur: null };
  } catch {
    return { envoye: false, simule: false, erreur: "Réseau indisponible — réessaie." };
  }
}

// ------------------------------------------------------------
// GABARITS — un seul style pour tous les courriels de l'entreprise.
// ------------------------------------------------------------
// Volontairement sobres : tableaux et styles EN LIGNE seulement, parce
// que les clients de courriel (Outlook surtout) ignorent tout le reste.

function enveloppe(config, contenu) {
  const nom = config?.nomCommercial || config?.nomLegal || "Ventilation DGL inc.";
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#131B2E;padding:18px 24px;">
        <span style="color:#ffffff;font-size:18px;font-weight:bold;">${nom}</span>
      </td></tr>
      <tr><td style="padding:24px;">${contenu}</td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
        ${nom}${config?.adresse ? ` · ${config.adresse}` : ""}${config?.telephone ? ` · ${config.telephone}` : ""}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Devis au client : le lien d'acceptation est LE bouton — tout le
// courriel existe pour ce clic. `dejaAccepte` : renvoi d'un devis DÉJÀ
// accepté (le client a perdu sa copie) — le texte devient « voici votre
// copie » au lieu de « répondez en ligne », et la page publique montre
// l'état accepté.
export function gabaritDevis({ config, numero, clientNom, total, lien, joursValidite = 30, dejaAccepte = false }) {
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${clientNom ? ` ${clientNom}` : ""},</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${dejaAccepte
         ? `Voici votre copie du devis <strong>${numero}</strong>${total ? ` au montant de <strong>${total}</strong> (avant taxes)` : ""}, que vous avez déjà accepté. Vous pouvez le consulter en tout temps :`
         : `Voici votre devis <strong>${numero}</strong>${total ? ` au montant de <strong>${total}</strong> (avant taxes)` : ""}. Vous pouvez le consulter et nous donner votre réponse en ligne :`}
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lien}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${dejaAccepte ? "Voir mon devis" : "Voir le devis et répondre"}</a>
     </td></tr></table>
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
       Ce lien est valide ${joursValidite} jours. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br/>
       <a href="${lien}" style="color:#2563eb;word-break:break-all;">${lien}</a>
     </p>`
  );
}

// Bon de travail au client : un DESCRIPTIF des travaux réalisés —
// photos avant/après, signature. JAMAIS de prix (ni soumission ni
// facture — décision du propriétaire). Le courriel annonce la validité
// de 90 jours ET l'option de télécharger le document en PDF.
export function gabaritBonTravail({ config, clientNom, lien, joursValidite = 90 }) {
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${clientNom ? ` ${clientNom}` : ""},</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       Vos travaux sont terminés. Vous pouvez consulter le <strong>bon de travail</strong> —
       le descriptif de ce qui a été fait, avec les photos avant et après travaux :
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lien}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Voir le bon de travail</a>
     </td></tr></table>
     <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.5;">
       Ce lien est disponible pendant <strong>${joursValidite} jours</strong>. Pour conserver le document
       (dossier d'assurance, garantie), utilisez le bouton <strong>« Télécharger (PDF) »</strong> sur la page —
       le fichier restera sur votre appareil sans limite de temps.
     </p>
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
       Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br/>
       <a href="${lien}" style="color:#2563eb;word-break:break-all;">${lien}</a>
     </p>`
  );
}

// Demande de paiement au client (pièce à payer avant commande ou avant
// planification). Le montant TOUT INCLUS est la vedette : c'est le
// chiffre que le client doit virer, sans calcul de sa part.
// `lignes` = [{ etiquette, montant }] — une pièce seule, un déplacement
// seul, ou les deux ensemble : le même courriel sert aux trois cas.
// `lienPaiement` (facultatif) : le lien « voir et payer » de QuickBooks
// Payments — quand le propriétaire a permis carte/virement pour cette
// facture, le client paie en deux clics et QuickBooks enregistre le
// paiement TOUT SEUL contre la facture. Aucuns frais ajoutés au client
// (règle Québec) : les frais du marchand sont un coût interne.
export function gabaritDemandePaiement({ config, clientNom, description, lignes, tps, tvq, total, lienPaiement = null }) {
  const ligne = (etiquette, valeur, gras) =>
    `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;${gras ? "font-weight:bold;background:#f8fafc;color:#0f172a;" : ""}">${etiquette}</td><td align="right" style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;${gras ? "font-weight:bold;background:#f8fafc;color:#0f172a;" : ""}">${valeur}</td></tr>`;
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${clientNom ? ` ${clientNom}` : ""},</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">${description}</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       ${(lignes || []).map((l) => ligne(l.etiquette, `${l.montant.toFixed(2)} $`)).join("")}
       ${ligne(`TPS (${config?.tauxTps ?? 5} %)`, `${tps.toFixed(2)} $`)}
       ${ligne(`TVQ (${config?.tauxTvq ?? 9.975} %)`, `${tvq.toFixed(2)} $`)}
       ${ligne("TOTAL À PAYER", `${total.toFixed(2)} $`, true)}
     </table>
     ${lienPaiement ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lienPaiement}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">💳 Payer en ligne</a>
     </td></tr></table>` : ""}
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       Dès la réception de votre paiement, nous procéderons sans délai.
       Vous pouvez payer par virement Interac${config?.courrielFacturation || config?.courriel ? ` à <strong>${config.courrielFacturation || config.courriel}</strong>` : ""},
       par chèque, ou nous appeler${config?.telephone ? ` au <strong>${config.telephone}</strong>` : ""} pour toute question.
     </p>
     ${config?.noteFacture ? `<p style="margin:12px 0 0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#334155;font-size:13px;line-height:1.5;white-space:pre-line;">${config.noteFacture}</p>` : ""}`
  );
}

// COMMANDE GROUPÉE de matériel camion — un P/O par fournisseur, la
// liste agrégée des articles de tous les techniciens. Le fournisseur
// doit pouvoir préparer la commande sans nous rappeler.
export function gabaritCommandeGroupee({ config, numeroPo, fournisseurNom, lignes }) {
  const rangees = (lignes || [])
    .map(
      (l) =>
        `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${l.article}</td><td align="center" style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${l.quantite}</td></tr>`
    )
    .join("");
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${fournisseurNom ? ` ${fournisseurNom}` : ""},</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       Veuillez préparer notre bon de commande <strong>${numeroPo}</strong> :
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr>
         <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Article</td>
         <td align="center" style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Quantité</td>
       </tr>
       ${rangees}
     </table>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${config?.adresse ? `Livraison ou cueillette à notre entrepôt — <strong>${config.adresse}</strong>.` : "Merci de nous confirmer la disponibilité."}
     </p>
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       Merci de confirmer la réception de cette commande et le délai de disponibilité en répondant à ce courriel.
     </p>`
  );
}

// Bon de commande au fournisseur : sobre et complet — le fournisseur
// doit pouvoir traiter la commande sans nous rappeler.
export function gabaritBonCommande({ config, piece }) {
  const lignesUnites = (piece.unites || [])
    .filter((u) => (u.modele || "").trim() || (u.serie || "").trim())
    .map((u) => `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${u.modele || "—"}</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${u.serie || "—"}</td></tr>`)
    .join("");
  // LIVRAISON DEMANDÉE — date locale (jamais toISOString : règle gelée).
  // Mode FIXE : l'entrepôt n'a pas de personnel en permanence, quelqu'un
  // se déplace pour recevoir ce jour-là — le fournisseur doit le savoir.
  const dateLivraison = piece.dateReceptionPrevue
    ? new Date(`${piece.dateReceptionPrevue}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const blocLivraison = `
     <p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:bold;">Livraison :</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${dateLivraison
         ? piece.livraisonFixe
           ? `Le <strong>${dateLivraison} exactement</strong>. Notre entrepôt n'a pas de personnel en permanence :
              une personne sera sur place ce jour-là pour recevoir la marchandise.`
           : `Au plus tard le <strong>${dateLivraison}</strong> — avant si possible.`
         : `Merci de nous indiquer votre date de livraison possible.`}
       ${config?.adresse ? `<br/>À notre entrepôt — <strong>${config.adresse}</strong>.` : ""}
       <br/><strong>Si cette date est impossible, répondez à ce courriel</strong> en indiquant vos dates
       possibles — nous confirmerons la nouvelle date avec vous avant l'expédition.
     </p>`;
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour,</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       Veuillez traiter le bon de commande <strong>${piece.numeroBc || "(numéro à venir)"}</strong> :
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Pièce demandée</td>
           <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${piece.pieceRequise || ""}</td></tr>
       ${piece.note ? `<tr><td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Note</td><td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${piece.note}</td></tr>` : ""}
     </table>
     ${lignesUnites ? `<p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:bold;">Équipement concerné :</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;font-weight:bold;color:#0f172a;">Modèle</td><td style="padding:4px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;font-weight:bold;color:#0f172a;">Nº de série</td></tr>
       ${lignesUnites}
     </table>` : ""}
     ${blocLivraison}
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       Merci de confirmer la réception de cette commande et la date de livraison.
     </p>`
  );
}

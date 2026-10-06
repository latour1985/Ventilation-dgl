// lib/courriels.js
//
// Envoi de courriels depuis l'interface (admin et technicien).
// Parle à NOTRE route serveur (/api/courriel) — jamais à Resend
// directement : la clé d'envoi n'existe que côté serveur.
//
// Retourne toujours un objet { envoye, simule, erreur } — jamais
// d'exception : l'appelant décide quoi afficher dans le journal.

import { supabase } from "./supabase/client";
import { argentSelonLangue, nomTaxe } from "./i18nPublic";

export async function envoyerCourriel({ a, sujet, html, copieExpediteur = false, copieA = [], piecesJointes = [] }) {
  try {
    const { data } = await supabase.auth.getSession();
    const jeton = data?.session?.access_token;
    if (!jeton) return { envoye: false, simule: false, erreur: "Session expirée — reconnecte-toi." };

    const reponse = await fetch("/api/courriel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      // copieExpediteur : l'utilisateur connecté reçoit le courriel en
      // copie et les réponses lui reviennent (bons de commande).
      // copieA : adresses supplémentaires en CC (ex. commande@... sur
      // les bons de commande) — validées côté serveur.
      // piecesJointes : [{ nom, url }] de notre stockage — vraies pièces
      // jointes (2026-09-15), validées côté serveur.
      body: JSON.stringify({ a, sujet, html, copieExpediteur, copieA, piecesJointes: (piecesJointes || []).map((f) => ({ nom: f.nom, url: f.url })) }),
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

// 🌎 LANGUE DU CLIENT (2026-10-05, version anglaise — étape A) : chaque
// gabarit CLIENT reçoit `langue` (« fr » par défaut, « en » pour un client
// marqué English sur sa fiche). Les gabarits FOURNISSEURS (bons de
// commande) restent en français. Les termes et conditions complets restent
// en français (texte juridique) — l'anglais le dit.
const enAnglais = (langue) => langue === "en";
const argentCourriel = (n, langue) => argentSelonLangue(n, langue);
// 🛡️ TEXTE TAPÉ → HTML SÛR (audit 2026-10-05). Tout ce qu'une personne
// a tapé (nom du client, pièce, note, adresse…) est échappé avant
// d'entrer dans un courriel : « Filtre <MERV 13> » arrivait chez le
// fournisseur en « Filtre », un « < » pouvait casser le tableau, et on
// pouvait y glisser un lien au nom de l'entreprise.
export function echapperHtml(valeur) {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const bonjour = (clientNom, langue) =>
  `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">${enAnglais(langue) ? "Hello" : "Bonjour"}${clientNom ? ` ${echapperHtml(clientNom)}` : ""},</p>`;
const lienDeSecours = (lien, langue) =>
  enAnglais(langue)
    ? `If the button does not work, copy this address into your browser:<br/>
       <a href="${lien}" style="color:#2563eb;word-break:break-all;">${lien}</a>`
    : `Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br/>
       <a href="${lien}" style="color:#2563eb;word-break:break-all;">${lien}</a>`;
const auTelephone = (config, langue) => (config?.telephone ? (enAnglais(langue) ? ` at ${echapperHtml(config.telephone)}` : ` au ${echapperHtml(config.telephone)}`) : "");

function enveloppe(config, contenu, langue = "fr") {
  const nom = echapperHtml(config?.nomCommercial || config?.nomLegal || "Ventilation DGL inc.");
  return `<!doctype html><html lang="${enAnglais(langue) ? "en" : "fr"}"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#131B2E;padding:18px 24px;">
        <span style="color:#ffffff;font-size:18px;font-weight:bold;">${nom}</span>
      </td></tr>
      <tr><td style="padding:24px;">${contenu}</td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
        ${nom}${config?.adresse ? ` · ${echapperHtml(config.adresse)}` : ""}${config?.telephone ? ` · ${echapperHtml(config.telephone)}` : ""}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// 🌎 OBJETS DES COURRIELS CLIENTS — au même endroit que les gabarits pour
// que la langue de l'objet suive toujours celle du corps.
export function sujetCourrielClient(type, langue, v = {}) {
  const en = enAnglais(langue);
  const ent = v.entreprise || "";
  const precision = v.precision ? ` — ${v.precision}` : "";
  switch (type) {
    case "devis":
      return en ? `Quote ${v.numero}${precision} — ${ent}` : `Devis ${v.numero}${precision} — ${ent}`;
    case "devisCopie":
      return en ? `Your copy of quote ${v.numero}${precision} — ${ent}` : `Votre copie du devis ${v.numero}${precision} — ${ent}`;
    case "devisRappel":
      return en ? `Reminder — Quote ${v.numero}${precision} — ${ent}` : `Rappel — Devis ${v.numero}${precision} — ${ent}`;
    case "bonTravail":
      return en ? `Your work is complete — work order${precision} (${ent})` : `Vos travaux sont terminés — bon de travail${precision} (${ent})`;
    case "facture":
      return en ? `Invoice ${v.numero}${precision} — ${ent}` : `Facture ${v.numero}${precision} — ${ent}`;
    case "noteCredit":
      return en ? `Credit note ${v.numero}${precision} — ${ent}` : `Note de crédit ${v.numero}${precision} — ${ent}`;
    case "rdv":
      return en ? `Your appointment is confirmed — ${v.date} — ${ent}` : `Votre rendez-vous est confirmé — ${v.date} — ${ent}`;
    case "enRoute":
      return en
        ? `${v.technicien} is on the way — arriving in ~${v.minutes} min (${ent})`
        : `${v.technicien} est en route — arrivée dans ~${v.minutes} min (${ent})`;
    case "correctionZone":
      return en ? `Correction to your service call (${ent})` : `Correction de votre appel de service (${ent})`;
    case "depot":
      return en ? `Deposit required — booking your service call (${ent})` : `Dépôt requis — réservation de votre appel de service (${ent})`;
    case "depotCorrige":
      return en ? `Corrected deposit — booking your service call (${ent})` : `Dépôt corrigé — réservation de votre appel de service (${ent})`;
    default:
      return ent;
  }
}

// Date lisible selon la langue (« mardi 6 octobre 2026 » / « Tuesday, October 6, 2026 »).
// `iso` = AAAA-MM-JJ — lue en heure LOCALE (jamais UTC : règle du projet).
export function dateCourriel(iso, langue) {
  const [a, m, j] = String(iso || "").slice(0, 10).split("-").map(Number);
  if (!a || !m || !j) return String(iso || "");
  return new Date(a, m - 1, j).toLocaleDateString(enAnglais(langue) ? "en-CA" : "fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// Devis au client : le lien d'acceptation est LE bouton — tout le
// courriel existe pour ce clic. `dejaAccepte` : renvoi d'un devis DÉJÀ
// accepté (le client a perdu sa copie) — le texte devient « voici votre
// copie » au lieu de « répondez en ligne », et la page publique montre
// l'état accepté.
export function gabaritDevis({ config, numero, clientNom, total, lien, joursValidite = 30, dejaAccepte = false, relance = false, pdfJoint = false, langue = "fr" }) {
  const en = enAnglais(langue);
  const montant = total ? (en ? ` for <strong>${total}</strong> (before taxes)` : ` au montant de <strong>${total}</strong> (avant taxes)`) : "";
  const texte = en
    ? relance
      ? `Friendly reminder: your quote <strong>${numero}</strong>${montant} is still awaiting your reply. You can view it and reply online — one click is all it takes:`
      : dejaAccepte
        ? `Here is your copy of quote <strong>${numero}</strong>${montant}, which you have already accepted. You can view it at any time:`
        : `Here is your quote <strong>${numero}</strong>${montant}. You can view it and give us your answer online:`
    : relance
      ? `Petit rappel : votre devis <strong>${numero}</strong>${montant} attend toujours votre réponse. Vous pouvez le consulter et nous répondre en ligne — un clic suffit :`
      : dejaAccepte
        ? `Voici votre copie du devis <strong>${numero}</strong>${montant}, que vous avez déjà accepté. Vous pouvez le consulter en tout temps :`
        : `Voici votre devis <strong>${numero}</strong>${montant}. Vous pouvez le consulter et nous donner votre réponse en ligne :`;
  const bouton = en ? (dejaAccepte ? "View my quote" : "View the quote and reply") : dejaAccepte ? "Voir mon devis" : "Voir le devis et répondre";
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">${texte}</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lien}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${bouton}</a>
     </td></tr></table>
     ${pdfJoint
       ? `<p style="margin:0 0 12px;color:#334155;font-size:13px;line-height:1.5;">${
           en
             ? "📎 The quote is also attached to this email <strong>as a PDF</strong> — to print or keep."
             : "📎 Le devis est aussi joint à ce courriel <strong>en PDF</strong> — pour l'imprimer ou le conserver."
         }</p>`
       : ""}
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
       ${en ? `This link is valid for ${joursValidite} days.` : `Ce lien est valide ${joursValidite} jours.`} ${lienDeSecours(lien, langue)}
     </p>`,
    langue
  );
}

// 🧾 FACTURE MAISON au client (2026-09-02) — le lien vers la facture
// officielle en ligne (gabarit légal, PDF téléchargeable). `credit` :
// le courriel annonce une note de crédit plutôt qu'un montant à payer.
export function gabaritFactureMaison({ config, numero, clientNom, total, lien, echeance = null, credit = false, langue = "fr" }) {
  const en = enAnglais(langue);
  const texte = en
    ? credit
      ? `Here is your credit note <strong>${numero}</strong>${total ? ` for <strong>${total}</strong>` : ""}. You can view and download it online:`
      : `Here is your invoice <strong>${numero}</strong>${total ? ` for <strong>${total}</strong> (taxes included)` : ""}${echeance ? `, payable no later than <strong>${echeance}</strong>` : ""}. You can view and download it online:`
    : credit
      ? `Voici votre note de crédit <strong>${numero}</strong>${total ? ` au montant de <strong>${total}</strong>` : ""}. Vous pouvez la consulter et la télécharger en ligne :`
      : `Voici votre facture <strong>${numero}</strong>${total ? ` au montant de <strong>${total}</strong> (taxes incluses)` : ""}${echeance ? `, payable au plus tard le <strong>${echeance}</strong>` : ""}. Vous pouvez la consulter et la télécharger en ligne :`;
  const bouton = en ? (credit ? "View my credit note" : "View my invoice") : credit ? "Voir ma note de crédit" : "Voir ma facture";
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">${texte}</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lien}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${bouton}</a>
     </td></tr></table>
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">${lienDeSecours(lien, langue)}</p>`,
    langue
  );
}

// 📅 CONFIRMATION DE RENDEZ-VOUS (2026-09-08, demande du propriétaire) :
// le dépôt de sécurité est reçu — on confirme au client la date, l'heure
// et l'adresse de sa visite. Envoyé PAR le bureau, jamais automatique.
// ⚠️ LA DATE SEULEMENT, JAMAIS L'HEURE (2026-09-08, règle du
// propriétaire : « les horaires bougent — on confirmera la veille »).
export function gabaritConfirmationRdv({ config, clientNom, date, adresse, technicien, depotRecu = true, langue = "fr" }) {
  const en = enAnglais(langue);
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${depotRecu ? (en ? "We have received your deposit — thank you! " : "Nous avons bien reçu votre dépôt — merci ! ") : ""}${en ? "Your appointment is confirmed:" : "Votre rendez-vous est confirmé :"}
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#f8fafc;border-radius:8px;width:100%;">
       <tr><td style="padding:14px 18px;color:#0f172a;font-size:14px;line-height:1.8;">
         📅 <strong>${date}</strong><br/>
         ${adresse ? `📍 ${echapperHtml(adresse)}<br/>` : ""}
         ${technicien ? `👷 ${en ? "Your technician:" : "Votre technicien :"} <strong>${echapperHtml(technicien)}</strong><br/>` : ""}
         🕐 ${en ? "We will contact you the day before to confirm the appointment." : "Nous vous contacterons la veille pour confirmer le rendez-vous."}
       </td></tr>
     </table>
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
       ${en
         ? `Can't make it? Reply to this email or call us${auTelephone(config, langue)} — we will find another time.`
         : `Un empêchement ? Répondez à ce courriel ou appelez-nous${auTelephone(config, langue)} — nous trouverons un autre moment.`}
     </p>`,
    langue
  );
}

// 🔁 ZONE D'UN APPEL CORRIGÉE (2026-10-05, demande du propriétaire :
// « s'il y a un dépôt payé, comment s'assurer que le client a bien été
// avisé ? ») — l'ancien et le nouveau tarif côte à côte, puis ce qui
// arrive au dépôt. `depot` = { montantHT, paye } ou null ; `choixSurplus`
// = "credit" | "remboursement" | autre (on en reparlera).
export function gabaritCorrectionZone({ config, clientNom, ancienneZone, nouvelleZone, prixAncien = null, prixNouveau = null, depot = null, choixSurplus = null, minutesHorsZone = 180, langue = "fr" }) {
  const en = enAnglais(langue);
  const argent = (n) => (en ? argentCourriel(n, langue) : `${(Number(n) || 0).toFixed(2).replace(".", ",")} $`);
  const avantTaxes = en ? "(before taxes)" : "(avant taxes)";
  const nomZone = (z) => (!en ? z : z === "Hors zone" ? "Outside zone" : z === "Aucune zone" ? "No zone" : z);
  const tarif = (zone, prix) =>
    zone === "Hors zone"
      ? en
        ? `Outside zone — rate based on total time (${minutesHorsZone} min included, travel included)`
        : `Hors zone — tarif établi selon le temps total (${minutesHorsZone} min incluses, transport compris)`
      : `${nomZone(zone)}${prix != null ? ` — <strong>${argent(prix)}</strong> ${avantTaxes}` : ""}`;
  const montantDepot = Number(depot?.montantHT) || 0;
  let suite;
  if (depot?.paye) {
    const ecart = prixNouveau != null ? prixNouveau - montantDepot : null;
    suite =
      (en
        ? `Your deposit of <strong>${argent(montantDepot)}</strong> ${avantTaxes}, already paid, will be deducted from your final invoice.`
        : `Votre dépôt de <strong>${argent(montantDepot)}</strong> ${avantTaxes}, déjà payé, sera déduit de votre facture finale.`) +
      (ecart == null
        ? ""
        : ecart > 0.005
          ? en
            ? ` The difference of <strong>${argent(ecart)}</strong> ${avantTaxes} will be added to it.`
            : ` La différence de <strong>${argent(ecart)}</strong> ${avantTaxes} y sera ajoutée.`
          : ecart < -0.005
            ? choixSurplus === "credit"
              ? en
                ? ` If the final amount is lower than your deposit, the difference will be applied as a <strong>credit to your account</strong> for your next visit.`
                : ` Si le montant final est inférieur à votre dépôt, la différence sera portée en <strong>crédit à votre dossier</strong> pour votre prochaine visite.`
              : choixSurplus === "remboursement"
                ? en
                  ? ` If the final amount is lower than your deposit, the difference will be <strong>refunded</strong> to you.`
                  : ` Si le montant final est inférieur à votre dépôt, la différence vous sera <strong>remboursée</strong>.`
                : en
                  ? ` If the final amount is lower than your deposit, we will contact you about the difference: a credit to your account or a refund, as you prefer.`
                  : ` Si le montant final est inférieur à votre dépôt, nous vous contacterons pour la différence : crédit à votre dossier ou remboursement, à votre choix.`
            : "");
  } else if (depot) {
    suite = en
      ? `Your deposit request of <strong>${argent(montantDepot)}</strong> ${avantTaxes} remains valid; the difference will be adjusted on your final invoice.`
      : `Votre demande de dépôt de <strong>${argent(montantDepot)}</strong> ${avantTaxes} reste valide ; la différence sera ajustée sur votre facture finale.`;
  } else {
    suite = en ? "This rate will apply to your final invoice." : "Ce tarif s'appliquera à votre facture finale.";
  }
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${en
         ? "A correction has been made to your service call: the <strong>pricing zone</strong> has been changed."
         : "Une correction a été apportée à votre appel de service : la <strong>zone de tarification</strong> a été modifiée."}
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#f8fafc;border-radius:8px;width:100%;">
       <tr><td style="padding:14px 18px;color:#0f172a;font-size:14px;line-height:1.8;">
         <span style="color:#94a3b8;text-decoration:line-through;">${en ? "Before:" : "Avant :"} ${tarif(ancienneZone, prixAncien)}</span><br/>
         ✅ ${en ? "Now:" : "Maintenant :"} ${tarif(nouvelleZone, prixNouveau)}
       </td></tr>
     </table>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">${suite}</p>
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
       ${en ? `Any questions? Reply to this email or call us${auTelephone(config, langue)}.` : `Une question ? Répondez à ce courriel ou appelez-nous${auTelephone(config, langue)}.`}
     </p>`,
    langue
  );
}

// 🚗 « VOTRE TECHNICIEN EST EN ROUTE » (2026-09-14, demande du
// propriétaire — le classique du marché) : envoyé d'un tap depuis le
// téléphone du technicien, juste avant de partir. Prénom du technicien,
// délai estimé choisi par lui, adresse pour lever tout doute. Court : le
// client le lit sur son téléphone.
export function gabaritEnRoute({ config, clientNom, technicien, delaiMinutes, adresse, langue = "fr" }) {
  const en = enAnglais(langue);
  const delai =
    Number(delaiMinutes) > 0 ? (en ? `about ${Number(delaiMinutes)} minutes` : `environ ${Number(delaiMinutes)} minutes`) : en ? "a few minutes" : "bientôt";
  const phrase = en
    ? `${technicien ? `<strong>${echapperHtml(technicien)}</strong>, your technician, is on the way` : "Your technician is on the way"} — expected arrival in <strong>${delai}</strong>.`
    : `${technicien ? `<strong>${echapperHtml(technicien)}</strong>, votre technicien, est en route` : "Votre technicien est en route"} — arrivée prévue dans <strong>${delai}</strong>.`;
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">${phrase}</p>
     ${adresse ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#f8fafc;border-radius:8px;width:100%;">
       <tr><td style="padding:12px 18px;color:#0f172a;font-size:14px;line-height:1.7;">📍 ${echapperHtml(adresse)}</td></tr>
     </table>` : ""}
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
       ${en ? `Last-minute change of plans? Call us${auTelephone(config, langue)}.` : `Un empêchement de dernière minute ? Appelez-nous${auTelephone(config, langue)}.`}
     </p>`,
    langue
  );
}

// Bon de travail au client : un DESCRIPTIF des travaux réalisés —
// photos avant/après, signature. JAMAIS de prix (ni soumission ni
// facture — décision du propriétaire). Le courriel annonce la validité
// de 90 jours ET l'option de télécharger le document en PDF.
// `lienAvis` (facultatif) : le lien d'avis Google de l'entreprise
// (Paramètres) — une invitation polie sous le bouton, JAMAIS sur un
// retour sous garantie (décision du propriétaire, 2026-09-06 : la pièce
// est parfois garantie mais pas le temps — mauvais moment pour demander
// 5 étoiles). L'exclusion se décide chez l'appelant, qui connaît la
// tâche ; ici, lien absent = bloc absent.
export function gabaritBonTravail({ config, clientNom, lien, joursValidite = 90, lienAvis = null, langue = "fr" }) {
  const en = enAnglais(langue);
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${en
         ? "Your work is complete. You can view the <strong>work order</strong> — a description of what was done, with before and after photos:"
         : "Vos travaux sont terminés. Vous pouvez consulter le <strong>bon de travail</strong> — le descriptif de ce qui a été fait, avec les photos avant et après travaux :"}
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lien}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${en ? "View the work order" : "Voir le bon de travail"}</a>
     </td></tr></table>
     <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.5;">
       ${en
         ? `This link is available for <strong>${joursValidite} days</strong>. To keep the document (insurance file, warranty), use the <strong>“Download (PDF)”</strong> button on the page — the file will stay on your device with no time limit.`
         : `Ce lien est disponible pendant <strong>${joursValidite} jours</strong>. Pour conserver le document (dossier d'assurance, garantie), utilisez le bouton <strong>« Télécharger (PDF) »</strong> sur la page — le fichier restera sur votre appareil sans limite de temps.`}
     </p>
     ${lienAvis ? `<p style="margin:0 0 12px;border-top:1px solid #e2e8f0;padding-top:14px;color:#334155;font-size:13px;line-height:1.6;">
       ${en
         ? "If you are satisfied with our services, we would be grateful if you shared your experience."
         : "Si vous êtes satisfait de nos services, nous vous serions reconnaissants de partager votre expérience."}<br/>
       <a href="${lienAvis}" style="color:#2563eb;font-weight:bold;">⭐ ${en ? "Leave a Google review" : "Laisser un avis Google"}</a>
     </p>` : ""}
     <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">${lienDeSecours(lien, langue)}</p>`,
    langue
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
// ============================================================
// CONDITIONS DE RÉSERVATION — APPEL DE SERVICE AVEC DÉPÔT
// ------------------------------------------------------------
// Demande du propriétaire (2026-08-24) : le client DOIT voir la
// politique d'annulation AVANT de payer son dépôt — un dépôt ne peut
// être déclaré non remboursable que si la condition a été montrée
// avant le paiement. Résumé fidèle de la clause 4 des Termes et
// conditions (components/TermesConditions.jsx) ; le texte long
// continue de vivre là-bas, celui-ci n'est que son rappel.
// COMPACT à dessein : il voyage AUSSI dans le message de la facture
// QuickBooks, plafonné à 900 caractères avec les modalités de
// paiement — chaque phrase compte.
// 🌎 En anglais : la même politique, traduite pour être COMPRISE avant de
// payer, en précisant que la version française des conditions prévaut.
export function conditionsDepotAppel(config, lienConditions = null, langue = "fr") {
  const nom = config?.nomLegal || config?.nomCommercial || (enAnglais(langue) ? "our company" : "notre entreprise");
  if (enAnglais(langue)) {
    return (
      `Booking conditions: at least 24 hours' notice is required to cancel or change the appointment. ` +
      `If this notice is not given, the deposit paid is non-refundable and is kept as administration and ` +
      `time-slot reservation fees. Paying the deposit confirms your appointment and constitutes acceptance of ` +
      `these conditions and of the general terms and conditions of ${nom}` +
      (lienConditions ? `, available in full here (the French version governs): ${lienConditions}` : `, available on request (the French version governs).`)
    );
  }
  return (
    `Conditions de réservation : un préavis minimal de 24 heures est requis pour toute annulation ou ` +
    `modification du rendez-vous. À défaut de respecter ce délai, le dépôt versé est non remboursable et ` +
    `conservé à titre de frais d'administration et d'immobilisation de plage horaire. Le paiement du dépôt ` +
    `confirme votre rendez-vous et vaut acceptation de ces conditions ainsi que des termes et conditions ` +
    `générales de ${nom}` +
    // Le lien remplace « disponibles sur demande » (2026-08-24) : sur la
    // facture QuickBooks — trop courte pour dix clauses — c'est LUI qui
    // rend le texte complet lisible AVANT le paiement.
    (lienConditions ? `, lisibles au complet ici : ${lienConditions}` : `, disponibles sur demande.`)
  );
}

export function gabaritDemandePaiement({ config, clientNom, description, lignes, tps, tvq, total, lienPaiement = null, conditions = null, termesHtml = null, lienConditions = null, langue = "fr" }) {
  const en = enAnglais(langue);
  const argent = (n) => argentCourriel(n, langue);
  const ligne = (etiquette, valeur, gras) =>
    `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;${gras ? "font-weight:bold;background:#f8fafc;color:#0f172a;" : ""}">${etiquette}</td><td align="right" style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;${gras ? "font-weight:bold;background:#f8fafc;color:#0f172a;" : ""}">${valeur}</td></tr>`;
  // ============================================================
  // ORDRE VOULU, PAS DÉCORATIF (2026-08-25) : les CONDITIONS passent
  // AVANT le bouton de paiement. Dans la première version elles étaient
  // dessous — un client pressé cliquait « Payer » sans jamais défiler
  // jusqu'à elles, et « je ne les ai pas vues » devenait plaidable.
  // L'œil doit traverser l'encadré ambré pour atteindre le bouton, et
  // la phrase sous le bouton scelle le geste : payer = accepter.
  // ============================================================
  const courrielPaiement = config?.courrielFacturation || config?.courriel;
  return enveloppe(
    config,
    `${bonjour(clientNom, langue)}
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">${echapperHtml(description)}</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       ${(lignes || []).map((l) => ligne(echapperHtml(l.etiquette), argent(l.montant))).join("")}
       ${ligne(`${nomTaxe("TPS", langue)} (${config?.tauxTps ?? 5}${en ? "" : " "}%)`, argent(tps))}
       ${ligne(`${nomTaxe("TVQ", langue)} (${config?.tauxTvq ?? 9.975}${en ? "" : " "}%)`, argent(tvq))}
       ${ligne(en ? "TOTAL DUE" : "TOTAL À PAYER", argent(total), true)}
     </table>
     ${conditions ? `<p style="margin:0 0 16px;padding:12px 14px;background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;color:#78350f;font-size:13px;line-height:1.6;">
       <span style="display:block;font-weight:bold;font-size:13px;margin-bottom:4px;">⚠️ ${en ? "Please read before paying" : "À lire avant de payer"}</span>
       ${conditions}
     </p>` : ""}
     ${lienPaiement ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 6px;"><tr><td style="background:#131B2E;border-radius:8px;">
       <a href="${lienPaiement}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">💳 ${en ? "Pay online" : "Payer en ligne"}</a>
     </td></tr></table>` : ""}
     ${conditions ? `<p style="margin:0 0 16px;text-align:center;color:#64748b;font-size:12px;line-height:1.5;">
       ${en ? "By paying, you confirm that you have read the conditions above" : "En payant, vous confirmez avoir pris connaissance des conditions ci-dessus"}${lienConditions ? ` —
       <a href="${lienConditions}" style="color:#2563eb;font-weight:bold;">${en ? "full conditions" : "conditions complètes"}</a>` : ""}${termesHtml ? (en ? `, reproduced in full (in French) at the bottom of this email` : `, reproduites intégralement au bas de ce courriel`) : ""}.
     </p>` : ""}
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       ${en
         ? `As soon as we receive your payment, we will proceed without delay.
       You can pay by Interac e-Transfer${courrielPaiement ? ` to <strong>${echapperHtml(courrielPaiement)}</strong>` : ""},
       by cheque, or call us${config?.telephone ? ` at <strong>${config.telephone}</strong>` : ""} with any questions.`
         : `Dès la réception de votre paiement, nous procéderons sans délai.
       Vous pouvez payer par virement Interac${courrielPaiement ? ` à <strong>${echapperHtml(courrielPaiement)}</strong>` : ""},
       par chèque, ou nous appeler${config?.telephone ? ` au <strong>${config.telephone}</strong>` : ""} pour toute question.`}
     </p>
     ${config?.noteFacture ? `<p style="margin:12px 0 0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#334155;font-size:13px;line-height:1.5;white-space:pre-line;">${echapperHtml(config.noteFacture)}</p>` : ""}
     ${termesHtml || ""}`,
    langue
  );
}

// COMMANDE GROUPÉE de matériel camion — un P/O par fournisseur, la
// liste agrégée des articles de tous les techniciens. Le fournisseur
// doit pouvoir préparer la commande sans nous rappeler.
export function gabaritCommandeGroupee({ config, numeroPo, fournisseurNom, lignes }) {
  const rangees = (lignes || [])
    .map(
      (l) =>
        `<tr><td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${echapperHtml(l.article)}</td><td align="center" style="padding:5px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${echapperHtml(l.quantite)}</td></tr>`
    )
    .join("");
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour${fournisseurNom ? ` ${echapperHtml(fournisseurNom)}` : ""},</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       Veuillez préparer notre bon de commande <strong>${echapperHtml(numeroPo)}</strong> :
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr>
         <td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Article</td>
         <td align="center" style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Quantité</td>
       </tr>
       ${rangees}
     </table>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${config?.adresse ? `Livraison ou cueillette à notre entrepôt — <strong>${echapperHtml(config.adresse)}</strong>.` : "Merci de nous confirmer la disponibilité."}
     </p>
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       Merci de confirmer la réception de cette commande et le délai de disponibilité en répondant à ce courriel.
     </p>`
  );
}

// BC GÉNÉRIQUE (2026-08-30) — le bon de commande libre et le BC de
// projet : numéro + description + livraison. Sert au VRAI envoi (le BC
// de projet affichait « envoyé » sans qu'aucun courriel ne parte —
// réparé le même jour).
// 📷 PHOTOS D'UN BON DE COMMANDE (2026-09-06, demande du propriétaire) —
// une photo de la pièce à remplacer vaut mille descriptions. Les images
// sont hébergées (Supabase Storage) : le courriel les AFFICHE et chaque
// photo est cliquable en pleine grandeur.
// 📎 Les fichiers joints, aussi en liens dans le corps (2026-09-15).
function blocFichiersBc(fichiers) {
  const liste = (fichiers || []).filter((f) => f && f.url);
  if (liste.length === 0) return "";
  return (
    `<p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:bold;">Fichier${liste.length > 1 ? "s" : ""} joint${liste.length > 1 ? "s" : ""} :</p>` +
    `<ul style="margin:0 0 14px;padding-left:18px;color:#334155;font-size:13px;line-height:1.7;">` +
    liste.map((f) => `<li><a href="${f.url}" style="color:#0f172a;">📎 ${echapperHtml(f.nom || "fichier")}</a></li>`).join("") +
    `</ul>`
  );
}

function blocPhotosBc(photos) {
  const liste = (photos || []).filter(Boolean);
  if (liste.length === 0) return "";
  return (
    `<p style="margin:0 0 8px;color:#0f172a;font-size:13px;font-weight:bold;">Photo${liste.length > 1 ? "s" : ""} :</p>` +
    liste
      .map(
        (u) =>
          `<a href="${u}" style="text-decoration:none;"><img src="${u}" width="100%" alt="Photo du bon de commande" style="max-width:420px;border-radius:8px;border:1px solid #e2e8f0;display:block;margin:0 0 10px;"/></a>`
      )
      .join("")
  );
}

// `reclamation` (revue 2026-09-22) : courriel « items manquants » — ne doit
// JAMAIS ressembler à une nouvelle commande (le fournisseur réexpédiait tout).
export function gabaritBcSimple({ config, numeroBc, description, adresseLivraison, photos = [], fichiers = [], reclamation = false }) {
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour,</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       ${reclamation
         ? `<strong>Réclamation — items manquants</strong> sur le bon de commande <strong>${echapperHtml(numeroBc || "(numéro à venir)")}</strong>, déjà livré en partie. Il ne s'agit PAS d'une nouvelle commande :`
         : `Veuillez traiter le bon de commande <strong>${echapperHtml(numeroBc || "(numéro à venir)")}</strong> :`}
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">${reclamation ? "Détail" : "Commande"}</td>
           <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;white-space:pre-line;">${echapperHtml(description || "(voir avec nous)")}</td></tr>
     </table>
     ${adresseLivraison ? `<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       Livraison : <strong>${echapperHtml(adresseLivraison)}</strong>.
     </p>` : ""}
     ${blocFichiersBc(fichiers)}
     ${blocPhotosBc(photos)}
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       ${reclamation
         ? "Merci de nous confirmer la date de livraison des items manquants en répondant à ce courriel."
         : "Merci de confirmer la réception de cette commande et le délai de disponibilité en répondant à ce courriel."}
     </p>`
  );
}

// Bon de commande au fournisseur : sobre et complet — le fournisseur
// doit pouvoir traiter la commande sans nous rappeler.
export function gabaritBonCommande({ config, piece, photos = [], fichiers = [] }) {
  const lignesUnites = (piece.unites || [])
    .filter((u) => (u.modele || "").trim() || (u.serie || "").trim())
    .map((u) => `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${echapperHtml(u.modele || "—")}</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${echapperHtml(u.serie || "—")}</td></tr>`)
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
       ${config?.adresse ? `<br/>À notre entrepôt — <strong>${echapperHtml(config.adresse)}</strong>.` : ""}
       <br/><strong>Si cette date est impossible, répondez à ce courriel</strong> en indiquant vos dates
       possibles — nous confirmerons la nouvelle date avec vous avant l'expédition.
     </p>`;
  return enveloppe(
    config,
    `<p style="margin:0 0 12px;color:#0f172a;font-size:15px;">Bonjour,</p>
     <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
       Veuillez traiter le bon de commande <strong>${echapperHtml(piece.numeroBc || "(numéro à venir)")}</strong> :
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Pièce demandée</td>
           <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${echapperHtml(piece.pieceRequise || "")}</td></tr>
       ${piece.note ? `<tr><td style="padding:6px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:bold;color:#0f172a;">Note</td><td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${echapperHtml(piece.note)}</td></tr>` : ""}
     </table>
     ${lignesUnites ? `<p style="margin:0 0 6px;color:#0f172a;font-size:13px;font-weight:bold;">Équipement concerné :</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
       <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;font-weight:bold;color:#0f172a;">Modèle</td><td style="padding:4px 8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;font-weight:bold;color:#0f172a;">Nº de série</td></tr>
       ${lignesUnites}
     </table>` : ""}
     ${blocLivraison}
     ${blocFichiersBc(fichiers)}
     ${blocPhotosBc(photos)}
     <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;">
       Merci de confirmer la réception de cette commande et la date de livraison.
     </p>`
  );
}

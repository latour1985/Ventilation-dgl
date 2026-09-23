// lib/tauxFacturable.js
//
// 📊 TAUX D'HEURES FACTURABLES PAR TECHNICIEN (2026-09-22, idée retenue
// par le propriétaire). Sur les heures PAYÉES d'une période, quelle part
// a servi à une job qu'on facture ? C'est le vrai chiffre de productivité :
// il montre les trous (transport, attente, garantie, shop, administratif).
//
// Classement de chaque ligne d'heures (dîner et journées bloquées exclus) :
//   • facturable     : chantier sur une tâche facturable, technicien 💰
//   • transport      : lignes de transport (montrées à part — une partie
//                      est refacturée en T&M, pas tout)
//   • nonFacturable  : administratif, divers/shop, courses, garantie,
//                      tâche non facturable (visite de soumission…) ou
//                      technicien 🤝 non facturable sur cette tâche
// Taux = facturable ÷ total payé.

const estLunch = (t) => String(t.tacheId || "").startsWith("lunch-");

export function tauxFacturableParTechnicien({ travaux = [], tacheParId = () => null, facturables = {}, debutISO, finISO }) {
  const lignes = (travaux || []).filter((t) => t.supabase && t.employeEmail && t.date >= debutISO && t.date <= finISO && !estLunch(t));
  const joursBloques = new Set(lignes.filter((t) => t.jourBloque).map((t) => `${t.employeEmail.toLowerCase()}|${t.date}`));
  const parTech = {};
  lignes.forEach((t) => {
    const email = t.employeEmail.toLowerCase();
    if (joursBloques.has(`${email}|${t.date}`)) return;
    const h = Number(t.heures) || 0;
    if (h <= 0) return;
    const e = (parTech[email] = parTech[email] || { email, nom: t.employeNom || email.split("@")[0], facturable: 0, transport: 0, nonFacturable: 0, total: 0, raisons: {} });
    e.total += h;
    const base = String(t.tacheId || "").split("::")[0];
    const tache = tacheParId(base);
    const cat = t.categorieHeures || "projet";
    let raison = null;
    if (t.estTransport || base.startsWith("transport-")) {
      e.transport += h;
      return;
    }
    if (cat === "administratif") raison = "Administratif";
    else if (cat === "divers" || cat === "aucune") raison = "Shop / divers";
    else if (tache?.nonFacturable) raison = tache.typeTache === "visite_soumission" ? "Visite de soumission" : "Tâche non facturable";
    else if (tache?.garantie) raison = "Garantie";
    else if (facturables[`${base}|${email}`] === false) raison = "🤝 Aide non facturable";
    if (raison) {
      e.nonFacturable += h;
      e.raisons[raison] = (e.raisons[raison] || 0) + h;
    } else {
      e.facturable += h;
    }
  });
  return Object.values(parTech)
    .map((e) => ({ ...e, taux: e.total > 0 ? e.facturable / e.total : 0 }))
    .sort((a, b) => b.total - a.total);
}

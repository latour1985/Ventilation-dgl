// lib/coutEmploye.js
//
// 💵 COÛT ANNUEL D'UN EMPLOYÉ (2026-09-21, demande du propriétaire —
// « ça calculerait le coût de l'employé sur l'année selon son salaire »),
// pensé d'abord pour le COMMISSIONNAIRE, mais valable pour n'importe qui.
//
// Décisions du propriétaire : payé à l'heure → le coût suit les heures
// RÉELLES pointées ; charges de l'employeur incluses (Paramètres →
// « Charges de l'employeur % ») ; coût en FRAIS GÉNÉRAUX, jamais
// réparti aux jobs (option simple).
//
//   salaire   = Σ heures × taux figé de chaque ligne (repli : taux de
//               la fiche) — chantier, transport, divers, tout ce qui est
//               payé ; journées bloquées exclues (pas encore validées).
//   charges   = salaire × charges %
//   camion    = Σ heures des jours où il conduisait × coût horaire du
//               camion (inspection du matin ; passager = 0)
//   total     = salaire + charges + camion
// Projection 12 mois : au rythme des semaines réellement travaillées
// depuis le début de l'année (pas du calendrier) — un employé arrivé en
// septembre n'est pas projeté comme s'il avait travaillé en janvier.

const semainesEntre = (debutISO, finISO) => Math.max(1, Math.round((new Date(`${finISO}T00:00:00`) - new Date(`${debutISO}T00:00:00`)) / (7 * 86400000)));

export function coutAnnuelEmploye({ courriel, travaux = [], inspections = [], tauxFiche = 0, chargesPct = 0, coutCamionDefaut = 0, debutAnneeISO, aujourdhuiISO, achatsLibres = [] }) {
  const moi = String(courriel || "").toLowerCase();
  if (!moi) return null;
  // Journée BLOQUÉE = la journée ENTIÈRE est exclue (comme à la paie), pas
  // seulement la ligne qui porte le drapeau (revue 2026-09-22).
  const siennes = (travaux || []).filter((t) => t.supabase && String(t.employeEmail || "").toLowerCase() === moi && t.date >= debutAnneeISO && t.date <= aujourdhuiISO);
  const joursBloques = new Set(siennes.filter((t) => t.jourBloque).map((t) => t.date));
  const lignes = siennes.filter((t) => !joursBloques.has(t.date));
  let heures = 0, heuresTransport = 0, salaire = 0, camion = 0;
  const jours = new Set();
  lignes.forEach((t) => {
    const h = Number(t.heures) || 0;
    // Le DÎNER non payé est une ligne NÉGATIVE : il réduit le salaire
    // (revue 2026-09-22 — il était ignoré, le coût était surévalué).
    if (h === 0) return;
    heures += h;
    if (t.estTransport) heuresTransport += h;
    jours.add(t.date);
    const taux = Number(t.tauxCoutantFige) > 0 ? Number(t.tauxCoutantFige) : Number(tauxFiche) || 0;
    salaire += h * taux;
    // 🚚 Le camion coûte quand il le CONDUIT (inspection du matin, pas passager).
    const insp = (inspections || []).find((i) => i.date === t.date && !i.sansVehicule && !i.passagerDeNom && String(i.technicienEmail || "").toLowerCase() === moi);
    if (insp) camion += h * (insp.coutCamionHoraire != null ? Number(insp.coutCamionHoraire) : Number(coutCamionDefaut) || 0);
  });
  const charges = salaire * ((Number(chargesPct) || 0) / 100);
  const total = salaire + charges + camion;
  // Rythme réel : de sa première journée pointée cette année à aujourd'hui.
  const premiereDate = [...jours].sort()[0] || null;
  const semaines = premiereDate ? semainesEntre(premiereDate, aujourdhuiISO) : 0;
  const parSemaine = semaines > 0 ? total / semaines : 0;
  const projection12Mois = parSemaine * 52;
  // Ramassages faits par lui cette année (bons reçus dont il était le ramasseur).
  const ramassages = (achatsLibres || []).filter(
    (a) => a.recuLe && String(a.ramassePar || "").toLowerCase() === moi && String(a.recuLe).slice(0, 10) >= debutAnneeISO
  ).length;
  return {
    heures, heuresTransport, joursTravailles: jours.size, semaines,
    salaire, charges, camion, total,
    heuresParSemaine: semaines > 0 ? heures / semaines : 0,
    projection12Mois,
    ramassages,
    coutParRamassage: ramassages > 0 ? total / ramassages : null,
    tauxFiche: Number(tauxFiche) || 0,
    chargesPct: Number(chargesPct) || 0,
    depuis: premiereDate,
  };
}

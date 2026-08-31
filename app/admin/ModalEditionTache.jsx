"use client";

// app/admin/ModalEditionTache.jsx
//
// FICHE D'UNE TACHE (edition complete depuis l'agenda) — tranche T12
// du decoupage de page.jsx (2026-09-01). Extraction MECANIQUE : aucun
// comportement ne change — seuls des export/import s'ajoutent.

import { useState } from "react";
import { Mail, MapPin, Phone, Plus, User, X } from "lucide-react";
import { useEntreprise } from "@/lib/contexteEntreprise";
import VisionneusePhotos from "@/components/VisionneusePhotos";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import { Button, HEURES, HEURES_QUART, HEURE_PAR_DEFAUT, courrielDefautClient, estTypeSansClient, libelleAdresse, todayISO } from "./partage";

export function ModalEditionTache({ tache, clients, employes, dateInitiale, heureInitiale, employeIdInitial, onFermer, onEnregistrer, techniciensSurTache, onAjouterTechnicien, travailFait, onRetirerHoraire, onAnnulerTache, annulation, onFermerPourTechnicien, projets, devisListe, onCreerProjetDepuisTache, onTraiterPropositionProjet }) {
  // ANNULATION EN DEUX TEMPS — un geste irréversible mérite deux clics
  // volontaires : 1) raison obligatoire (+ avertissements dépôt/pièce),
  // 2) dernière vérification en rouge. Adminis toujours ; répartiteur
  // seulement sans dépôt ni pièce (règle du propriétaire) ; app
  // technicien : jamais — ces props n'y existent pas.
  const [etapeAnnulation, setEtapeAnnulation] = useState(null); // null | "raison" | "confirmation"
  const [raisonAnnulation, setRaisonAnnulation] = useState("");
  const [date, setDate] = useState(dateInitiale || todayISO());
  const [heureDebut, setHeureDebut] = useState(heureInitiale || HEURE_PAR_DEFAUT);
  const [heures, setHeures] = useState(tache.heures ?? 1);
  const [jours, setJours] = useState(tache.jours ?? 1);
  const [sauterWeekend, setSauterWeekend] = useState(!!tache.sauterWeekend);
  // 📅 Sauter les fériés CCQ — offert quand l'entreprise suit le
  // calendrier de la construction (Paramètres → Paie & heures).
  const configEntCcq = useEntreprise();
  const [sauterFeries, setSauterFeries] = useState(!!tache.sauterFeries);
  const [employeId, setEmployeId] = useState(employeIdInitial || "");
  const [description, setDescription] = useState(tache.description || "");
  // 📇 Contact sur place — repris du carnet du client ; « actuel »
  // couvre un contact déjà attaché à la tâche mais absent du carnet
  // (retiré du carnet, ou client non résolu). ⚠️ On vérifie VRAIMENT
  // l'appartenance au carnet (audit 2026-08-17) : initialiser avec un
  // id introuvable faisait afficher « Aucun » au sélecteur alors que
  // l'enregistrement CONSERVAIT le contact — l'écran mentait et le
  // contact devenait impossible à retirer.
  const [contactTacheId, setContactTacheId] = useState(() => {
    if (!tache.contactSurPlace) return "";
    const ficheClient =
      (clients || []).find((c) => c.id === tache.clientId) || (clients || []).find((c) => c.nom === tache.clientNom);
    const dansCarnet = (ficheClient?.contacts || []).some((x) => x.id === tache.contactSurPlace.id);
    return dansCarnet ? tache.contactSurPlace.id : "actuel";
  });
  const dejaPlanifiee = !!employeIdInitial;
  // Assignation MULTIPLE à la création (édition rapide) : tous les
  // techniciens cochés reçoivent la tâche avec la même date/heure/durée
  // — chacun reste ensuite ajustable individuellement via la modale.
  const [employeIds, setEmployeIds] = useState([]);
  const basculerEmploye = (id) =>
    setEmployeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // Techniciens (autres que celui ouvert ici) qui recevront AUSSI la
  // modification — cases cochées dans « Appliquer la modification à… ».
  const [autresCibles, setAutresCibles] = useState([]);
  const basculerCible = (id) =>
    setAutresCibles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // ============================================================
  // 🏗️/📄 RATTACHEMENTS APRÈS COUP (demande du propriétaire, 2026-08-22)
  // ------------------------------------------------------------
  // Le projet et le devis ne se choisissaient qu'À LA CRÉATION : une
  // job qui devient partie d'un chantier, ou un devis fait après la
  // visite, n'avaient aucun moyen d'être rattachés. Ici, les deux se
  // changent — et les HEURES déjà pointées suivent (voir
  // rattacherProjetAuxHeures : sans ça, le coût réel du projet
  // resterait faux en silence).
  // ============================================================
  const [projetLie, setProjetLie] = useState(tache.projetId || "");
  const [devisLie, setDevisLie] = useState(tache.devisNumero || "");
  const [devisSaisiMain, setDevisSaisiMain] = useState("");
  // Projets proposés : ceux du client de la tâche d'abord ; les autres
  // restent accessibles (un chantier peut être ouvert sous une société
  // mère). Un projet terminé n'est plus proposé, mais s'il est déjà lié
  // il reste affiché — sinon l'écran mentirait sur le rattachement réel.
  const projetsProposes = (projets || []).filter(
    (p) => p.id === tache.projetId || (p.statut !== "Terminé" && (!tache.clientId || !p.clientId || p.clientId === tache.clientId))
  );
  const devisProposes = (devisListe || []).filter(
    (d) => d.numero === tache.devisNumero || !tache.clientId || !d.clientId || d.clientId === tache.clientId
  );
  const rattachementChange = (projetLie || "") !== (tache.projetId || "") ||
    (devisSaisiMain.trim() || devisLie || "") !== (tache.devisNumero || "");
  // Formulaire « Ajouter / dupliquer vers un technicien ».
  const dejaAssignes = (techniciensSurTache || []).map((t) => t.employeId);
  const [ajoutEmployeId, setAjoutEmployeId] = useState(
    () => (employes?.find((e) => !dejaAssignes.includes(e.id)) || employes?.[0])?.id || ""
  );
  const [ajoutDate, setAjoutDate] = useState(dateInitiale || todayISO());
  const [ajoutHeure, setAjoutHeure] = useState(heureInitiale || HEURE_PAR_DEFAUT);
  const [ajoutHeures, setAjoutHeures] = useState(tache.heures ?? 1);
  const [ajoutJours, setAjoutJours] = useState(tache.jours ?? 1);
  const lancerAjout = (dupliquer) =>
    onAjouterTechnicien?.({
      employeId: ajoutEmployeId,
      date: ajoutDate,
      heureDebut: ajoutHeure,
      heures: ajoutHeures,
      jours: ajoutJours,
      dupliquer,
    });

  // 🏢 FERMER POUR LE TECHNICIEN (oubli) — demande du propriétaire,
  // 2026-08-17. Offert SEULEMENT quand ce technicien n'a AUCUNE heure
  // sur la tâche : on ne réécrit jamais ce qu'il a pointé lui-même.
  const [fermDebut, setFermDebut] = useState(heureInitiale || HEURE_PAR_DEFAUT);
  const [fermFin, setFermFin] = useState("");
  const [fermBon, setFermBon] = useState(false); // décochée par défaut (choix du propriétaire)
  const [fermErreur, setFermErreur] = useState("");
  const nomTechOuvert = employes?.find((e) => e.id === employeIdInitial)?.nom || "le technicien";

  // 📸 VISIONNEUSE des photos du technicien (retour de tests
  // 2026-08-17) : avant, chaque vignette ouvrait un onglet — il fallait
  // ouvrir/fermer les photos une à une. Même visionneuse que partout
  // ailleurs : flèches, glissement de doigt, clavier.
  const photosTravail = [
    ...((travailFait?.photosAvantUrls || []).map((u, i) => ({ url: u, etiquette: `Avant ${i + 1}` }))),
    ...((travailFait?.photosApresUrls || []).map((u, i) => ({ url: u, etiquette: `Après ${i + 1}` }))),
  ];
  const [photoOuverte, setPhotoOuverte] = useState(null);
  const validerFermetureBureau = () => {
    if (!fermFin) {
      setFermErreur("Entre son heure de fin.");
      return;
    }
    if (fermFin <= fermDebut) {
      setFermErreur("L'heure de fin doit être après l'heure de début.");
      return;
    }
    onFermerPourTechnicien?.({ debutHM: fermDebut, finHM: fermFin, creerBon: fermBon });
  };

  // Fiche client complète — via clientId si disponible (tâches créées
  // récemment), sinon repli sur une recherche par nom (tâches plus
  // anciennes qui n'avaient que clientNom).
  const client = (clients || []).find((c) => c.id === tache.clientId) || (clients || []).find((c) => c.nom === tache.clientNom);
  const courrielClient = client ? courrielDefautClient(client) : null;
  // Adresse des TRAVAUX — jamais confondue avec l'adresse de
  // FACTURATION du client : `tache.adresseTravaux` est explicitement
  // distincte (voir sa création dans le formulaire "Nouvelle tâche").
  // Si aucune adresse de travaux propre n'a été fixée pour cette
  // tâche, on retombe sur l'adresse de facturation par défaut du
  // client, mais l'étiquette le précise sans ambiguïté.
  const adresseFacturationDefaut = client?.adresses?.[0];

  const enregistrer = () => {
    // Contact sur place résolu depuis le carnet (ou conservé tel quel).
    const carnetClient = client?.contacts || [];
    const contactChoisi =
      contactTacheId === ""
        ? null
        : contactTacheId === "actuel"
          ? tache.contactSurPlace || null
          : (() => {
              const c = carnetClient.find((x) => x.id === contactTacheId);
              return c ? { id: c.id, nom: c.nom, role: c.role || "", telephone: c.telephone || "" } : tache.contactSurPlace || null;
            })();
    onEnregistrer({
      heures: Math.max(0, heures),
      jours: Math.max(0, jours),
      sauterWeekend,
      sauterFeries,
      // Assignation immédiate seulement si un/des technicien(s) choisis —
      // sinon la tâche reste "en attente" avec sa durée mise à jour.
      employeId: dejaPlanifiee ? employeId || null : employeIds[0] || null,
      employeIds: dejaPlanifiee ? undefined : employeIds,
      date,
      heureDebut,
      description,
      contactSurPlace: contactChoisi,
      // 🏗️/📄 Rattachements — transmis SEULEMENT s'ils ont changé : une
      // clé absente laisse l'existant tranquille (les heures déjà
      // pointées ne sont alors jamais réécrites pour rien).
      ...((projetLie || "") !== (tache.projetId || "") ? { projetId: projetLie || null } : {}),
      ...((devisSaisiMain.trim() || devisLie || "") !== (tache.devisNumero || "")
        ? { devisNumero: devisSaisiMain.trim() || devisLie || null }
        : {}),
      // Autres techniciens cochés dans « Appliquer la modification à… » —
      // ils reçoivent les mêmes date/heure/durée/description sur leurs plages.
      autresCibles,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{dejaPlanifiee ? "Modifier la tâche" : "Édition rapide"}</h3>
            <p className="text-xs text-slate-500">{tache.titre || tache.clientNom}</p>
          </div>
          <button onClick={onFermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {/* CLIENT & ADRESSE DES TRAVAUX — l'adresse des travaux (où le
            technicien doit se rendre) n'est JAMAIS la même chose que
            l'adresse de facturation du client ; les deux sont
            affichées séparément, avec des étiquettes explicites, pour
            ne jamais les confondre au moment de l'envoi. */}
        <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <User size={13} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-bold text-slate-800">{client?.nom || tache.clientNom || "Client non spécifié"}</p>
              {client?.entreprise && client.entreprise !== client.nom && (
                <p className="text-[11px] text-slate-500">{client.entreprise}</p>
              )}
            </div>
          </div>
          {client?.telephone && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <Phone size={12} className="shrink-0 text-slate-400" /> {client.telephone}
            </p>
          )}
          {courrielClient && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <Mail size={12} className="shrink-0 text-slate-400" /> {courrielClient.email}
            </p>
          )}

          <div className="border-t border-slate-200 pt-2">
            {tache.adresseTravaux ? (
              <>
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  <MapPin size={11} /> Adresse des travaux
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">{tache.adresseTravaux}</p>
              </>
            ) : adresseFacturationDefaut ? (
              <>
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  <MapPin size={11} /> Adresse de facturation (par défaut — aucune adresse de travaux distincte définie)
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800">
                  {adresseFacturationDefaut.nom} — {libelleAdresse(adresseFacturationDefaut)}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-slate-400">Aucune adresse disponible pour ce client.</p>
            )}
          </div>
        </div>

        {/* NOTES DU TECHNICIEN (travail complété) — pour retrouver vite
            l'information quand le client rappelle pour des détails. */}
        {travailFait && (travailFait.noteTerrain || travailFait.noteInterne) && (
          <div className="mb-4 space-y-2">
            {travailFait.noteTerrain && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  📝 Note de terrain du technicien <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-bold normal-case">visible au client</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-emerald-900">{travailFait.noteTerrain}</p>
              </div>
            )}
            {travailFait.noteInterne && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  🔒 Note interne du technicien <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 font-bold normal-case">non visible au client</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{travailFait.noteInterne}</p>
              </div>
            )}
          </div>
        )}
        {/* PHOTOS DU CHANTIER prises par le technicien (avant/après) —
            cliquer une vignette ouvre la photo pleine grandeur. */}
        {travailFait && (travailFait.photosAvantUrls?.length > 0 || travailFait.photosApresUrls?.length > 0) && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            {[
              ["📷 Photos avant travaux", travailFait.photosAvantUrls, 0],
              ["📷 Photos après travaux", travailFait.photosApresUrls, (travailFait.photosAvantUrls || []).length],
            ].map(([titre, urls, decalage]) =>
              urls?.length > 0 ? (
                <div key={titre}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{titre}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {urls.map((u, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPhotoOuverte(decalage + i)}
                        title="Ouvrir la visionneuse (flèches pour naviguer)"
                        className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200 hover:border-slate-400"
                      >
                        <img src={u} alt={`${titre} ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
        {photoOuverte != null && photosTravail.length > 0 && (
          <VisionneusePhotos
            photos={photosTravail}
            indexDepart={photoOuverte}
            onFermer={() => setPhotoOuverte(null)}
          />
        )}

        {/* 🎥 VIDÉOS DU CHANTIER (2026-08-20) — un bruit, une vibration,
            une fuite : ce qu'une photo ne montre pas. Lecture directe
            dans la fiche, rien à télécharger. */}
        {(travailFait?.videosUrls || []).length > 0 && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              🎥 Vidéos du technicien ({travailFait.videosUrls.length})
            </p>
            {travailFait.videosUrls.map((u, i) => (
              <video key={i} src={u} controls preload="metadata" className="w-full rounded-lg bg-black" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Heure de début</label>
              {/* Quarts d'heure permis — la tâche occupe la case de
                  l'heure dans la grille, les minutes restent affichées. */}
              <select value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Heures / jour</label>
              {/* ⏱️ DEMI-HEURES ET QUARTS D'HEURE (2026-08-28) : le champ
                  faisait un parseInt — « 9,5 h » devenait 9 h en silence,
                  et le champ « number » du navigateur refusait de toute
                  façon la virgule. InputNombreDecimal accepte 9.5 ET 9,5,
                  comme partout ailleurs dans l'application. */}
              <InputNombreDecimal
                valeur={heures}
                onChange={(v) => setHeures(Math.max(0, Math.min(HEURES.length, Number(v) || 0)))}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Nombre de jours</label>
              <input
                type="number" min={0} value={jours}
                onChange={(e) => { const v = parseInt(e.target.value); setJours(Number.isNaN(v) ? 0 : Math.max(0, v)); }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          {jours >= 1 && (
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <input type="checkbox" checked={sauterWeekend} onChange={(e) => setSauterWeekend(e.target.checked)} className="h-3.5 w-3.5 accent-[#FF6A13]" />
              Sauter les samedis et dimanches
            </label>
          )}
          {jours >= 1 && configEntCcq?.calendrierCcq === true && (
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <input type="checkbox" checked={sauterFeries} onChange={(e) => setSauterFeries(e.target.checked)} className="h-3.5 w-3.5 accent-[#FF6A13]" />
              Sauter les jours fériés (calendrier CCQ)
            </label>
          )}

          {dejaPlanifiee ? (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Technicien attribué</label>
              <select value={employeId} onChange={(e) => setEmployeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                <option value="">— Laisser en attente (ne pas assigner) —</option>
                {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                {employeId
                  ? "Enregistrer déplacera la tâche à cette date/heure/technicien dans l'horaire."
                  : "Sans technicien, la tâche retournera dans les tâches en attente."}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Assigner à… (un ou plusieurs techniciens)</label>
              <div className="space-y-1.5">
                {employes.map((e) => (
                  <label key={e.id} className={`flex items-center gap-2.5 rounded-lg border p-2 ${employeIds.includes(e.id) ? "border-[#131B2E] bg-slate-50" : "border-slate-200"}`}>
                    <input
                      type="checkbox"
                      checked={employeIds.includes(e.id)}
                      onChange={() => basculerEmploye(e.id)}
                      className="h-4 w-4 shrink-0 accent-[#131B2E]"
                    />
                    <span className="text-xs font-bold text-slate-800">{e.nom}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {employeIds.length === 0
                  ? "Aucun technicien coché — seule la durée est enregistrée, la tâche reste en attente."
                  : employeIds.length === 1
                  ? "La tâche sera placée dans l'horaire de ce technicien."
                  : `La tâche sera placée chez ${employeIds.length} techniciens (même date/heure/durée) — ajuste ensuite chacun individuellement en cliquant son bloc.`}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">
              Description des travaux <span className="font-normal text-orange-600">(visible au technicien)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ce qu'il y a à faire sur cette tâche, instructions particulières..."
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>

          {/* 📇 CONTACT SUR PLACE — se confirme souvent APRÈS la création
              (« finalement c'est le concierge qui t'ouvre ») ; la mise à
              jour part en direct vers le téléphone du technicien. Les
              contacts s'ajoutent au carnet via la fiche client. */}
          {(client?.contacts?.length > 0 || tache.contactSurPlace) && (
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">Contact sur place</label>
              <select
                value={contactTacheId}
                onChange={(e) => setContactTacheId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="">Aucun — numéro de la fiche client</option>
                {tache.contactSurPlace && !(client?.contacts || []).some((x) => x.id === tache.contactSurPlace.id) && (
                  <option value="actuel">
                    {tache.contactSurPlace.nom}{tache.contactSurPlace.role ? ` — ${tache.contactSurPlace.role}` : ""} (actuel)
                  </option>
                )}
                {(client?.contacts || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}{c.role ? ` — ${c.role}` : ""}{c.telephone ? ` (${c.telephone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 🏗️ PROJET PROPOSÉ PAR LE TECHNICIEN (2026-08-31) — sur un
              travail au shop, le technicien peut dire pour quel projet
              il travaille. Décision du propriétaire : « ça demande une
              vérification » — RIEN ne compte tant que le bureau n'a pas
              confirmé ici. Confirmer pose le projet ET fait suivre les
              heures déjà pointées ; refuser efface la proposition. */}
          {tache.projetProposeId && onTraiterPropositionProjet && (
            <div className="rounded-xl border-2 border-lime-300 bg-lime-50 p-3">
              <p className="text-xs font-bold leading-snug text-lime-900">
                🏗️ {tache.projetProposePar || "Le technicien"} propose de lier ce travail au projet{" "}
                <span className="font-extrabold">« {tache.projetProposeNom || tache.projetProposeId} »</span>
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-lime-800">
                Vérifie que c&apos;est le bon projet : en confirmant, ses heures (déjà pointées et à venir) comptent
                dans les coûts de ce projet.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onTraiterPropositionProjet(tache, true)}
                  className="rounded-lg bg-lime-700 py-2 text-xs font-extrabold text-white active:scale-[0.99]"
                >
                  ✓ Confirmer le projet
                </button>
                <button
                  onClick={() => onTraiterPropositionProjet(tache, false)}
                  className="rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-600"
                >
                  ✗ Refuser
                </button>
              </div>
            </div>
          )}

          {/* 🏗️/📄 RATTACHEMENTS (2026-08-22) — projet et devis, changeables
              APRÈS la création. Les heures déjà pointées et le bon de
              travail déjà créé suivent le nouveau rattachement. */}
          {!estTypeSansClient(tache.typeTache) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Rattachements</p>

              <label className="mb-1 block text-[11px] font-bold text-slate-500">🏗️ Projet lié</label>
              <select
                value={projetLie}
                onChange={(e) => setProjetLie(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="">Aucun — hors projet</option>
                {projetsProposes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}{p.statut === "Terminé" ? " (terminé)" : ""}</option>
                ))}
              </select>
              {onCreerProjetDepuisTache && (
                <button
                  type="button"
                  onClick={() => onCreerProjetDepuisTache(tache)}
                  className="mt-1.5 w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-white"
                >
                  🏗️ Créer un projet à partir de cette tâche…
                </button>
              )}

              <label className="mt-3 mb-1 block text-[11px] font-bold text-slate-500">📄 Devis lié</label>
              <select
                value={devisSaisiMain.trim() ? "" : devisLie}
                onChange={(e) => { setDevisLie(e.target.value); setDevisSaisiMain(""); }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {devisProposes.map((d) => (
                  <option key={d.id || d.numero} value={d.numero}>
                    {d.numero}{d.clientNom ? ` — ${d.clientNom}` : ""}
                  </option>
                ))}
              </select>
              <input
                value={devisSaisiMain}
                onChange={(e) => setDevisSaisiMain(e.target.value)}
                placeholder="…ou un numéro de devis fait hors de l'application"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />

              {rattachementChange && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                  ⚠️ En enregistrant, les <span className="font-bold">heures déjà pointées</span> sur cette tâche et le
                  bon de travail déjà créé suivront ce rattachement — les coûts du projet se mettront à jour.
                </p>
              )}
            </div>
          )}

          {/* APPLIQUER LA MODIFICATION À… — visible dès que la tâche est
              partagée entre plusieurs techniciens. */}
          {dejaPlanifiee && (techniciensSurTache || []).length > 1 && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Appliquer la modification à…</p>
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                Coche les techniciens dont les plages recevront ces changements (date, heures, durée, description).
              </p>
              <div className="space-y-1.5">
                {(techniciensSurTache || []).map((t) => {
                  const estOuvert = t.employeId === employeIdInitial;
                  const coche = estOuvert || autresCibles.includes(t.employeId);
                  return (
                    <label key={t.employeId} className={`flex items-center gap-2.5 rounded-lg border p-2 ${estOuvert ? "border-[#131B2E] bg-slate-50" : "border-slate-200"}`}>
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={estOuvert}
                        onChange={() => basculerCible(t.employeId)}
                        className="h-4 w-4 shrink-0 accent-[#131B2E]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{t.nom}</p>
                        <p className="text-[10px] text-slate-400">{t.detail}</p>
                      </div>
                      {estOuvert && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">OUVERT ICI</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* AJOUTER / DUPLIQUER VERS UN TECHNICIEN */}
          {dejaPlanifiee && onAjouterTechnicien && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ajouter ou dupliquer vers un technicien</p>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Technicien</label>
                  <select value={ajoutEmployeId} onChange={(e) => setAjoutEmployeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                    {employes.map((e) => <option key={e.id} value={e.id}>{e.estSousTraitant ? `🤝 ${e.nom} (sous-traitant)` : e.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Date</label>
                  <input type="date" value={ajoutDate} onChange={(e) => setAjoutDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                </div>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heure début</label>
                  <select value={ajoutHeure} onChange={(e) => setAjoutHeure(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                    {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Heures / jour</label>
                  <input type="number" min={0} max={HEURES.length} value={ajoutHeures} onChange={(e) => { const v = parseInt(e.target.value); setAjoutHeures(Number.isNaN(v) ? 0 : Math.max(0, v)); }} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-slate-400">Jours</label>
                  <input type="number" min={0} value={ajoutJours} onChange={(e) => { const v = parseInt(e.target.value); setAjoutJours(Number.isNaN(v) ? 0 : Math.max(0, v)); }} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => lancerAjout(false)} className="min-h-0 py-2 text-xs">
                  <Plus size={12} /> Ajouter à cette tâche
                </Button>
                <Button variant="outline" onClick={() => lancerAjout(true)} className="min-h-0 py-2 text-xs">
                  Dupliquer (copie)
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                <span className="font-bold text-slate-500">Ajouter</span> = le technicien rejoint LA MÊME job : un seul
                bon de travail, les heures s&apos;additionnent, UNE seule facturation (signature par le dernier qui ferme).
                <br />
                <span className="font-bold text-slate-500">Dupliquer</span> = une job jumelle mais INDÉPENDANTE : son
                propre bon, sa propre facturation — pour deux interventions distinctes qui se ressemblent.
                <br />
                En résumé : même job à plusieurs bras = Ajouter · deux jobs séparées = Dupliquer. Les transports
                Début/Fin se créent automatiquement dans les deux cas.
              </p>
            </div>
          )}

          {/* 🏢 FERMER POUR LE TECHNICIEN (oubli) — visible seulement si
              AUCUNE heure n'est enregistrée par lui sur cette tâche.
              L'admin déclare début/fin : paie au taux figé, carte fermée
              sur le téléphone (avec avis), facturation en OPTION
              (bon sans signature ni photos — décochée par défaut). */}
          {dejaPlanifiee && !travailFait && onFermerPourTechnicien && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
                🕐 Fermer cette tâche pour {nomTechOuvert} (oubli)
              </p>
              <p className="mt-1 text-[10px] leading-snug text-amber-800">
                Aucune heure enregistrée par {nomTechOuvert} sur cette tâche. Déclare ses heures réelles : elles entrent
                en paie au taux figé, sa tâche se ferme sur son téléphone et il en est avisé.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-amber-700">Son heure de début</label>
                  <select value={fermDebut} onChange={(e) => { setFermDebut(e.target.value); setFermErreur(""); }} className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs">
                    {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-bold text-amber-700">Son heure de fin</label>
                  <select value={fermFin} onChange={(e) => { setFermFin(e.target.value); setFermErreur(""); }} className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs">
                    <option value="">— choisir —</option>
                    {HEURES_QUART.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={fermBon} onChange={(e) => setFermBon(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" />
                <span className="text-[10px] leading-snug text-amber-800">
                  Créer aussi la <span className="font-bold">demande de facturation</span> — le bon sera{" "}
                  <span className="font-bold">sans signature, sans photos ni notes terrain</span> (alerte « non signé »
                  visible au bureau). Décochée : paie seulement.
                </span>
              </label>
              {fermErreur && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">{fermErreur}</p>}
              <button
                type="button"
                onClick={validerFermetureBureau}
                className="mt-2 w-full rounded-lg border-2 border-amber-500 bg-white py-2 text-xs font-extrabold text-amber-700 active:scale-[0.99]"
              >
                🏢 Fermer pour {nomTechOuvert}
              </button>
            </div>
          )}

          {/* BOUTON COLLANT (2026-08-17, vécu) : il était enfoui sous les
              sections « Appliquer à… » et « Ajouter un technicien » — on
              modifiait le nombre de jours puis on fermait la fenêtre sans
              le trouver, et RIEN n'était enregistré. Il reste maintenant
              visible au bas de la fenêtre pendant qu'on défile. */}
          <div className="sticky bottom-0 -mx-1 border-t border-slate-200 bg-white px-1 pb-1 pt-2">
            <Button onClick={enregistrer} className="w-full">
              {dejaPlanifiee ? "Enregistrer les modifications" : employeId ? "Enregistrer et assigner" : "Enregistrer"}
            </Button>
          </div>

          {/* RETRAIT DE L'HORAIRE — le même geste que « Laisser en
              attente » du menu déroulant, mais VISIBLE : personne ne
              devine qu'une option de menu sert de bouton Retirer. */}
          {dejaPlanifiee && onRetirerHoraire && (
            <Button
              variant="outline"
              onClick={() => onRetirerHoraire({ heures: Math.max(0, heures), jours: Math.max(0, jours), sauterWeekend, sauterFeries, description })}
              className="min-h-0 w-full py-2 text-xs"
            >
              ↩️ Retirer de l&apos;horaire — la tâche retourne dans « Tâches en attente »
            </Button>
          )}

          {/* ANNULATION DÉFINITIVE — lien discret (pas un gros bouton
              rouge à côté d'Enregistrer), mais parcours en 2 étapes. */}
          {onAnnulerTache && travailFait && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-500">
              🔒 Un technicien a déjà exécuté du travail sur cette tâche — elle ne peut plus être annulée :
              elle doit se facturer (ou se créditer) via l&apos;onglet Facturation.
            </p>
          )}
          {onAnnulerTache && !travailFait && annulation?.permise && (
            <button
              onClick={() => setEtapeAnnulation("raison")}
              className="w-full text-center text-[11px] font-semibold text-slate-400 underline underline-offset-2 hover:text-red-600"
            >
              🗑️ Annuler cette tâche définitivement…
            </button>
          )}
          {onAnnulerTache && !travailFait && !annulation?.permise && annulation?.bloqueeRaison && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">{annulation.bloqueeRaison}</p>
          )}
        </div>
      </div>

      {/* ÉTAPE 1 — raison obligatoire + avertissements dépôt/pièce. */}
      {etapeAnnulation === "raison" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-base font-extrabold text-slate-900">🗑️ Annuler la tâche</p>
            <p className="mt-1 text-[13px] font-bold text-slate-700">« {tache.titre || tache.clientNom} »</p>
            {(annulation?.avertissements || []).map((a, i) => (
              <p key={i} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-snug text-amber-800">{a}</p>
            ))}
            <label className="mt-3 mb-0.5 block text-[10px] font-bold uppercase text-slate-400">Raison de l&apos;annulation *</label>
            <textarea
              value={raisonAnnulation}
              onChange={(e) => setRaisonAnnulation(e.target.value)}
              rows={2}
              placeholder="Ex. : le client a annulé son rendez-vous"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => { setEtapeAnnulation(null); setRaisonAnnulation(""); }} className="min-h-0 flex-1 py-2 text-xs">
                Retour
              </Button>
              <Button onClick={() => setEtapeAnnulation("confirmation")} disabled={raisonAnnulation.trim().length < 3} className="min-h-0 flex-1 py-2 text-xs">
                Continuer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 — dernière vérification, en rouge, irréversible. */}
      {etapeAnnulation === "confirmation" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <p className="text-base font-extrabold text-red-600">⚠️ Dernière vérification</p>
            <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
              La tâche <span className="font-bold text-slate-800">« {tache.titre || tache.clientNom} »</span> sera
              annulée <span className="font-bold">définitivement</span> : retirée de l&apos;horaire de tous les
              techniciens et de la liste d&apos;attente. Cette action est <span className="font-bold">irréversible</span>.
            </p>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-500">Raison : {raisonAnnulation.trim()}</p>
            <div className="mt-4 space-y-2">
              <Button
                variant="danger"
                onClick={() => onAnnulerTache(raisonAnnulation.trim())}
                className="min-h-[48px] w-full text-sm font-extrabold"
              >
                Oui, annuler définitivement
              </Button>
              <Button variant="outline" onClick={() => setEtapeAnnulation("raison")} className="min-h-[48px] w-full text-sm font-bold">
                Non, retour
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


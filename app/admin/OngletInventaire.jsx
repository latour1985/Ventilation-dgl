"use client";

// app/admin/OngletInventaire.jsx
//
// 📦 MODULE INVENTAIRE — OPTION PAYANTE (2026-10-08, demande du
// propriétaire ; maquette validée par le propriétaire).
//
// ÉTAPE 1 (bureau) :
//   • emplacements : l'entrepôt, un camion par technicien, des chantiers ;
//   • import de l'inventaire actuel, marqué « ⚠️ non vérifié » (décision
//     du propriétaire : les gars ont pu prendre du matériel non compté) ;
//   • comptage d'ouverture → chaque écart devient un ajustement daté et
//     signé, l'emplacement devient « ✓ vérifié » ;
//   • fiche article (codes, coût moyen, seuils par emplacement) ;
//   • mouvements à la main (réception, transfert, sortie, retour,
//     ajustement) et historique.
// Le stock ne s'écrit JAMAIS directement : tout passe par les fonctions
// de la base (snippet 170), qui vérifient l'option, l'entreprise et le
// rôle. 🧪 Visible seulement sur la version d'essai pour l'instant.

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Search, ArrowLeftRight, ClipboardCheck, History, RefreshCw } from "lucide-react";
import { useLangue } from "@/lib/i18n";
import InputNombreDecimal from "@/components/InputNombreDecimal";
import {
  TYPES_EMPLACEMENT,
  LIBELLES_MOUVEMENT,
  listerEmplacements,
  creerEmplacement,
  listerArticlesInventaire,
  majArticleInventaire,
  creerArticleInventaire,
  listerStock,
  majSeuil,
  listerMouvements,
  enregistrerMouvement,
  validerComptage,
  importerStockExistant,
} from "@/lib/supabase/inventaireModule";

const argent = (n) => `${(Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const qte = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toLocaleString("fr-CA", { maximumFractionDigits: 2 });
};
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "");
const dateHeure = (iso) =>
  iso ? `${new Date(iso).toLocaleDateString("fr-CA")} ${new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : "";
const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Fenetre({ titre, onFermer, children, large = false }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 md:items-center md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div className={`max-h-[92vh] w-full ${large ? "max-w-3xl" : "max-w-md"} overflow-y-auto rounded-2xl bg-white p-5 shadow-xl`}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900">{titre}</h3>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const champ = "w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm";
const etiquette = "mb-0.5 block text-[10px] font-bold uppercase text-slate-400";
const boutonPrincipal = "min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-extrabold text-white active:scale-[0.99] disabled:opacity-50";
const boutonSecondaire = "min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-slate-500 disabled:opacity-50";

export default function OngletInventaire({ utilisateurs = [], projets = [], ajouterJournal }) {
  const { t: tr } = useLangue();
  const [emplacements, setEmplacements] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stock, setStock] = useState([]);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [onglet, setOnglet] = useState("tous"); // "tous" | id d'emplacement
  const [recherche, setRecherche] = useState("");
  const [vue, setVue] = useState("stock"); // stock | comptage | historique
  const [ficheId, setFicheId] = useState(null);
  const [fenetreMouvement, setFenetreMouvement] = useState(null); // { articleId?, type? }
  const [fenetreEmplacement, setFenetreEmplacement] = useState(false);
  const [fenetreArticle, setFenetreArticle] = useState(false);

  const recharger = useCallback(async () => {
    setErreur("");
    try {
      const [e, a, s] = await Promise.all([listerEmplacements(), listerArticlesInventaire(), listerStock()]);
      setEmplacements(e);
      setArticles(a);
      setStock(s);
    } catch (err) {
      setErreur(err?.message || tr("Chargement impossible — le snippet 170 est-il passé ?"));
    } finally {
      setCharge(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const empParId = useMemo(() => new Map(emplacements.map((e) => [e.id, e])), [emplacements]);
  const artParId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const stockParArticle = useMemo(() => {
    const m = new Map();
    stock.forEach((s) => {
      if (!m.has(s.articleId)) m.set(s.articleId, []);
      m.get(s.articleId).push(s);
    });
    return m;
  }, [stock]);
  const entrepot = emplacements.find((e) => e.type === "entrepot" && e.actif) || null;
  const nomEmp = (id) => {
    const e = empParId.get(id);
    return e ? `${TYPES_EMPLACEMENT[e.type]?.icone || ""} ${e.nom}` : "—";
  };

  // Lignes de stock visibles selon l'onglet.
  const lignesVisibles = useMemo(
    () => (onglet === "tous" ? stock : stock.filter((s) => s.emplacementId === onglet)),
    [stock, onglet]
  );
  const indicateurs = useMemo(() => {
    let valeur = 0;
    let nonVerifies = 0;
    let sousSeuil = 0;
    let negatifs = 0;
    const artVus = new Set();
    lignesVisibles.forEach((s) => {
      const a = artParId.get(s.articleId);
      valeur += Math.max(0, s.quantite) * (a?.coutMoyen || 0);
      if (!s.verifieLe) nonVerifies += 1;
      if (s.seuilMin != null && s.quantite < s.seuilMin) sousSeuil += 1;
      if (s.quantite < 0) negatifs += 1;
      artVus.add(s.articleId);
    });
    return { valeur, nonVerifies, sousSeuil, negatifs, nbArticles: artVus.size };
  }, [lignesVisibles, artParId]);

  // Articles de l'ancien écran encore jamais importés (aucune ligne de stock).
  const aImporter = articles.filter((a) => a.quantiteAncienne > 0 && !stockParArticle.has(a.id));

  const articlesAffiches = useMemo(() => {
    const q = sansAccents(recherche.trim());
    const base =
      onglet === "tous"
        ? articles.filter((a) => stockParArticle.has(a.id))
        : articles.filter((a) => (stockParArticle.get(a.id) || []).some((s) => s.emplacementId === onglet));
    if (!q) return base;
    return base.filter((a) => sansAccents(`${a.nom} ${a.codeProduit} ${a.codeBarres} ${a.fournisseurNom}`).includes(q));
  }, [articles, stockParArticle, onglet, recherche]);

  const importer = async () => {
    if (!entrepot) return;
    if (!window.confirm(tr("Importer {n} article(s) de ton inventaire actuel dans « {emp} » ? Les quantités seront marquées « ⚠️ non vérifié » jusqu'au premier comptage.", { n: aImporter.length, emp: entrepot.nom }))) return;
    try {
      const n = await importerStockExistant(entrepot.id);
      ajouterJournal?.(`📦 Inventaire : ${n} article(s) importé(s) dans « ${entrepot.nom} » — non vérifié(s), à compter.`);
      setMessage(tr("{n} article(s) importé(s) — à vérifier par un comptage.", { n }));
      await recharger();
    } catch (err) {
      setErreur(err?.message || tr("Import impossible."));
    }
  };

  if (charge) return <div className="mx-auto max-w-5xl p-6 text-sm text-slate-400">{tr("Chargement de l'inventaire…")}</div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            📦 {tr("Inventaire")}{" "}
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-extrabold text-amber-800">🧪 {tr("Version d'essai")}</span>
          </h2>
          <p className="text-xs text-slate-500">{tr("Stock par emplacement — entrepôt, camions, chantiers.")}</p>
        </div>
        {emplacements.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setFenetreArticle(true)} className="flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-slate-500">
              <Plus size={14} /> {tr("Article")}
            </button>
            <button type="button" onClick={() => setFenetreMouvement({})} className="flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-slate-500">
              <ArrowLeftRight size={14} /> {tr("Mouvement")}
            </button>
            <button type="button" onClick={() => setVue(vue === "comptage" ? "stock" : "comptage")} className={`flex min-h-[40px] items-center gap-1 rounded-xl px-3 text-xs font-bold ${vue === "comptage" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}>
              <ClipboardCheck size={14} /> {tr("Comptage")}
            </button>
            <button type="button" onClick={() => setVue(vue === "historique" ? "stock" : "historique")} className={`flex min-h-[40px] items-center gap-1 rounded-xl px-3 text-xs font-bold ${vue === "historique" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`}>
              <History size={14} /> {tr("Historique")}
            </button>
            <button type="button" onClick={recharger} aria-label={tr("Actualiser")} className="flex min-h-[40px] items-center rounded-xl border border-slate-300 bg-white px-2.5 text-slate-500 hover:border-slate-500">
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>

      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
      {message && (
        <p className="flex items-start justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          <span>✓ {message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label={tr("Fermer")}>
            <X size={14} />
          </button>
        </p>
      )}

      {emplacements.length === 0 ? (
        <Installation utilisateurs={utilisateurs} onFait={async (n) => { ajouterJournal?.(`📦 Inventaire : ${n} emplacement(s) créé(s).`); await recharger(); }} />
      ) : (
        <>
          {aImporter.length > 0 && entrepot && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-amber-900">⚠️ {tr("{n} article(s) de ton inventaire actuel ne sont pas encore ici", { n: aImporter.length })}</p>
                <p className="text-xs text-amber-800">{tr("L'import les place dans « {emp} », marqués « non vérifié ». Le premier comptage donnera les vraies quantités.", { emp: entrepot.nom })}</p>
              </div>
              <button type="button" onClick={importer} className={boutonPrincipal}>
                {tr("Importer (non vérifié)")}
              </button>
            </div>
          )}

          {/* Onglets d'emplacement */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[{ id: "tous", libelle: `🗂️ ${tr("Tous")}` }, ...emplacements.filter((e) => e.actif).map((e) => ({ id: e.id, libelle: `${TYPES_EMPLACEMENT[e.type]?.icone || ""} ${e.nom}` }))].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOnglet(o.id)}
                className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-bold ${onglet === o.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}
              >
                {o.libelle}
              </button>
            ))}
            <button type="button" onClick={() => setFenetreEmplacement(true)} className="min-h-[40px] shrink-0 whitespace-nowrap rounded-full border border-dashed border-slate-300 px-3 text-xs font-bold text-slate-500 hover:border-slate-500">
              + {tr("Emplacement")}
            </button>
          </div>

          {vue === "comptage" ? (
            <Comptage
              emplacements={emplacements.filter((e) => e.actif)}
              articles={articles}
              stock={stock}
              empInitial={onglet !== "tous" ? onglet : entrepot?.id || emplacements[0]?.id}
              onFait={async (n, empId, ecarts, valeurEcart) => {
                ajouterJournal?.(`🧮 Comptage validé — ${nomEmp(empId).trim()} : ${n} article(s) compté(s), ${ecarts} écart(s) (${argent(valeurEcart)}).`);
                setMessage(tr("Comptage validé : {n} article(s), {e} écart(s) enregistré(s) à l'historique.", { n, e: ecarts }));
                setVue("stock");
                await recharger();
              }}
            />
          ) : vue === "historique" ? (
            <Historique emplacementId={onglet !== "tous" ? onglet : null} artParId={artParId} nomEmp={nomEmp} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Tuile titre={tr("Valeur du stock")} valeur={argent(indicateurs.valeur)} sous={tr("au coût moyen")} />
                <Tuile titre={tr("Articles")} valeur={String(indicateurs.nbArticles)} />
                <Tuile titre={tr("Non vérifiés")} valeur={String(indicateurs.nonVerifies)} sous={tr("à compter")} alerte={indicateurs.nonVerifies > 0} />
                <Tuile titre={tr("Sous le seuil")} valeur={String(indicateurs.sousSeuil)} sous={indicateurs.negatifs > 0 ? tr("{n} négatif(s)", { n: indicateurs.negatifs }) : ""} alerte={indicateurs.sousSeuil > 0 || indicateurs.negatifs > 0} />
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-slate-500">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={tr("Chercher un article, un code…")} className="min-h-[44px] w-full bg-transparent text-sm outline-none" />
              </label>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {articlesAffiches.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400">
                    {stock.length === 0 ? tr("Aucun stock encore — importe ton inventaire actuel ou crée un article.") : tr("Aucun article ici.")}
                  </p>
                ) : (
                  articlesAffiches.map((a) => {
                    const lignes = (stockParArticle.get(a.id) || []).filter((s) => onglet === "tous" || s.emplacementId === onglet);
                    const total = lignes.reduce((t, s) => t + s.quantite, 0);
                    const nonVerifie = lignes.some((s) => !s.verifieLe);
                    const sousSeuil = lignes.some((s) => s.seuilMin != null && s.quantite < s.seuilMin);
                    const verifieLe = lignes.map((s) => s.verifieLe).filter(Boolean).sort().pop();
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setFicheId(a.id)}
                        className="flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-left first:border-t-0 hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-800">{a.nom}</p>
                          <p className="truncate text-[11px] text-slate-400">
                            {[a.codeProduit, a.fournisseurNom].filter(Boolean).join(" · ") || "—"}
                            {onglet === "tous" && lignes.length > 0 && <span className="ml-1 text-slate-500">· {lignes.map((s) => `${nomEmp(s.emplacementId).trim()} ${qte(s.quantite)}`).join(" · ")}</span>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-extrabold tabular-nums ${total < 0 ? "text-red-600" : "text-slate-900"}`}>
                            {qte(total)} <span className="text-[10px] font-semibold text-slate-400">{a.unite}</span>
                          </p>
                          <p className="text-[10px] font-bold">
                            {nonVerifie ? (
                              <span className="text-amber-700">⚠️ {tr("non vérifié")}</span>
                            ) : (
                              <span className="text-emerald-700">✓ {verifieLe ? dateCourte(verifieLe) : tr("vérifié")}</span>
                            )}
                            {sousSeuil && <span className="ml-1 text-red-600">🔻 {tr("seuil")}</span>}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </>
      )}

      {ficheId && artParId.get(ficheId) && (
        <FicheArticle
          article={artParId.get(ficheId)}
          lignes={stockParArticle.get(ficheId) || []}
          nomEmp={nomEmp}
          onFermer={() => setFicheId(null)}
          onMouvement={() => setFenetreMouvement({ articleId: ficheId })}
          onModifie={async (resume) => {
            if (resume) ajouterJournal?.(resume);
            await recharger();
          }}
        />
      )}
      {fenetreMouvement && (
        <FenetreMouvement
          initial={fenetreMouvement}
          articles={articles}
          emplacements={emplacements.filter((e) => e.actif)}
          stock={stock}
          onFermer={() => setFenetreMouvement(null)}
          onFait={async (resume) => {
            ajouterJournal?.(resume);
            setFenetreMouvement(null);
            setMessage(tr("Mouvement enregistré."));
            await recharger();
          }}
        />
      )}
      {fenetreEmplacement && (
        <FenetreEmplacement
          utilisateurs={utilisateurs}
          projets={projets}
          onFermer={() => setFenetreEmplacement(false)}
          onFait={async (nom) => {
            ajouterJournal?.(`📦 Inventaire : emplacement « ${nom} » créé.`);
            setFenetreEmplacement(false);
            await recharger();
          }}
        />
      )}
      {fenetreArticle && (
        <FenetreNouvelArticle
          onFermer={() => setFenetreArticle(false)}
          onFait={async (id, nom) => {
            ajouterJournal?.(`📦 Inventaire : article « ${nom} » créé.`);
            setFenetreArticle(false);
            await recharger();
            setFicheId(id);
          }}
        />
      )}
    </div>
  );
}

function Tuile({ titre, valeur, sous = "", alerte = false }) {
  return (
    <div className={`rounded-2xl border p-3 ${alerte ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[10px] font-extrabold uppercase text-slate-400">{titre}</p>
      <p className={`mt-0.5 text-lg font-extrabold tabular-nums ${alerte ? "text-amber-800" : "text-slate-900"}`}>{valeur}</p>
      {sous && <p className="text-[10px] text-slate-500">{sous}</p>}
    </div>
  );
}

// ------------------------------------------------------------
// 1re utilisation : l'entrepôt + un camion par technicien choisi.
// ------------------------------------------------------------
function Installation({ utilisateurs, onFait }) {
  const { t: tr } = useLangue();
  const [nomEntrepot, setNomEntrepot] = useState("Entrepôt");
  const candidats = utilisateurs.filter((u) => u.courriel);
  const [camions, setCamions] = useState(() => new Set());
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const creer = async () => {
    setEnCours(true);
    setErreur("");
    let n = 0;
    try {
      if (nomEntrepot.trim()) {
        await creerEmplacement({ nom: nomEntrepot.trim(), type: "entrepot" });
        n += 1;
      }
      for (const u of candidats.filter((c) => camions.has(c.courriel))) {
        await creerEmplacement({ nom: `Camion — ${u.nom}`, type: "camion", responsableEmail: u.courriel });
        n += 1;
      }
      await onFait(n);
    } catch (err) {
      setErreur(err?.message || tr("Création impossible."));
    } finally {
      setEnCours(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-extrabold text-slate-900">{tr("Pour commencer : tes emplacements")}</p>
        <p className="text-xs text-slate-500">{tr("L'entrepôt et un camion par technicien. Les chantiers s'ajoutent plus tard, au besoin.")}</p>
      </div>
      <div>
        <label className={etiquette}>🏭 {tr("Entrepôt")}</label>
        <input value={nomEntrepot} onChange={(e) => setNomEntrepot(e.target.value)} className={champ} />
      </div>
      <div>
        <p className={etiquette}>🚚 {tr("Un camion pour…")}</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {candidats.map((u) => (
            <label key={u.courriel} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-sm">
              <input
                type="checkbox"
                checked={camions.has(u.courriel)}
                onChange={() =>
                  setCamions((prev) => {
                    const s = new Set(prev);
                    if (s.has(u.courriel)) s.delete(u.courriel);
                    else s.add(u.courriel);
                    return s;
                  })
                }
                className="h-4 w-4"
              />
              <span className="min-w-0 truncate">{u.nom}</span>
            </label>
          ))}
        </div>
      </div>
      {erreur && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
      <button type="button" disabled={enCours || (!nomEntrepot.trim() && camions.size === 0)} onClick={creer} className={boutonPrincipal}>
        {enCours ? tr("Création…") : tr("Créer les emplacements")}
      </button>
    </div>
  );
}

function FenetreEmplacement({ utilisateurs, projets, onFermer, onFait }) {
  const { t: tr } = useLangue();
  const [type, setType] = useState("camion");
  const [nom, setNom] = useState("");
  const [resp, setResp] = useState("");
  const [projetId, setProjetId] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const nomPropose =
    type === "camion" && resp ? `Camion — ${utilisateurs.find((u) => u.courriel === resp)?.nom || resp}` : type === "chantier" && projetId ? `Chantier — ${projets.find((p) => p.id === projetId)?.nom || projetId}` : "";
  const nomFinal = nom.trim() || nomPropose;
  const creer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await creerEmplacement({ nom: nomFinal, type, responsableEmail: type === "camion" ? resp || null : null, projetId: type === "chantier" ? projetId || null : null });
      await onFait(nomFinal);
    } catch (err) {
      setErreur(err?.message || tr("Création impossible."));
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre={`+ ${tr("Emplacement")}`} onFermer={onFermer}>
      <div className="space-y-2.5">
        <div className="flex gap-1.5">
          {Object.entries(TYPES_EMPLACEMENT).map(([cle, t]) => (
            <button key={cle} type="button" onClick={() => setType(cle)} className={`min-h-[40px] flex-1 rounded-xl border text-xs font-bold ${type === cle ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
              {t.icone} {tr(t.libelle)}
            </button>
          ))}
        </div>
        {type === "camion" && (
          <div>
            <label className={etiquette}>{tr("Technicien responsable")}</label>
            <select value={resp} onChange={(e) => setResp(e.target.value)} className={champ}>
              <option value="">—</option>
              {utilisateurs.filter((u) => u.courriel).map((u) => (
                <option key={u.courriel} value={u.courriel}>{u.nom}</option>
              ))}
            </select>
          </div>
        )}
        {type === "chantier" && (
          <div>
            <label className={etiquette}>{tr("Projet")}</label>
            <select value={projetId} onChange={(e) => setProjetId(e.target.value)} className={champ}>
              <option value="">—</option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={etiquette}>{tr("Nom")}</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={nomPropose || tr("ex. Remorque, Atelier 2…")} className={champ} />
        </div>
        {erreur && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
        <button type="button" disabled={enCours || !nomFinal} onClick={creer} className={`${boutonPrincipal} w-full`}>
          {tr("Créer")}
        </button>
      </div>
    </Fenetre>
  );
}

function FenetreNouvelArticle({ onFermer, onFait }) {
  const { t: tr } = useLangue();
  const [f, setF] = useState({ nom: "", unite: "", codeProduit: "", codeBarres: "", fournisseurNom: "", coutMoyen: 0 });
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const creer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      const id = await creerArticleInventaire(f);
      await onFait(id, f.nom);
    } catch (err) {
      setErreur(err?.message || tr("Création impossible."));
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre={`+ ${tr("Article")}`} onFermer={onFermer}>
      <ChampsArticle f={f} setF={setF} />
      {erreur && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
      <p className="mt-2 text-[11px] text-slate-500">{tr("Le stock s'ajoute ensuite par une réception, un transfert ou un comptage.")}</p>
      <button type="button" disabled={enCours || !f.nom.trim()} onClick={creer} className={`${boutonPrincipal} mt-3 w-full`}>
        {tr("Créer l'article")}
      </button>
    </Fenetre>
  );
}

function ChampsArticle({ f, setF }) {
  const { t: tr } = useLangue();
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="space-y-2.5">
      <div>
        <label className={etiquette}>{tr("Nom")}</label>
        <input value={f.nom} onChange={maj("nom")} className={champ} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={etiquette}>{tr("Code produit")}</label>
          <input value={f.codeProduit} onChange={maj("codeProduit")} className={champ} />
        </div>
        <div>
          <label className={etiquette}>{tr("Code-barres")}</label>
          <input value={f.codeBarres} onChange={maj("codeBarres")} className={champ} />
        </div>
        <div>
          <label className={etiquette}>{tr("Unité")}</label>
          <input value={f.unite} onChange={maj("unite")} placeholder={tr("ex. boîte, rouleau")} className={champ} />
        </div>
        <div>
          <label className={etiquette}>{tr("Coût moyen ($)")}</label>
          <InputNombreDecimal valeur={Number(f.coutMoyen) || 0} onChange={(v) => setF((x) => ({ ...x, coutMoyen: v }))} className={`${champ} tabular-nums`} />
        </div>
      </div>
      <div>
        <label className={etiquette}>{tr("Fournisseur habituel")}</label>
        <input value={f.fournisseurNom} onChange={maj("fournisseurNom")} className={champ} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Fiche article : codes, coût, stock par emplacement (+ seuils),
// historique de l'article.
// ------------------------------------------------------------
function FicheArticle({ article, lignes, nomEmp, onFermer, onMouvement, onModifie }) {
  const { t: tr } = useLangue();
  const [f, setF] = useState({
    nom: article.nom,
    unite: article.unite,
    codeProduit: article.codeProduit,
    codeBarres: article.codeBarres,
    fournisseurNom: article.fournisseurNom,
    coutMoyen: article.coutMoyen,
  });
  const [seuils, setSeuils] = useState(() => Object.fromEntries(lignes.map((s) => [s.emplacementId, s.seuilMin ?? ""])));
  const [mouvements, setMouvements] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    listerMouvements({ articleId: article.id, limite: 50 })
      .then(setMouvements)
      .catch(() => setMouvements([]));
  }, [article.id]);
  const total = lignes.reduce((t, s) => t + s.quantite, 0);
  const enregistrer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await majArticleInventaire(article.id, f);
      for (const s of lignes) {
        const avant = s.seuilMin ?? "";
        if (String(avant) !== String(seuils[s.emplacementId] ?? "")) await majSeuil(article.id, s.emplacementId, seuils[s.emplacementId]);
      }
      await onModifie(`✏️ Inventaire : fiche « ${f.nom} » modifiée.`);
      onFermer();
    } catch (err) {
      setErreur(err?.message || tr("Enregistrement impossible — réessaie."));
      setEnCours(false);
    }
  };
  return (
    <Fenetre titre={`📦 ${article.nom}`} onFermer={onFermer} large>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ChampsArticle f={f} setF={setF} />
          <p className="mt-2 text-[10px] leading-snug text-slate-400">{tr("Le coût moyen se recalcule à chaque réception avec un prix ; ici, tu peux poser la valeur de départ.")}</p>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-extrabold text-slate-700">{tr("Stock par emplacement")}</p>
              <p className="text-xs font-extrabold tabular-nums text-slate-900">
                {qte(total)} {article.unite}
              </p>
            </div>
            {lignes.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400">{tr("Aucun stock pour l'instant.")}</p>
            ) : (
              lignes.map((s) => (
                <div key={s.emplacementId} className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-700">{nomEmp(s.emplacementId)}</p>
                    <p className="text-[10px]">{s.verifieLe ? <span className="text-emerald-700">✓ {tr("vérifié le {d}", { d: dateCourte(s.verifieLe) })}</span> : <span className="text-amber-700">⚠️ {tr("non vérifié")}</span>}</p>
                  </div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    {tr("seuil")}
                    <input
                      type="number"
                      min={0}
                      value={seuils[s.emplacementId] ?? ""}
                      onChange={(e) => setSeuils((x) => ({ ...x, [s.emplacementId]: e.target.value }))}
                      className="w-14 rounded-lg border border-slate-300 px-1.5 py-1 text-xs tabular-nums"
                    />
                  </label>
                  <p className={`w-12 text-right text-sm font-extrabold tabular-nums ${s.quantite < 0 ? "text-red-600" : "text-slate-900"}`}>{qte(s.quantite)}</p>
                </div>
              ))
            )}
          </div>
          <button type="button" onClick={onMouvement} className={`${boutonSecondaire} w-full`}>
            ↔ {tr("Mouvement pour cet article")}
          </button>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-extrabold text-slate-700">🕘 {tr("Historique de l'article")}</p>
        {mouvements === null ? (
          <p className="text-xs text-slate-400">{tr("Chargement…")}</p>
        ) : mouvements.length === 0 ? (
          <p className="text-xs text-slate-400">{tr("Aucun mouvement.")}</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {mouvements.map((m) => (
              <LigneMouvement key={m.id} m={m} nomEmp={nomEmp} />
            ))}
          </div>
        )}
      </div>
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onFermer} className={boutonSecondaire}>
          {tr("Annuler")}
        </button>
        <button type="button" disabled={enCours || !f.nom.trim()} onClick={enregistrer} className={boutonPrincipal}>
          {tr("Enregistrer")}
        </button>
      </div>
    </Fenetre>
  );
}

function LigneMouvement({ m, nomEmp, nomArticle = null }) {
  const { t: tr } = useLangue();
  const signe = m.type === "comptage" || m.type === "ajustement" ? (m.vers ? "+" : "−") : "";
  const trajet =
    m.de && m.vers ? `${nomEmp(m.de).trim()} → ${nomEmp(m.vers).trim()}` : m.de ? `${tr("de")} ${nomEmp(m.de).trim()}` : m.vers ? `${tr("vers")} ${nomEmp(m.vers).trim()}` : "";
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600">
      <span className="tabular-nums text-slate-400">{dateHeure(m.le)}</span> · <span className="font-extrabold text-slate-800">{tr(LIBELLES_MOUVEMENT[m.type] || m.type)}</span>{" "}
      <span className="font-extrabold tabular-nums">
        {signe}
        {qte(m.quantite)}
      </span>
      {nomArticle ? <span className="font-bold text-slate-700"> {nomArticle}</span> : null} · {trajet}
      {m.coutUnitaire != null && m.coutUnitaire > 0 ? <span className="text-slate-400"> · {argent(m.coutUnitaire * m.quantite)}</span> : null}
      {m.bcNumero ? <span className="text-slate-500"> · {m.bcNumero}</span> : null}
      {m.note ? <span className="block text-slate-500">📝 {m.note}</span> : null}
      {m.parEmail ? <span className="block text-[10px] text-slate-400">{tr("par")} {m.parEmail}</span> : null}
    </div>
  );
}

// ------------------------------------------------------------
// Mouvement à la main (bureau).
// ------------------------------------------------------------
function FenetreMouvement({ initial, articles, emplacements, stock, onFermer, onFait }) {
  const { t: tr } = useLangue();
  const [type, setType] = useState(initial.type || "transfert");
  const [articleId, setArticleId] = useState(initial.articleId || "");
  const [filtre, setFiltre] = useState("");
  const [de, setDe] = useState("");
  const [vers, setVers] = useState("");
  const [sens, setSens] = useState("-"); // ajustement : + ou −
  const [quantite, setQuantite] = useState(1);
  const [cout, setCout] = useState("");
  const [bc, setBc] = useState("");
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const besoinDe = type === "transfert" || type === "sortie" || (type === "ajustement" && sens === "-");
  const besoinVers = type === "transfert" || type === "reception" || type === "retour" || (type === "ajustement" && sens === "+");
  const article = articles.find((a) => a.id === articleId);
  const dispo = (empId) => stock.find((s) => s.articleId === articleId && s.emplacementId === empId)?.quantite ?? 0;
  const choix = articles.filter((a) => !filtre.trim() || sansAccents(`${a.nom} ${a.codeProduit} ${a.codeBarres}`).includes(sansAccents(filtre.trim())));
  const valide = articleId && Number(quantite) > 0 && (!besoinDe || de) && (!besoinVers || vers) && !(type === "transfert" && de === vers) && (type !== "ajustement" || note.trim());
  const enregistrer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      const typeBase = type;
      await enregistrerMouvement({
        articleId,
        type: typeBase,
        de: besoinDe ? de : null,
        vers: besoinVers ? vers : null,
        quantite: Number(quantite),
        cout: type === "reception" && cout !== "" ? Number(cout) : null,
        bcNumero: type === "reception" ? bc.trim() || null : null,
        note: note.trim() || null,
      });
      const nomE = (id) => emplacements.find((e) => e.id === id)?.nom || "?";
      const trajet = besoinDe && besoinVers ? `${nomE(de)} → ${nomE(vers)}` : besoinDe ? `de ${nomE(de)}` : `vers ${nomE(vers)}`;
      await onFait(`📦 Inventaire — ${LIBELLES_MOUVEMENT[type]} : ${type === "ajustement" ? sens : ""}${quantite} × « ${article?.nom || "?"} » (${trajet})${note.trim() ? ` — ${note.trim()}` : ""}.`);
    } catch (err) {
      setErreur(err?.message || tr("Mouvement refusé — réessaie."));
      setEnCours(false);
    }
  };
  const selectEmp = (valeur, setValeur, libelle) => (
    <div>
      <label className={etiquette}>{libelle}</label>
      <select value={valeur} onChange={(e) => setValeur(e.target.value)} className={champ}>
        <option value="">—</option>
        {emplacements.map((e) => (
          <option key={e.id} value={e.id}>
            {TYPES_EMPLACEMENT[e.type]?.icone} {e.nom}
            {articleId ? ` (${qte(dispo(e.id))})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <Fenetre titre={`↔ ${tr("Mouvement")}`} onFermer={onFermer}>
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {["reception", "transfert", "sortie", "retour", "ajustement"].map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={`min-h-[36px] rounded-full border px-3 text-xs font-bold ${type === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
              {tr(LIBELLES_MOUVEMENT[t])}
            </button>
          ))}
        </div>
        <div>
          <label className={etiquette}>{tr("Article")}</label>
          {!initial.articleId && <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={tr("Filtrer…")} className={`${champ} mb-1`} />}
          <select value={articleId} onChange={(e) => setArticleId(e.target.value)} className={champ}>
            <option value="">—</option>
            {choix.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
                {a.codeProduit ? ` (${a.codeProduit})` : ""}
              </option>
            ))}
          </select>
        </div>
        {type === "ajustement" && (
          <div className="flex gap-1.5">
            {[["-", tr("− Retirer")], ["+", tr("+ Ajouter")]].map(([s, l]) => (
              <button key={s} type="button" onClick={() => setSens(s)} className={`min-h-[40px] flex-1 rounded-xl border text-xs font-bold ${sens === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        {besoinDe && selectEmp(de, setDe, type === "ajustement" ? tr("Emplacement") : tr("De"))}
        {besoinVers && selectEmp(vers, setVers, type === "ajustement" ? tr("Emplacement") : tr("Vers"))}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={etiquette}>{tr("Quantité")}</label>
            <InputNombreDecimal valeur={Number(quantite) || 0} onChange={setQuantite} className={`${champ} tabular-nums`} />
          </div>
          {type === "reception" && (
            <div>
              <label className={etiquette}>{tr("Coût unitaire ($)")}</label>
              <input type="number" min={0} step="0.01" value={cout} onChange={(e) => setCout(e.target.value)} placeholder={article ? String(article.coutMoyen || "") : ""} className={`${champ} tabular-nums`} />
            </div>
          )}
        </div>
        {type === "reception" && (
          <div>
            <label className={etiquette}>{tr("Numéro de BC (facultatif)")}</label>
            <input value={bc} onChange={(e) => setBc(e.target.value)} placeholder="BC-1086" className={champ} />
          </div>
        )}
        <div>
          <label className={etiquette}>{type === "ajustement" ? tr("Raison (obligatoire)") : tr("Note (facultative)")}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "ajustement" ? tr("ex. brisé, perdu, erreur de saisie") : ""} className={champ} />
        </div>
        {erreur && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
        <button type="button" disabled={enCours || !valide} onClick={enregistrer} className={`${boutonPrincipal} w-full`}>
          {tr("Enregistrer le mouvement")}
        </button>
        <p className="text-[10px] leading-snug text-slate-400">{tr("Un mouvement ne s'efface pas : une erreur se corrige par un ajustement, qui reste à l'historique.")}</p>
      </div>
    </Fenetre>
  );
}

// ------------------------------------------------------------
// Comptage physique d'un emplacement.
// ------------------------------------------------------------
function Comptage({ emplacements, articles, stock, empInitial, onFait }) {
  const { t: tr } = useLangue();
  const [empId, setEmpId] = useState(empInitial || "");
  const [comptes, setComptes] = useState({}); // articleId → valeur saisie ("" = pas compté)
  const [extras, setExtras] = useState([]); // articles ajoutés au comptage (sans stock ici)
  const [ajout, setAjout] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const lignesStock = stock.filter((s) => s.emplacementId === empId);
  const ids = [...new Set([...lignesStock.map((s) => s.articleId), ...extras])];
  const lignes = ids
    .map((id) => {
      const a = articles.find((x) => x.id === id);
      const s = lignesStock.find((x) => x.articleId === id);
      const attendu = s?.quantite ?? 0;
      const saisie = comptes[id];
      const compte = saisie === undefined || saisie === "" ? null : Number(saisie);
      const ecart = compte == null ? null : compte - attendu;
      return { id, a, attendu, compte, ecart, valeur: ecart == null ? 0 : ecart * (a?.coutMoyen || 0), verifie: !!s?.verifieLe };
    })
    .filter((l) => l.a)
    .sort((x, y) => x.a.nom.localeCompare(y.a.nom, "fr"));
  const comptees = lignes.filter((l) => l.compte != null && l.compte >= 0);
  const nbEcarts = comptees.filter((l) => l.ecart !== 0).length;
  const valeurEcart = comptees.reduce((t, l) => t + l.valeur, 0);
  const nonComptees = lignes.length - comptees.length;
  const valider = async () => {
    if (comptees.length === 0) return;
    const avertissement = nonComptees > 0 ? `\n\n${tr("{n} article(s) sans quantité saisie ne changeront pas.", { n: nonComptees })}` : "";
    if (!window.confirm(tr("Valider le comptage de {n} article(s) ? Chaque écart devient un ajustement à l'historique.", { n: comptees.length }) + avertissement)) return;
    setEnCours(true);
    setErreur("");
    try {
      const n = await validerComptage(empId, comptees.map((l) => ({ articleId: l.id, compte: l.compte })));
      setComptes({});
      setExtras([]);
      await onFait(n, empId, nbEcarts, valeurEcart);
    } catch (err) {
      setErreur(err?.message || tr("Comptage refusé — réessaie."));
    } finally {
      setEnCours(false);
    }
  };
  const choixAjout = articles.filter((a) => !ids.includes(a.id));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="min-w-[200px] flex-1">
          <label className={etiquette}>{tr("Emplacement compté")}</label>
          <select
            value={empId}
            onChange={(e) => {
              setEmpId(e.target.value);
              setComptes({});
              setExtras([]);
            }}
            className={champ}
          >
            {emplacements.map((e) => (
              <option key={e.id} value={e.id}>
                {TYPES_EMPLACEMENT[e.type]?.icone} {e.nom}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setComptes(Object.fromEntries(lignes.map((l) => [l.id, String(Math.max(0, l.attendu))])))}
          className={boutonSecondaire}
          title={tr("Remplit chaque case avec la quantité attendue — tu corriges seulement ce qui diffère")}
        >
          {tr("Pré-remplir avec l'attendu")}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1fr_70px_96px_70px_90px] gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-extrabold uppercase text-slate-400 md:grid">
          <span>{tr("Article")}</span>
          <span className="text-right">{tr("Attendu")}</span>
          <span className="text-center">{tr("Compté")}</span>
          <span className="text-right">{tr("Écart")}</span>
          <span className="text-right">{tr("Valeur")}</span>
        </div>
        {lignes.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">{tr("Rien à compter ici pour l'instant — ajoute un article ci-dessous.")}</p>
        ) : (
          lignes.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_96px] items-center gap-2 border-t border-slate-100 px-3 py-2 first:border-t-0 md:grid-cols-[1fr_70px_96px_70px_90px]">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{l.a.nom}</p>
                <p className="text-[10px] text-slate-400">
                  {l.a.codeProduit || ""} {!l.verifie && <span className="font-bold text-amber-700">⚠️ {tr("non vérifié")}</span>}
                  <span className="md:hidden"> · {tr("attendu")} {qte(l.attendu)}</span>
                </p>
              </div>
              <p className="hidden text-right text-sm tabular-nums text-slate-500 md:block">{qte(l.attendu)}</p>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={comptes[l.id] ?? ""}
                onChange={(e) => setComptes((c) => ({ ...c, [l.id]: e.target.value }))}
                aria-label={tr("Quantité comptée — {nom}", { nom: l.a.nom })}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-2 text-center text-base font-extrabold tabular-nums"
              />
              <p className={`hidden text-right text-sm font-extrabold tabular-nums md:block ${l.ecart == null || l.ecart === 0 ? "text-slate-400" : l.ecart < 0 ? "text-orange-700" : "text-blue-700"}`}>
                {l.ecart == null ? "—" : l.ecart > 0 ? `+${qte(l.ecart)}` : qte(l.ecart)}
              </p>
              <p className="hidden text-right text-xs tabular-nums text-slate-500 md:block">{l.ecart ? argent(l.valeur) : "—"}</p>
              {l.ecart != null && l.ecart !== 0 && (
                <p className={`col-span-2 text-right text-[11px] font-bold md:hidden ${l.ecart < 0 ? "text-orange-700" : "text-blue-700"}`}>
                  {tr("écart")} {l.ecart > 0 ? `+${qte(l.ecart)}` : qte(l.ecart)} · {argent(l.valeur)}
                </p>
              )}
            </div>
          ))
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
          <select value={ajout} onChange={(e) => setAjout(e.target.value)} className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-xs">
            <option value="">{tr("+ Ajouter un article au comptage (trouvé ici, pas dans la liste)")}</option>
            {choixAjout.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!ajout}
            onClick={() => {
              setExtras((x) => [...x, ajout]);
              setAjout("");
            }}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            {tr("Ajouter")}
          </button>
        </div>
      </div>

      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">⚠️ {erreur}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div>
          <p className="text-sm font-extrabold text-slate-900">
            {tr("{n} compté(s) · {e} écart(s) · {v}", { n: comptees.length, e: nbEcarts, v: argent(valeurEcart) })}
          </p>
          <p className="text-[11px] text-slate-500">{tr("En validant, chaque écart devient un ajustement daté et signé ; l'emplacement devient « ✓ vérifié » pour ces articles.")}</p>
        </div>
        <button type="button" disabled={enCours || comptees.length === 0} onClick={valider} className={boutonPrincipal}>
          {enCours ? tr("Validation…") : tr("Valider le comptage")}
        </button>
      </div>
    </div>
  );
}

function Historique({ emplacementId, artParId, nomEmp }) {
  const { t: tr } = useLangue();
  const [mouvements, setMouvements] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let actif = true;
    setMouvements(null);
    listerMouvements({ emplacementId, limite: 200 })
      .then((m) => actif && setMouvements(m))
      .catch((err) => actif && setErreur(err?.message || tr("Historique illisible.")));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emplacementId]);
  if (erreur) return <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">⚠️ {erreur}</p>;
  if (mouvements === null) return <p className="text-sm text-slate-400">{tr("Chargement…")}</p>;
  if (mouvements.length === 0) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">{tr("Aucun mouvement.")}</p>;
  return (
    <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-3">
      {mouvements.map((m) => (
        <LigneMouvement key={m.id} m={m} nomEmp={nomEmp} nomArticle={artParId.get(m.articleId)?.nom || "?"} />
      ))}
      <p className="pt-1 text-right text-[10px] text-slate-400">{tr("{n} mouvement(s) affiché(s) — les plus récents", { n: mouvements.length })}</p>
    </div>
  );
}

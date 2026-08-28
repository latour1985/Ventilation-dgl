// scripts/essayer.mjs
//
// ============================================================
// 🧪 « npm run essayer » — DÉPLOIEMENT D'ESSAI (2026-09-06)
// ------------------------------------------------------------
// Le nouveau flux de mise en ligne, décidé avec le propriétaire :
//
//   1. npm run essayer   → la version part sur fluxya-essai.vercel.app
//                          (la PRODUCTION ne bouge pas d'un poil) ;
//   2. on teste à l'essai — idéalement connecté comme Ventilation
//      Miroir, l'entreprise bac-à-sable ;
//   3. sur le « GO production » EXPLICITE du propriétaire :
//      npm run publier — au moment choisi (un soir tranquille), tout
//      le monde reçoit la version d'un coup.
//
// Mécanique : ESLint → déploiement PREVIEW Vercel (build distant) →
// l'alias fixe fluxya-essai.vercel.app est repointé sur ce déploiement.
// Le projet n'a pas de lien GitHub chez Vercel (déploiements par CLI),
// d'où l'alias manuel plutôt qu'une branche.
//
// Retour en arrière de la prod, au besoin : Vercel garde toutes les
// versions — « vercel promote <ancienne-url> » ou tableau de bord.
// ============================================================

import { execSync, spawnSync } from "node:child_process";

const ALIAS_ESSAI = "fluxya-essai.vercel.app";

const lancer = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf-8", shell: true, stdio: ["inherit", "pipe", "inherit"] });
  if (r.status !== 0) {
    process.stdout.write(r.stdout || "");
    process.exit(r.status || 1);
  }
  return (r.stdout || "").trim();
};

// 1. ESLint — jamais d'envoi, même d'essai, avec du code qui plante.
console.log("🔎 Vérification ESLint…");
execSync("npx.cmd eslint app lib components --quiet", { stdio: "inherit", shell: true });

// 2. Déploiement PREVIEW (pas --prod) — Vercel construit à distance et
//    répond l'adresse unique du déploiement sur stdout.
console.log("🚀 Déploiement d'essai (la production ne bouge pas)…");
const sortie = lancer("vercel.cmd", ["deploy", "--yes"]);
// La CLI peut répondre en JSON ({ deployment: { url } }) ou en texte —
// on prend l'adresse UNIQUE du déploiement où qu'elle soit, en écartant
// les alias (fluxya*.vercel.app) que la sortie mentionne aussi.
const candidates = [...sortie.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/g)].map((m) => m[0]);
const url =
  candidates.filter((u) => /ventilation-[a-z0-9]+-ventilation-dgl\.vercel\.app$/.test(u)).pop() ||
  candidates.filter((u) => !u.includes("fluxya")).pop() ||
  "";
if (!url) {
  console.error("⛔ Adresse du déploiement introuvable dans la sortie de Vercel :\n" + sortie);
  process.exit(1);
}
console.log(`   Déploiement : ${url}`);

// 3. L'alias d'essai est repointé sur ce déploiement.
console.log(`🔗 Alias ${ALIAS_ESSAI} → ce déploiement…`);
execSync(`vercel.cmd alias set ${url} ${ALIAS_ESSAI}`, { stdio: "inherit", shell: true });

console.log(`\n✅ Version d'essai en ligne : https://${ALIAS_ESSAI}`);
console.log("   La PRODUCTION n'a pas bougé. « npm run publier » seulement sur le GO du propriétaire.");

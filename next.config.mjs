/** @type {import('next').NextConfig} */
const nextConfig = {
  // FAUTES DE FRAPPE PARDONNÉES — les variantes proches des vraies
  // adresses redirigent vers la bonne porte au lieu d'un 404 sec.
  // (Le propriétaire a tapé /plateform et s'est cogné au mur — plus
  // jamais, ni pour lui ni pour un futur employé.)
  async redirects() {
    return [
      { source: "/plateform", destination: "/plateforme", permanent: false },
      { source: "/platform", destination: "/plateforme", permanent: false },
      { source: "/plate-forme", destination: "/plateforme", permanent: false },
      { source: "/technicient", destination: "/technicien", permanent: false },
      { source: "/tech", destination: "/technicien", permanent: false },
    ];
  },

  // ============================================================
  // 🛡️ EN-TÊTES DE SÉCURITÉ (2026-09-09, audit + GO du propriétaire)
  // ------------------------------------------------------------
  // La ceinture que les audits professionnels demandent. La CSP liste
  // TOUT ce dont l'application a besoin — rien d'autre n'a le droit de
  // charger un script ou d'appeler dehors :
  //   - Supabase (données + Realtime en WebSocket + photos du Storage)
  //   - Google Maps/Places (suggestions d'adresses, géolocalisation)
  //   - Vercel (analytique sans cookie, quand la page de vente sort)
  // `unsafe-inline`/`unsafe-eval` sur les scripts : exigés par Next.js
  // (scripts d'amorçage en ligne) — la protection principale reste le
  // blocage de tout DOMAINE étranger. À tester sur l'ESSAI d'abord :
  // une CSP trop stricte casse en silence (photos, cartes, Realtime).
  // ============================================================
  async headers() {
    const csp = [
      "default-src 'self'",
      // vercel.live = la barre d'outils Vercel des DÉPLOIEMENTS D'ESSAI
      // (absente en production) — sans elle, la console de l'essai crie.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://va.vercel-scripts.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com",
      "media-src 'self' blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://places.googleapis.com https://maps.gstatic.com https://va.vercel-scripts.com https://vercel.live wss://*.pusher.com",
      "worker-src 'self' blob:",
      "frame-src 'self' https://vercel.live",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          // Personne ne met Fluxya dans un cadre (vol de clics).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Le navigateur ne « devine » jamais un type de fichier.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Les adresses internes ne fuient pas vers les sites externes.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Seule Fluxya elle-même peut demander la position GPS et la
          // caméra (app technicien) — jamais un contenu tiers.
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(self), payment=()" },
          // HTTPS obligatoire pour deux ans, sous-domaines compris.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;

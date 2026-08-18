// components/Logo.jsx
//
// FLUXYA — le logo du PRODUIT (marque neutre, vendable à d'autres
// entreprises CVC). Spirale de ventilation : deux arcs concentriques +
// point central — la volute d'un ventilateur, le mouvement de l'air.
//
// RÈGLE DE MARQUE (brief 2026-08-18) : aucune mention « Ventilation
// DGL inc. » dans l'interface produit (connexion, en-têtes, PWA). La
// mention légale « © Ventilation DGL inc. » reste sur les documents
// exportés et la page de conditions — discrète.
//
// Déclinaisons :
//   full    — spirale + wordmark en grand (écrans de connexion)
//   compact — petite spirale + wordmark 24px (en-têtes)
//   icon    — spirale seule sur carré arrondi foncé (PWA/favicon)
// `sombre` : wordmark blanc + arcs clairs, pour les fonds foncés.
//
// © Ventilation DGL inc., tous droits réservés.

const COULEURS = {
  fondFonce: "#134e4a",
  teal: "#0d9488",
  tealMoyen: "#14b8a6",
  tealClair: "#5eead4",
  tealPale: "#99f6e4",
};

function Spirale({ taille = 48, surFonce = false, echelleTrait = 1 }) {
  const exterieur = surFonce ? COULEURS.tealClair : COULEURS.teal;
  const interieur = surFonce ? COULEURS.tealPale : COULEURS.tealMoyen;
  const point = surFonce ? COULEURS.tealClair : COULEURS.tealMoyen;
  const trait = 11 * echelleTrait;
  return (
    <svg width={taille} height={taille} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M50 8 A42 42 0 1 0 92 50 A42 42 0 0 0 50 8"
        stroke={exterieur}
        strokeWidth={trait}
        strokeLinecap="round"
        strokeDasharray="198 66"
        fill="none"
      />
      <path d="M50 26 A24 24 0 1 0 74 50" stroke={interieur} strokeWidth={trait} strokeLinecap="round" fill="none" />
      <circle cx="50" cy="50" r={6.5 * echelleTrait} fill={point} />
    </svg>
  );
}

export default function Logo({ variant = "full", sombre = false, taille = 96, className = "" }) {
  if (variant === "icon") {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        style={{ background: COULEURS.fondFonce, borderRadius: "23%", width: taille, height: taille }}
        role="img"
        aria-label="Fluxya"
      >
        <Spirale taille={Math.round(taille * 0.58)} surFonce />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`} role="img" aria-label="Fluxya">
        <Spirale taille={26} surFonce={sombre} />
        <span className={`text-xl font-medium select-none ${sombre ? "text-white" : "text-black"}`}>Fluxya</span>
      </div>
    );
  }

  // variant === "full"
  return (
    <div className={`inline-flex items-center gap-4 ${className}`} role="img" aria-label="Fluxya">
      <Spirale taille={64} surFonce={sombre} />
      <span className={`text-5xl font-medium select-none ${sombre ? "text-white" : "text-black"}`}>Fluxya</span>
    </div>
  );
}

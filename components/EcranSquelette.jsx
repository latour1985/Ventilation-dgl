// components/EcranSquelette.jsx
//
// 💀 SQUELETTES DE CHARGEMENT (2026-08-27) — à l'ouverture, l'écran
// montrait « Chargement… » en petit gris au centre d'une page vide :
// l'application avait l'air figée pendant la vérification de session.
// Le squelette dessine la SILHOUETTE de l'écran qui s'en vient (barre
// latérale + cartes côté admin, entête + cartes de tâches côté
// technicien) avec un battement discret — l'attente paraît deux fois
// plus courte parce qu'on voit déjà la structure.
//
// Volontairement SANS texte ni logo : il disparaît en moins d'une
// seconde sur une bonne connexion — tout contenu deviendrait un flash.

const bloc = "animate-pulse rounded-xl bg-slate-200";

export function SqueletteAdmin() {
  return (
    <div className="flex min-h-screen bg-slate-50" aria-label="Chargement de l'administration" role="status">
      {/* Barre latérale — même largeur et même fond que la vraie. */}
      <div className="hidden w-56 shrink-0 flex-col gap-3 bg-[#131B2E] p-4 md:flex">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-white/10" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
      {/* Le corps : une barre d'entête, des tuiles, deux grandes cartes. */}
      <div className="flex-1 space-y-4 p-6">
        <div className={`${bloc} h-10 w-1/3`} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${bloc} h-24`} style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className={`${bloc} h-64`} />
        <div className={`${bloc} h-40`} />
      </div>
    </div>
  );
}

export function SqueletteTechnicien() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-100" aria-label="Chargement de ton horaire" role="status">
      {/* L'entête marine du technicien, puis des cartes de tâches. */}
      <div className="space-y-3 bg-[#131B2E] p-4 pb-6">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-white/10" />
        <div className="h-10 animate-pulse rounded-xl bg-white/10" />
      </div>
      <div className="space-y-3 p-4">
        <div className={`${bloc} h-10`} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${bloc} h-28`} style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    </div>
  );
}

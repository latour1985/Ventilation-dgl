import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Composant Button réutilisable — components/ui/Button.jsx
 *
 * Variantes :
 *  - primary  : fond noir plein, texte blanc. Pour toute action de
 *               validation, création ou soumission (ex: "Créer le devis",
 *               "Terminer et envoyer", "Valider et envoyer").
 *  - outline  : fond transparent/blanc, bordure grise, texte foncé.
 *               Pour les actions secondaires (filtrer, exporter, annuler,
 *               voir un aperçu).
 *  - danger   : fond rouge plein. Pour les actions de suppression
 *               destructives et irréversibles.
 *
 * Props :
 *  - variant: "primary" | "outline" | "danger" (défaut: "primary")
 *  - loading: bool — affiche un spinner et désactive le bouton
 *  - disabled: bool
 *  - className: string — classes Tailwind additionnelles, fusionnées
 *               après les classes de base (peuvent surcharger padding,
 *               largeur, etc. sans toucher aux couleurs de la variante)
 *  - Toutes les autres props sont transmises telles quelles à l'élément
 *    <button> (onClick, type, aria-*, etc.)
 *
 * Exemple :
 *   <Button onClick={enregistrer} loading={enCours} disabled={!valide}>
 *     Enregistrer
 *   </Button>
 *
 *   <Button variant="outline" onClick={annuler}>Annuler</Button>
 *   <Button variant="danger" onClick={supprimer}>Supprimer</Button>
 */
export default function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold " +
    "min-h-[44px] touch-manipulation transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 " +
    "disabled:cursor-not-allowed";

  const variantes = {
    primary:
      "bg-black text-white hover:bg-zinc-800 active:bg-zinc-950 " +
      "disabled:bg-zinc-300 disabled:text-zinc-500",
    outline:
      "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 " +
      "disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200",
    danger:
      "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 " +
      "disabled:bg-zinc-300 disabled:text-zinc-500",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variantes[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

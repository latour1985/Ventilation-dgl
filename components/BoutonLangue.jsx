"use client";

// 🌎 LE BOUTON DE LANGUE — affiche la langue CIBLE (« EN » quand on est
// en français) : un clic bascule, le choix est mémorisé par navigateur.
import { useLangue } from "@/lib/i18n";

export default function BoutonLangue({ sombre = false, className = "" }) {
  const { langue, setLangue } = useLangue();
  const cible = langue === "fr" ? "en" : "fr";
  return (
    <button
      onClick={() => setLangue(cible)}
      title={langue === "fr" ? "Switch to English" : "Passer en français"}
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-extrabold ${
        sombre ? "text-white/70 hover:bg-white/10" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
      } ${className}`}
    >
      🌎 {cible.toUpperCase()}
    </button>
  );
}

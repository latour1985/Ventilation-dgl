"use client";

// ============================================================
// SAISIE D'UN NOMBRE DÉCIMAL — composant partagé (admin + technicien).
// ------------------------------------------------------------
// Préserve le texte EXACT tapé (ex: « 12. » ou « 12,5 » en cours de
// frappe) au lieu de le faire passer immédiatement par parseFloat()
// puis de réafficher la version arrondie — ce qui effaçait le
// séparateur décimal dès qu'il était tapé et rendait la saisie des
// centimes impossible au clavier. La valeur NUMÉRIQUE remontée au
// parent via onChange reste toujours à jour ; seul l'AFFICHAGE local
// garde le texte brut le temps de la frappe.
//
// Accepte le point ET la virgule québécoise (44,50) — la virgule était
// auparavant rejetée en silence et « 44,50 » devenait 4450.
//
// `onBlur` est extrait des props et ENCHAÎNÉ au comportement interne :
// laissé dans {...props}, il écraserait la resynchronisation de
// l'affichage et un « 12. » en cours de frappe resterait à l'écran.
// ============================================================

import { useState, useRef, useEffect } from "react";

export default function InputNombreDecimal({ valeur, onChange, className, onBlur, ...props }) {
  const [texte, setTexte] = useState(String(valeur));
  const enFocus = useRef(false);

  // Resynchronise l'affichage si la valeur change depuis l'EXTÉRIEUR du
  // champ (ex: réinitialisation du formulaire) — MAIS jamais pendant que
  // l'utilisateur tape (focus), sinon un champ vidé ou un « 12. » en
  // cours de frappe serait immédiatement réécrit (« 0 ») et la saisie
  // des décimales deviendrait impossible.
  useEffect(() => {
    if (!enFocus.current) setTexte(String(valeur));
  }, [valeur]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={texte}
      onFocus={() => { enFocus.current = true; }}
      onBlur={(e) => { enFocus.current = false; setTexte(String(valeur)); onBlur?.(e); }}
      onChange={(e) => {
        const brut = e.target.value;
        if (!/^-?\d*[.,]?\d*$/.test(brut)) return;
        setTexte(brut);
        const nombre = parseFloat(brut.replace(",", "."));
        onChange(Number.isNaN(nombre) ? 0 : nombre);
      }}
      className={`${className || ""} focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100`}
      {...props}
    />
  );
}

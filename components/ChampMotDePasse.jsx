"use client";

// ============================================================
// 👁️ CHAMP MOT DE PASSE AVEC ŒIL (2026-09-08, demande du propriétaire)
// ------------------------------------------------------------
// Un clic sur l'œil montre le mot de passe, un autre le recache.
// Pourquoi ça compte ICI plus qu'ailleurs : les techniciens tapent
// leur mot de passe sur un téléphone, dans un camion, parfois avec des
// gants — l'erreur de frappe invisible est la première cause de
// « je n'arrive pas à me connecter ».
//
// Un seul composant pour TOUS les champs mot de passe (connexion
// admin, technicien, plateforme, création de mot de passe) : même œil,
// même comportement partout.
//
// `type="button"` sur l'œil : dans un formulaire, un bouton sans type
// serait un submit — cliquer l'œil enverrait la connexion.
// ============================================================
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function ChampMotDePasse({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

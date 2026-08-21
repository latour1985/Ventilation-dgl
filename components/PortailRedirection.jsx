"use client";

// ============================================================
// PORTAIL — OUVRE LA BONNE APPLICATION SELON LE RÔLE (2026-08-20)
// ------------------------------------------------------------
// L'icône installée sur le téléphone menait TOUJOURS à l'app
// technicien : un admin devait taper l'adresse à la main pour rejoindre
// sa console. Le portail regarde maintenant qui est connecté :
//
//   • Technicien pur            → /technicien
//   • Compte avec accès bureau  → /admin
//   • Personne (ou hors ligne)  → les deux boutons, comme avant
//
// Aucune décision de sécurité n'est changée : sans session valide, on
// ne devine rien et on laisse la personne choisir (chaque app a sa
// propre porte de connexion).
// ============================================================
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { permissionsEffectives } from "@/lib/permissions";

export default function PortailRedirection() {
  const [etat, setEtat] = useState("verification"); // verification | choix

  useEffect(() => {
    let annule = false;
    const minuterie = setTimeout(() => {
      // Filet : si Supabase ne répond pas (hors ligne), on n'immobilise
      // personne — le choix manuel s'affiche.
      if (!annule) setEtat("choix");
    }, 2500);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session) {
          if (!annule) setEtat("choix");
          return;
        }
        const courriel = (session.user?.email || "").toLowerCase();
        let accesPerso = null;
        try {
          const { data: fiche } = await supabase
            .from("permissions_utilisateurs")
            .select("role, sous_categorie, sections")
            .eq("email", courriel)
            .maybeSingle();
          accesPerso = fiche || null;
        } catch {
          // fiche illisible — les défauts du rôle s'appliquent
        }
        if (annule) return;
        const { sections } = permissionsEffectives(accesPerso, session);
        const aBureau = (sections || []).some((s) => s !== "technicien");
        clearTimeout(minuterie);
        window.location.replace(aBureau ? "/admin" : "/technicien");
      } catch {
        if (!annule) setEtat("choix");
      }
    })();

    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, []);

  if (etat === "verification") {
    return <p className="mt-6 text-center text-sm text-zinc-400">Ouverture de ton application…</p>;
  }
  return null;
}

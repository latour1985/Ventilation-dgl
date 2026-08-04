// lib/contexteEntreprise.js
//
// Le CONTEXTE React qui transporte la configuration de l'entreprise
// (coordonnées, numéros officiels, taux de taxes, règles de paie) dans
// toute l'application, sans avoir à la passer de main en main sur des
// dizaines de niveaux de composants.
//
// Il vit dans son propre fichier — et non dans app/admin/page.jsx —
// parce que le générateur de PDF (components/pdf/) doit lui aussi
// pouvoir lire la configuration.
//
// À noter : @react-pdf/renderer utilise son PROPRE moteur de rendu. Le
// contexte ne traverse donc PAS jusqu'aux documents PDF : c'est
// BoutonPDF qui lit la configuration ici, puis la passe en simple
// propriété aux composants du PDF.

"use client";

import { createContext, useContext } from "react";
import { CONFIG_DEFAUT } from "./supabase/entreprise";

export const ContexteEntreprise = createContext(CONFIG_DEFAUT);

export function useEntreprise() {
  return useContext(ContexteEntreprise) || CONFIG_DEFAUT;
}

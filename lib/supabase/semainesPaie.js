// lib/supabase/semainesPaie.js
//
// SEMAINES DE PAIE FAITES (snippet 152, 2026-09-21).
//
// Avant, Fluxya décidait « semaine déjà payée » au seul CALENDRIER : toute
// correction d'une ligne d'une semaine antérieure partait en Report ± sur
// la semaine courante. Or la paie de la semaine N se fait au début de la
// semaine N+1 — exactement quand on corrige. Une correction faite le
// lundi, AVANT la paie, était donc comptée deux fois : l'écran de la
// semaine N montrait déjà les heures corrigées, ET la semaine N+1
// recevait le report (vécu : Charles −9 h, Raphaël −1 h 41).
//
// Ici, la personne qui fait la paie le DIT. Une correction ne devient un
// report que si la semaine de la ligne est inscrite ici.

import { supabase } from "./client";

const tableAbsente = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /semaines_paie/.test(String(e?.message || ""));

// → [{ debut: "2026-09-06", payeeLe, payeePar }] ; table absente = [].
export async function listerSemainesPayees() {
  const { data, error } = await supabase.from("semaines_paie").select("debut_semaine, payee_le, payee_par").order("debut_semaine", { ascending: false }).limit(200);
  if (error) {
    if (tableAbsente(error)) return [];
    throw error;
  }
  return (data || []).map((r) => ({ debut: r.debut_semaine, payeeLe: r.payee_le, payeePar: r.payee_par || "" }));
}

export async function marquerSemainePayee(debutISO, par) {
  const { error } = await supabase.from("semaines_paie").upsert({ debut_semaine: debutISO, payee_le: new Date().toISOString(), payee_par: par || null });
  if (error) {
    if (tableAbsente(error)) throw new Error("Le snippet 152 n'est pas encore passé dans Supabase.");
    throw new Error(error.message || "Enregistrement refusé.");
  }
}

export async function annulerSemainePayee(debutISO) {
  const { error } = await supabase.from("semaines_paie").delete().eq("debut_semaine", debutISO);
  if (error) throw new Error(error.message || "Annulation refusée.");
}

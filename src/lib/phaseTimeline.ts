// ══════════════════════════════════════════════════════════════
// PHASES D'UNE ACTIVITÉ : BORNES ET CHEVAUCHEMENTS
//
// Étude, passation et exécution gardent chacune leurs propres dates
// (décision de l'équipe : pas d'enchaînement automatique). La page les
// situe sur une même frise et signale les chevauchements, sans les empêcher.
// ══════════════════════════════════════════════════════════════

import { toDay } from "./livrableSchedule";

export type PhaseKey = "etude" | "passation" | "execution";

export const PHASE_ORDER: PhaseKey[] = ["etude", "passation", "execution"];

export const PHASE_LABELS: Record<PhaseKey, string> = {
  etude: "Étude préalable",
  passation: "Passation",
  execution: "Exécution",
};

export interface Periode {
  debut?: string;
  fin?: string;
}

/** Plus tôt et plus tard des dates reconnues (AAAA-MM-JJ ou Date) parmi des valeurs quelconques. */
export function periodeDe(valeurs: unknown[]): Periode {
  const jours = valeurs
    .map((v) => (typeof v === "string" || v instanceof Date ? toDay(v) : undefined))
    .filter((d): d is string => !!d)
    .sort();
  return { debut: jours[0], fin: jours[jours.length - 1] };
}

/** Toutes les dates d'une liste d'objets (lignes du PPM, tâches…), quels que soient les champs. */
export function periodeDesLignes(lignes: object[] | undefined): Periode {
  return periodeDe((lignes ?? []).flatMap((ligne) => Object.values(ligne)));
}

export interface Chevauchement {
  avant: PhaseKey;
  apres: PhaseKey;
  du: string;
  au: string;
}

/** Paires de phases dont les périodes se recouvrent, dans l'ordre étude → passation → exécution. */
export function chevauchements(periodes: Partial<Record<PhaseKey, Periode>>): Chevauchement[] {
  const result: Chevauchement[] = [];
  PHASE_ORDER.forEach((avant, i) => {
    PHASE_ORDER.slice(i + 1).forEach((apres) => {
      const a = periodes[avant];
      const b = periodes[apres];
      if (!a?.debut || !a.fin || !b?.debut || !b.fin) return;
      const du = a.debut > b.debut ? a.debut : b.debut;
      const au = a.fin < b.fin ? a.fin : b.fin;
      if (du < au) result.push({ avant, apres, du, au });
    });
  });
  return result;
}

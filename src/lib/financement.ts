// ══════════════════════════════════════════════════════════════
// FINANCEMENT — modèle de saisie et calculs
//
// Le serveur (backend/src/modules/projects/financement.calculator.ts) fait
// autorité : il recalcule budget et pourcentages à chaque enregistrement.
// Ce module en reproduit l'algorithme pour afficher en direct, pendant la
// saisie, exactement ce qui sera enregistré.
// ══════════════════════════════════════════════════════════════

import { DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";
import type { CurrencyContribution } from "@/components/financing/BailleurMultiCurrency";
import type { Financement } from "@/services/api/projectService";

export const BASE_CURRENCY = "FCFA";

export type FinancementType = "MOP" | "PPP";

export interface BailleurForm {
  id: string;
  nom: string;
  contributions: CurrencyContribution[];
}

export interface PartieForm {
  id: string;
  nom: string;
  montant: string;
  devise: string;
}

export interface FinancementFormValue {
  type: FinancementType;
  budgetNational: { enabled: boolean; montant: string; devise: string };
  bailleurs: BailleurForm[];
  partiesPubliques: PartieForm[];
  partiesPrivees: PartieForm[];
  tauxChange: Record<string, number>;
}

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

export const newContribution = (devise = BASE_CURRENCY, montant = ""): CurrencyContribution => ({
  id: newId("curr"),
  devise,
  montant,
});

export function emptyFinancement(): FinancementFormValue {
  return {
    type: "MOP",
    budgetNational: { enabled: false, montant: "", devise: BASE_CURRENCY },
    bailleurs: [],
    partiesPubliques: [],
    partiesPrivees: [],
    tauxChange: { ...DEFAULT_EXCHANGE_RATES },
  };
}

const asInput = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** Charge le financement enregistré d'un projet dans le formulaire. */
export function financementFromProject(financement?: Financement | null): FinancementFormValue {
  if (!financement) return emptyFinancement();

  const taux =
    financement.tauxChange instanceof Map
      ? Object.fromEntries(financement.tauxChange)
      : (financement.tauxChange as Record<string, number> | undefined) ?? {};

  return {
    type: financement.type === "PPP" ? "PPP" : "MOP",
    budgetNational: {
      enabled: !!financement.budgetNational && (financement.budgetNationalMontant ?? 0) > 0,
      montant: asInput(financement.budgetNationalMontant),
      devise: financement.budgetNationalDevise || BASE_CURRENCY,
    },
    bailleurs: (financement.bailleurs ?? []).map((b) => ({
      id: newId("b"),
      nom: b.nom,
      // Bailleur enregistré avant le détail par devise : une contribution unique.
      contributions: b.contributions?.length
        ? b.contributions.map((c) => newContribution(c.devise, asInput(c.montant)))
        : [newContribution(b.devise || BASE_CURRENCY, asInput(b.montant))],
    })),
    partiesPubliques: (financement.partiesPubliques ?? []).map((p) => ({
      id: newId("pub"),
      nom: p.nom,
      montant: asInput(p.montant),
      devise: p.devise || BASE_CURRENCY,
    })),
    partiesPrivees: (financement.partiesPrivees ?? []).map((p) => ({
      id: newId("priv"),
      nom: p.nom,
      montant: asInput(p.montant),
      devise: p.devise || BASE_CURRENCY,
    })),
    tauxChange: { ...DEFAULT_EXCHANGE_RATES, ...taux, [BASE_CURRENCY]: 1 },
  };
}

const toAmount = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Même répartition au plus fort reste que le serveur : la somme fait exactement 100. */
export function distributePercentages(amounts: number[]): number[] {
  const total = amounts.reduce((sum, a) => sum + a, 0);
  if (total <= 0) return amounts.map(() => 0);

  const exact = amounts.map((a) => (a / total) * 10000);
  const floors = exact.map(Math.floor);
  let remaining = 10000 - floors.reduce((sum, f) => sum + f, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { index } of order) {
    if (remaining <= 0) break;
    floors[index] += 1;
    remaining -= 1;
  }
  return floors.map((f) => f / 100);
}

export interface FinancementPreview {
  /** Budget total en FCFA. */
  total: number;
  /** Montant FCFA et part de chaque source, par identifiant (« national » pour le budget national). */
  sources: Record<string, { amount: number; pct: number }>;
  /** Devises utilisées par les sources du type courant. */
  usedCurrencies: string[];
  /** Devises utilisées sans taux de change défini. */
  missingRates: string[];
}

export function computeFinancementPreview(value: FinancementFormValue): FinancementPreview {
  const rates = value.tauxChange;
  const used = new Set<string>();
  const missing = new Set<string>();
  const entries: { id: string; amount: number }[] = [];

  const convert = (montant: number, devise: string) => {
    used.add(devise);
    const rate = rates[devise];
    if (!rate) {
      if (montant > 0) missing.add(devise);
      return 0;
    }
    return montant * rate;
  };

  if (value.type === "MOP") {
    if (value.budgetNational.enabled) {
      entries.push({
        id: "national",
        amount: convert(toAmount(value.budgetNational.montant), value.budgetNational.devise),
      });
    }
    for (const b of value.bailleurs) {
      entries.push({
        id: b.id,
        amount: b.contributions.reduce((sum, c) => sum + convert(toAmount(c.montant), c.devise), 0),
      });
    }
  } else {
    for (const p of [...value.partiesPubliques, ...value.partiesPrivees]) {
      entries.push({ id: p.id, amount: convert(toAmount(p.montant), p.devise) });
    }
  }

  const pcts = distributePercentages(entries.map((e) => e.amount));
  const sources: FinancementPreview["sources"] = {};
  entries.forEach((e, i) => (sources[e.id] = { amount: e.amount, pct: pcts[i] }));

  return {
    total: Math.round(entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
    sources,
    usedCurrencies: [...used],
    missingRates: [...missing],
  };
}

/**
 * Erreurs bloquantes, formulées pour l'utilisateur. Un financement vide n'en
 * est pas une : les sources d'un projet s'ajoutent souvent en cours de route.
 */
export function validateFinancement(value: FinancementFormValue): string[] {
  const errors: string[] = [];
  const preview = computeFinancementPreview(value);

  if (value.type === "PPP" && [...value.partiesPubliques, ...value.partiesPrivees].some((p) => !p.nom.trim())) {
    errors.push("Chaque partie doit avoir un nom.");
  }
  if (preview.missingRates.length > 0) {
    errors.push(`Définissez un taux de change pour : ${preview.missingRates.join(", ")}.`);
  }
  return errors;
}

/**
 * Données « perdues » au changement de type : elles restent dans le
 * formulaire (on peut revenir en arrière) mais ne seront pas enregistrées.
 */
export function sourcesDroppedBySwitch(value: FinancementFormValue): number {
  if (value.type === "MOP") {
    return value.partiesPubliques.length + value.partiesPrivees.length;
  }
  return value.bailleurs.length + (value.budgetNational.enabled ? 1 : 0);
}

/**
 * Corps envoyé à l'API : seules les sources du type courant, montants bruts
 * par devise. Budget et pourcentages sont volontairement absents — le
 * serveur les calcule.
 */
export function financementToPayload(value: FinancementFormValue) {
  const isMop = value.type === "MOP";
  const national = value.budgetNational;

  return {
    type: value.type,
    budgetNational: isMop && national.enabled && toAmount(national.montant) > 0,
    budgetNationalMontant: isMop && national.enabled ? toAmount(national.montant) : undefined,
    budgetNationalDevise: isMop && national.enabled ? national.devise : undefined,
    bailleurs: isMop
      ? value.bailleurs.map((b) => ({
          nom: b.nom,
          contributions: b.contributions
            .map((c) => ({ montant: toAmount(c.montant), devise: c.devise }))
            .filter((c) => c.montant > 0),
        }))
      : [],
    partiesPubliques: isMop
      ? []
      : value.partiesPubliques.map((p) => ({ nom: p.nom.trim(), montant: toAmount(p.montant), devise: p.devise })),
    partiesPrivees: isMop
      ? []
      : value.partiesPrivees.map((p) => ({ nom: p.nom.trim(), montant: toAmount(p.montant), devise: p.devise })),
    tauxChange: value.tauxChange,
  };
}

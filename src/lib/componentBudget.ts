// ══════════════════════════════════════════════════════════════
// BUDGET DES COMPOSANTS
//
// La pondération d'un composant est sa part du budget financé du projet :
//   pondération = montant (converti en FCFA) ÷ budget du projet × 100
// Montant et pondération se déduisent l'un de l'autre ; le montant est la
// valeur enregistrée, la pondération en découle.
// ══════════════════════════════════════════════════════════════

export type ExchangeRates = Record<string, number>;

const rateOf = (devise: string | undefined, rates: ExchangeRates) => rates[devise || "FCFA"] || 1;

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Montant d'un composant converti en FCFA. */
export function toFCFA(budget: number | undefined, devise: string | undefined, rates: ExchangeRates): number {
  return (budget || 0) * rateOf(devise, rates);
}

/** Part (en %) d'un montant FCFA dans le budget de référence ; 0 sans référence. */
export function shareOf(amountFCFA: number, referenceFCFA: number): number {
  return referenceFCFA > 0 ? (amountFCFA / referenceFCFA) * 100 : 0;
}

/** Montant, dans la devise du composant, correspondant à une part du budget de référence. */
export function amountFromShare(
  share: number,
  referenceFCFA: number,
  devise: string | undefined,
  rates: ExchangeRates,
): number {
  return round2(((share / 100) * referenceFCFA) / rateOf(devise, rates));
}

/**
 * Pourcentage lisible. Un écart réel mais inférieur au centième ne s'affiche
 * pas « 0,00 % », ce qui laissait croire à une absence d'écart.
 */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return "< 0,01 %";
  return `${share.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

/** Écart toléré (en FCFA) pour considérer un budget réparti comme équilibré : les centimes d'arrondi. */
export const BALANCE_TOLERANCE_FCFA = 1;

export type AllocationStatus = "balanced" | "under" | "over" | "undefined";

export function allocationStatus(allocatedFCFA: number, referenceFCFA: number): AllocationStatus {
  if (referenceFCFA <= 0) return "undefined";
  const gap = allocatedFCFA - referenceFCFA;
  if (Math.abs(gap) < BALANCE_TOLERANCE_FCFA) return "balanced";
  return gap > 0 ? "over" : "under";
}

/** Saisie française → nombre : espaces (y compris insécables) ignorés, virgule décimale acceptée. */
export function parseAmount(input: string): number | undefined {
  const normalized = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (normalized === "") return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

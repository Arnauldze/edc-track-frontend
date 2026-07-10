// ══════════════════════════════════════════════════════════════
// BUDGET HELPERS - Convert between string and number
// ══════════════════════════════════════════════════════════════

/**
 * Parse budget string to number
 * Examples:
 * - "420 Mrd FCFA" → 420000000000
 * - "150 M FCFA" → 150000000
 * - "50 K FCFA" → 50000
 */
export function parseBudget(budgetStr: string): number {
  if (!budgetStr) return 0;

  const match = budgetStr.match(/(\d+(?:\.\d+)?)\s*(Mrd|Md|M|K)?/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2]?.toLowerCase();

  const multipliers: Record<string, number> = {
    mrd: 1_000_000_000,
    md: 1_000_000,
    m: 1_000_000,
    k: 1_000,
  };

  return value * (multipliers[unit || ''] || 1);
}

/**
 * Format number to budget string
 * Examples:
 * - 420000000000 → "420 Mrd FCFA"
 * - 150000000 → "150 M FCFA"
 * - 50000 → "50 K FCFA"
 */
export function formatBudget(budget: number, devise: string = 'FCFA'): string {
  if (!budget) return `0 ${devise}`;

  if (budget >= 1_000_000_000) {
    return `${(budget / 1_000_000_000).toFixed(1)} Mrd ${devise}`;
  }
  if (budget >= 1_000_000) {
    return `${(budget / 1_000_000).toFixed(1)} M ${devise}`;
  }
  if (budget >= 1_000) {
    return `${(budget / 1_000).toFixed(1)} K ${devise}`;
  }
  return `${budget.toLocaleString()} ${devise}`;
}

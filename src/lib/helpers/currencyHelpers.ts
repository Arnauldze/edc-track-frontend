// ══════════════════════════════════════════════════════════════
// CURRENCY HELPERS - Gestion des devises et conversions
// ══════════════════════════════════════════════════════════════

export const CURRENCIES = [
  { code: 'FCFA', symbol: 'FCFA', name: 'Franc CFA' },
  { code: 'USD', symbol: '$', name: 'Dollar américain' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'Livre sterling' },
  { code: 'CNY', symbol: '¥', name: 'Yuan chinois' },
  { code: 'JPY', symbol: '¥', name: 'Yen japonais' },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]['code'];

/**
 * Taux de change par défaut (vers FCFA)
 * Ces taux peuvent être modifiés par l'utilisateur
 */
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  'FCFA': 1,
  'USD': 600,
  'EUR': 655,
  'GBP': 780,
  'CNY': 85,
  'JPY': 4.5,
};

/**
 * Convertir un montant d'une devise vers une autre
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  if (fromCurrency === toCurrency) return amount;
  
  // Convertir vers FCFA d'abord
  const amountInFCFA = amount * (exchangeRates[fromCurrency] || 1);
  
  // Puis vers la devise cible
  const targetRate = exchangeRates[toCurrency] || 1;
  return amountInFCFA / targetRate;
}

/**
 * Calculer le budget total en convertissant tout vers une devise de référence
 */
export function calculateTotalBudget(
  contributions: Array<{ montant: number; devise: string }>,
  targetCurrency: string = 'FCFA',
  exchangeRates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number {
  return contributions.reduce((total, contrib) => {
    const converted = convertCurrency(
      contrib.montant,
      contrib.devise,
      targetCurrency,
      exchangeRates
    );
    return total + converted;
  }, 0);
}

/**
 * Calculer les pourcentages de chaque contribution
 */
export function calculatePercentages(
  contributions: Array<{ montant: number; devise: string }>,
  exchangeRates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): number[] {
  const total = calculateTotalBudget(contributions, 'FCFA', exchangeRates);
  
  if (total === 0) return contributions.map(() => 0);
  
  return contributions.map(contrib => {
    const amountInFCFA = convertCurrency(
      contrib.montant,
      contrib.devise,
      'FCFA',
      exchangeRates
    );
    return Math.round((amountInFCFA / total) * 100 * 100) / 100; // 2 décimales
  });
}

/**
 * Formater un montant avec sa devise
 */
export function formatCurrency(amount: number, currency: string): string {
  const currencyInfo = CURRENCIES.find(c => c.code === currency);
  const symbol = currencyInfo?.symbol || currency;
  
  return `${amount.toLocaleString('fr-FR')} ${symbol}`;
}

/**
 * Obtenir le symbole d'une devise
 */
export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
}

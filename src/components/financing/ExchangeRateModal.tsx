"use client";

import { useState, useEffect } from "react";
import { X, DollarSign, AlertCircle, Calculator } from "lucide-react";
import { CURRENCIES, DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";

interface ExchangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rates: Record<string, number>) => void;
  currentRates: Record<string, number>;
  usedCurrencies: string[]; // Devises utilisées dans le projet
}

export function ExchangeRateModal({
  isOpen,
  onClose,
  onSave,
  currentRates,
  usedCurrencies,
}: ExchangeRateModalProps) {
  const [rates, setRates] = useState<Record<string, number>>(currentRates);

  useEffect(() => {
    setRates(currentRates);
  }, [currentRates, isOpen]);

  const handleSave = () => {
    onSave(rates);
    onClose();
  };

  const handleReset = () => {
    setRates(DEFAULT_EXCHANGE_RATES);
  };

  const updateRate = (currency: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates((prev) => ({ ...prev, [currency]: numValue }));
  };

  if (!isOpen) return null;

  // Filtrer pour afficher uniquement les devises utilisées (sauf FCFA qui est toujours 1)
  const relevantCurrencies = CURRENCIES.filter(
    (c) => c.code === "FCFA" || usedCurrencies.includes(c.code)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between sticky top-0 bg-[var(--bg-surface)] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <DollarSign size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Taux de Change
              </h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                Saisir les taux de change de la convention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
          >
            <X size={20} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Info */}
          <div className="flex gap-3 p-4 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <strong>Important :</strong> Utilisez les taux de change officiels
              mentionnés dans la convention de financement. Ces taux seront utilisés
              pour calculer le budget total en FCFA.
            </div>
          </div>

          {/* Taux de change */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Taux de Conversion vers FCFA
            </label>

            <div className="space-y-2">
              {relevantCurrencies.map((currency) => (
                <div
                  key={currency.code}
                  className="flex items-center gap-3 p-3 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)]"
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {currency.name}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {currency.symbol} ({currency.code})
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">
                      1 {currency.code} =
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rates[currency.code] || ""}
                      onChange={(e) => updateRate(currency.code, e.target.value)}
                      disabled={currency.code === "FCFA"}
                      className="w-32 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-[var(--text-secondary)] w-12">
                      FCFA
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exemple de calcul */}
          <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-[var(--radius-md)]">
            <div className="flex items-start gap-2 mb-2">
              <Calculator size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-green-600 dark:text-green-400">
                Exemple de calcul
              </div>
            </div>
            <div className="text-xs text-[var(--text-secondary)] space-y-1 ml-5">
              {usedCurrencies.filter((c) => c !== "FCFA").length > 0 ? (
                <>
                  {usedCurrencies
                    .filter((c) => c !== "FCFA")
                    .slice(0, 2)
                    .map((curr) => (
                      <div key={curr}>
                        • 1 000 {curr} × {rates[curr] || 0} = {((rates[curr] || 0) * 1000).toLocaleString("fr-FR")} FCFA
                      </div>
                    ))}
                </>
              ) : (
                <div>• Aucune devise étrangère utilisée</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-inset)]/30">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Réinitialiser aux valeurs par défaut
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              Enregistrer les taux
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

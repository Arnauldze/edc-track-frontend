"use client";

import { useState } from "react";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { CURRENCIES } from "@/lib/helpers/currencyHelpers";

export interface CurrencyContribution {
  id: string;
  devise: string;
  montant: string;
}

interface BailleurMultiCurrencyProps {
  bailleurId: string;
  bailleurNom: string;
  contributions: CurrencyContribution[];
  pourcentageTotal?: number;
  onUpdate: (bailleurId: string, contributions: CurrencyContribution[]) => void;
  onRemove: (bailleurId: string) => void;
}

export function BailleurMultiCurrency({
  bailleurId,
  bailleurNom,
  contributions,
  pourcentageTotal,
  onUpdate,
  onRemove,
}: BailleurMultiCurrencyProps) {
  // Toujours démarrer en mode développé pour permettre la saisie
  const [isExpanded, setIsExpanded] = useState(true);

  const addCurrency = () => {
    const newContribution: CurrencyContribution = {
      id: `curr-${Date.now()}`,
      devise: "FCFA",
      montant: "0",
    };
    onUpdate(bailleurId, [...contributions, newContribution]);
    setIsExpanded(true);
  };

  const removeCurrency = (currId: string) => {
    if (contributions.length <= 1) return; // Garder au moins une devise
    onUpdate(
      bailleurId,
      contributions.filter((c) => c.id !== currId)
    );
  };

  const updateCurrency = (currId: string, field: "devise" | "montant", value: string) => {
    onUpdate(
      bailleurId,
      contributions.map((c) => (c.id === currId ? { ...c, [field]: value } : c))
    );
  };

  // Calculer le total pour ce bailleur (en affichage uniquement)
  const getTotalDisplay = () => {
    const grouped = contributions.reduce((acc, c) => {
      const montant = parseFloat(c.montant) || 0;
      acc[c.devise] = (acc[c.devise] || 0) + montant;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .filter(([_, montant]) => montant > 0)
      .map(([devise, montant]) => `${montant.toLocaleString("fr-FR")} ${devise}`)
      .join(" + ");
  };

  return (
    <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] group space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0 hover:scale-125 transition-transform"
          title={isExpanded ? "Réduire" : "Développer"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
              {bailleurNom}
            </span>
            {contributions.length > 1 && (
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] font-bold rounded">
                {contributions.length} devises
              </span>
            )}
          </div>
          {!isExpanded && (
            <div className="text-[11px] text-[var(--text-tertiary)] truncate">
              {getTotalDisplay() || "Aucun montant"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Pourcentage total */}
          {pourcentageTotal !== undefined && (
            <div className="relative w-16 flex-shrink-0">
              <input
                type="text"
                value={pourcentageTotal.toFixed(2)}
                readOnly
                className="w-full bg-[var(--bg-inset)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-2 py-1 text-[11px] text-[var(--text-secondary)] text-right pr-6 cursor-not-allowed"
                title="Pourcentage total calculé automatiquement"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-tertiary)] font-semibold">
                %
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(bailleurId)}
            className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
            title="Supprimer le bailleur"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Contributions par devise */}
      {isExpanded && (
        <div className="ml-5 space-y-2">
          {contributions.map((contrib, index) => (
            <div key={contrib.id} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                {/* Montant */}
                <input
                  type="number"
                  min="0"
                  value={contrib.montant}
                  onChange={(e) => updateCurrency(contrib.id, "montant", e.target.value)}
                  placeholder="Montant"
                  className="flex-1 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                {/* Devise */}
                <select
                  value={contrib.devise}
                  onChange={(e) => updateCurrency(contrib.id, "devise", e.target.value)}
                  className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer w-24"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bouton supprimer devise */}
              {contributions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCurrency(contrib.id)}
                  className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                  title="Supprimer cette devise"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}

          {/* Bouton ajouter une devise */}
          <button
            type="button"
            onClick={addCurrency}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-sm)] transition-colors"
          >
            <Plus size={12} />
            Ajouter une devise
          </button>
        </div>
      )}
    </div>
  );
}

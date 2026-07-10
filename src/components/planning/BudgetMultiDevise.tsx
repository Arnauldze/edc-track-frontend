"use client";

import { Plus, Trash2 } from "lucide-react";

interface BudgetDevise {
  devise: string;
  montant: number;
  pourcentage?: number;
}

interface Props {
  budgets: BudgetDevise[];
  onChange: (budgets: BudgetDevise[]) => void;
}

const DEVISES = ["FCFA", "EUR", "USD", "GBP", "CNY"];

export function BudgetMultiDevise({ budgets, onChange }: Props) {
  const addBudget = () => {
    onChange([...budgets, { devise: "FCFA", montant: 0, pourcentage: 0 }]);
  };

  const removeBudget = (index: number) => {
    onChange(budgets.filter((_, i) => i !== index));
  };

  const updateBudget = (index: number, field: keyof BudgetDevise, value: any) => {
    const updated = budgets.map((b, i) => {
      if (i !== index) return b;
      return { ...b, [field]: value };
    });
    onChange(updated);
  };

  const calculateTotal = () => {
    return budgets.reduce((sum, b) => sum + (b.montant || 0), 0);
  };

  const calculatePourcentages = () => {
    const total = calculateTotal();
    if (total === 0) return;

    const updated = budgets.map((b) => ({
      ...b,
      pourcentage: total > 0 ? Math.round((b.montant / total) * 100 * 100) / 100 : 0,
    }));
    onChange(updated);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("fr-FR").format(num);
  };

  return (
    <div className="space-y-3">
      {budgets.map((budget, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 bg-[var(--bg-inset)] rounded-[var(--radius-md)] border border-[var(--border-default)]"
        >
          {/* Devise */}
          <select
            value={budget.devise}
            onChange={(e) => updateBudget(index, "devise", e.target.value)}
            className="w-24 px-2 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[12px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            {DEVISES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Montant */}
          <div className="flex-1 relative">
            <input
              type="number"
              value={budget.montant || ""}
              onChange={(e) => updateBudget(index, "montant", parseFloat(e.target.value) || 0)}
              onBlur={calculatePourcentages}
              placeholder="Montant"
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Pourcentage */}
          <div className="w-20 text-right">
            <span className="text-[12px] font-bold text-[var(--text-secondary)]">
              {budget.pourcentage?.toFixed(1) || "0"}%
            </span>
          </div>

          {/* Supprimer */}
          {budgets.length > 1 && (
            <button
              onClick={() => removeBudget(index)}
              className="p-2 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {/* Ajouter */}
      <button
        onClick={addBudget}
        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-md)] transition-colors"
      >
        <Plus size={14} />
        Ajouter une devise
      </button>

      {/* Total */}
      {budgets.length > 1 && (
        <div className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border-2 border-[var(--accent)]/20">
          <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            Total (converti)
          </span>
          <span className="text-[16px] font-bold text-[var(--text-primary)]">
            {formatNumber(calculateTotal())} FCFA
          </span>
        </div>
      )}
    </div>
  );
}

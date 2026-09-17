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
          className="flex items-center gap-3 p-3 bg-inset rounded-md border border-line"
        >
          {/* Devise */}
          <select
            value={budget.devise}
            onChange={(e) => updateBudget(index, "devise", e.target.value)}
            className="w-24 px-2 py-2 bg-surface border border-line rounded-sm text-[12px] font-semibold text-fg focus:outline-none focus:border-primary cursor-pointer"
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
              className="w-full px-3 py-2 bg-surface border border-line rounded-sm text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Pourcentage */}
          <div className="w-20 text-right">
            <span className="text-[12px] font-bold text-fg-muted">
              {budget.pourcentage?.toFixed(1) || "0"}%
            </span>
          </div>

          {/* Supprimer */}
          {budgets.length > 1 && (
            <button
              onClick={() => removeBudget(index)}
              className="p-2 rounded-sm hover:bg-danger-subtle text-fg-subtle hover:text-danger transition-all"
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
        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-primary-fg hover:bg-primary/10 rounded-md transition-colors"
      >
        <Plus size={14} />
        Ajouter une devise
      </button>

      {/* Total */}
      {budgets.length > 1 && (
        <div className="flex items-center justify-between p-3 bg-surface rounded-md border-2 border-primary/20">
          <span className="text-[11px] font-bold text-fg-subtle uppercase tracking-wider">
            Total (converti)
          </span>
          <span className="text-[16px] font-bold text-fg">
            {formatNumber(calculateTotal())} FCFA
          </span>
        </div>
      )}
    </div>
  );
}

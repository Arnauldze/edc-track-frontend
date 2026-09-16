"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CURRENCIES } from "@/lib/helpers/currencyHelpers";
import { formatMoney } from "@/lib/utils";
import {
  amountFromShare,
  parseAmount,
  round2,
  shareOf,
  toFCFA,
  type ExchangeRates,
} from "@/lib/componentBudget";

interface ComponentBudgetInputProps {
  budget?: number;
  devise?: string;
  /** Budget financé du projet, en FCFA : référence du pourcentage. */
  referenceFCFA: number;
  rates: ExchangeRates;
  onChange: (value: { budget?: number; devise: string }) => void;
}

const fieldClass =
  "bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Montant et pourcentage d'un composant, saisissables l'un ou l'autre.
 * Chaque champ garde le texte tapé tant qu'il a le focus, et n'est mis en forme
 * qu'à la sortie : reformater à chaque frappe faisait sauter le curseur et
 * empêchait de taper une virgule décimale.
 */
export function ComponentBudgetInput({ budget, devise = "FCFA", referenceFCFA, rates, onChange }: ComponentBudgetInputProps) {
  const [amountDraft, setAmountDraft] = useState<string | null>(null);
  const [shareDraft, setShareDraft] = useState<string | null>(null);

  const share = shareOf(toFCFA(budget, devise, rates), referenceFCFA);
  const hasReference = referenceFCFA > 0;

  const amountText = amountDraft ?? (budget ? formatMoney(budget, 2) : "");
  const shareText = shareDraft ?? (budget && hasReference ? round2(share).toLocaleString("fr-FR") : "");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        aria-label="Montant du composant"
        value={amountText}
        placeholder="Montant"
        onFocus={() => setAmountDraft(budget ? String(budget).replace(".", ",") : "")}
        onChange={(e) => {
          setAmountDraft(e.target.value);
          onChange({ budget: parseAmount(e.target.value), devise });
        }}
        onBlur={() => setAmountDraft(null)}
        className={`${fieldClass} w-40 tabular-nums`}
      />
      <select
        aria-label="Devise du composant"
        value={devise}
        onChange={(e) => onChange({ budget, devise: e.target.value })}
        className={`${fieldClass} w-[4.75rem] font-semibold cursor-pointer`}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.code}</option>
        ))}
      </select>

      <ArrowLeftRight size={12} className="text-[var(--text-tertiary)] mx-0.5" aria-hidden />

      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          aria-label="Part du budget du projet"
          value={shareText}
          placeholder="0"
          disabled={!hasReference}
          title={
            hasReference
              ? "Saisir un pourcentage calcule le montant"
              : "Budget du projet non défini : renseignez le financement pour saisir un pourcentage"
          }
          onFocus={() => setShareDraft(budget && hasReference ? String(round2(share)).replace(".", ",") : "")}
          onChange={(e) => {
            setShareDraft(e.target.value);
            const value = parseAmount(e.target.value);
            onChange({ budget: value === undefined ? undefined : amountFromShare(value, referenceFCFA, devise, rates), devise });
          }}
          onBlur={() => setShareDraft(null)}
          className={`${fieldClass} w-24 pr-6 text-right tabular-nums`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-tertiary)]">%</span>
      </div>
    </div>
  );
}

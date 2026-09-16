"use client";

// Données communes de l'activité, affichées dans l'en-tête : date T0, budget,
// responsable. Chaque valeur s'ouvre dans un petit panneau pour être modifiée.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { BudgetMultiDevise } from "./BudgetMultiDevise";
import { formatCurrency } from "@/lib/helpers/currencyHelpers";

type Budget = { devise: string; montant: number; pourcentage?: number };

interface Props {
  dateT0: string;
  onDateT0: (value: string) => void;
  budgets: Budget[];
  onBudgets: (value: Budget[]) => void;
  budgetTotalFCFA: number;
  responsable: string;
  onResponsable: (value: string) => void;
  readOnly: boolean;
}

function Champ({
  label,
  valeur,
  manquant,
  readOnly,
  largeur = 280,
  children,
}: {
  label: string;
  valeur: string;
  manquant?: boolean;
  readOnly: boolean;
  largeur?: number;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", fermer);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", fermer);
    };
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !readOnly && setOuvert(!ouvert)}
        className={`group flex items-baseline gap-2 px-2.5 py-1.5 rounded-[var(--radius-md)] border text-left ${
          manquant ? "border-amber-500/40 bg-amber-500/10" : "border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-inset)]"
        } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
        <span className={`text-[12px] font-semibold ${manquant ? "text-amber-700 dark:text-amber-400" : "text-[var(--text-primary)]"}`}>{valeur}</span>
        {!readOnly && <Pencil size={11} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100" />}
      </button>
      {ouvert && (
        <div
          className="absolute z-30 left-0 top-full mt-1 p-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg"
          style={{ width: largeur }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[12px] focus:outline-none focus:border-[var(--primary)]";

export function ActivityGeneralStrip({ dateT0, onDateT0, budgets, onBudgets, budgetTotalFCFA, responsable, onResponsable, readOnly }: Props) {
  const plusieursDevises = budgets.some((b) => b.devise !== "FCFA" && b.montant);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Champ label="T0" valeur={dateT0 ? new Date(`${dateT0}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "À définir"} manquant={!dateT0} readOnly={readOnly}>
        <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">Date T0 de l&apos;activité</label>
        <input type="date" value={dateT0} onChange={(e) => onDateT0(e.target.value)} className={inputClass} autoFocus />
        <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">Les délais des livrables et des tâches se comptent depuis T0.</p>
      </Champ>

      <Champ label="Budget" valeur={budgetTotalFCFA ? formatCurrency(budgetTotalFCFA, "FCFA") : "À définir"} manquant={!budgetTotalFCFA} readOnly={readOnly} largeur={520}>
        <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">Budget de l&apos;activité</label>
        <BudgetMultiDevise budgets={budgets} onChange={onBudgets} />
        {plusieursDevises && (
          <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
            Total converti : <strong>{formatCurrency(budgetTotalFCFA, "FCFA")}</strong> (taux du financement du projet)
          </p>
        )}
      </Champ>

      <Champ label="Responsable" valeur={responsable || "—"} readOnly={readOnly}>
        <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">Responsable de l&apos;activité</label>
        <input type="text" value={responsable} onChange={(e) => onResponsable(e.target.value)} placeholder="Nom du responsable" className={inputClass} autoFocus />
      </Champ>
    </div>
  );
}

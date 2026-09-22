"use client";

// Données communes de l'activité, affichées dans l'en-tête : date T0, budget,
// responsable. Chaque valeur s'ouvre dans un petit panneau pour être modifiée.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { LIBELLE_REGIME, type Calendrier, type RegimeCalendrier } from "@/lib/livrableSchedule";
import { BudgetMultiDevise } from "./BudgetMultiDevise";
import { controlClasses } from "@/components/ui/input";
import { formatCurrency } from "@/lib/helpers/currencyHelpers";
import { cn } from "@/lib/utils";

type Budget = { devise: string; montant: number; pourcentage?: number };

interface Props {
  dateT0: string;
  onDateT0: (value: string) => void;
  budgets: Budget[];
  onBudgets: (value: Budget[]) => void;
  budgetTotalFCFA: number;
  responsable: string;
  onResponsable: (value: string) => void;
  calendrier: Calendrier;
  onCalendrier: (value: Calendrier) => void;
  readOnly: boolean;
}

/** Étiquette compacte du régime, pour l'en-tête. */
const REGIME_COURT: Record<RegimeCalendrier, string> = {
  calendaire: "7 j/7",
  "lun-ven": "Lun–Ven",
  "lun-sam": "Lun–Sam",
};

const jourCourt = (jour: string) =>
  new Date(`${jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

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
        className={`group flex h-7.5 items-center gap-2 rounded-md border px-2.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus ${
          manquant ? "border-warning/40 bg-warning-subtle" : "border-transparent hover:border-line hover:bg-inset"
        } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
      >
        <span className="text-[10.5px] font-semibold tracking-wide text-fg-subtle uppercase">{label}</span>
        <span className={`text-[13px] font-semibold ${manquant ? "text-warning" : "text-fg"}`}>{valeur}</span>
        {!readOnly && <Pencil size={12} className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />}
      </button>
      {ouvert && (
        <div
          className="absolute top-full left-0 z-30 mt-1 rounded-md border border-line bg-surface p-3 shadow-lg"
          style={{ width: largeur }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const inputClass = cn(controlClasses, "h-8 px-2.5");

export function ActivityGeneralStrip({
  dateT0,
  onDateT0,
  budgets,
  onBudgets,
  budgetTotalFCFA,
  responsable,
  onResponsable,
  calendrier,
  onCalendrier,
  readOnly,
}: Props) {
  const plusieursDevises = budgets.some((b) => b.devise !== "FCFA" && b.montant);
  const feries = calendrier.feries ?? [];
  const chomes = (jours: string[]) => [...new Set(jours)].sort();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Champ label="T0" valeur={dateT0 ? new Date(`${dateT0}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "À définir"} manquant={!dateT0} readOnly={readOnly}>
        <label className="block text-[11px] font-bold text-fg-muted mb-1.5">Date T0 de l&apos;activité</label>
        <input type="date" value={dateT0} onChange={(e) => onDateT0(e.target.value)} className={inputClass} autoFocus />
        <p className="mt-1.5 text-[10px] text-fg-subtle">Les délais des livrables et des tâches se comptent depuis T0.</p>
      </Champ>

      <Champ label="Budget" valeur={budgetTotalFCFA ? formatCurrency(budgetTotalFCFA, "FCFA") : "À définir"} manquant={!budgetTotalFCFA} readOnly={readOnly} largeur={520}>
        <label className="block text-[11px] font-bold text-fg-muted mb-1.5">Budget de l&apos;activité</label>
        <BudgetMultiDevise budgets={budgets} onChange={onBudgets} />
        {plusieursDevises && (
          <p className="mt-1.5 text-[11px] text-fg-muted">
            Total converti : <strong>{formatCurrency(budgetTotalFCFA, "FCFA")}</strong> (taux du financement du projet)
          </p>
        )}
      </Champ>

      <Champ
        label="Calendrier"
        valeur={REGIME_COURT[calendrier.regime] + (feries.length ? ` · ${feries.length} chômé${feries.length > 1 ? "s" : ""}` : "")}
        readOnly={readOnly}
        largeur={320}
      >
        <label className="block text-[11px] font-bold text-fg-muted mb-1.5">Jours travaillés</label>
        <select
          value={calendrier.regime}
          onChange={(e) => onCalendrier({ ...calendrier, regime: e.target.value as RegimeCalendrier })}
          className={inputClass}
          autoFocus
        >
          {(Object.keys(LIBELLE_REGIME) as RegimeCalendrier[]).map((regime) => (
            <option key={regime} value={regime}>
              {LIBELLE_REGIME[regime]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[10px] text-fg-subtle">
          Les durées en jours et en semaines ne comptent que les jours travaillés ; un mois reste un mois de
          calendrier. Changer de régime redate toute l&apos;activité.
        </p>

        {calendrier.regime !== "calendaire" && (
          <div className="mt-3 border-t border-line pt-2.5">
            <label className="block text-[11px] font-bold text-fg-muted mb-1.5">Jours chômés</label>
            {feries.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {chomes(feries).map((jour) => (
                  <button
                    key={jour}
                    type="button"
                    onClick={() => onCalendrier({ ...calendrier, feries: feries.filter((f) => f !== jour) })}
                    className="group inline-flex items-center gap-1 rounded border border-line bg-inset px-1.5 py-0.5 text-[11px] text-fg-muted hover:border-danger/40 hover:text-danger"
                    title="Retirer ce jour"
                  >
                    {jourCourt(jour)}
                    <X size={10} />
                  </button>
                ))}
              </div>
            )}
            <input
              type="date"
              value=""
              onChange={(e) => e.target.value && onCalendrier({ ...calendrier, feries: chomes([...feries, e.target.value]) })}
              className={inputClass}
            />
            <p className="mt-1.5 text-[10px] text-fg-subtle">
              Fériés, congés, saison des pluies : ces jours ne comptent pas dans les durées.
            </p>
          </div>
        )}
      </Champ>

      <Champ label="Responsable" valeur={responsable || "—"} readOnly={readOnly}>
        <label className="block text-[11px] font-bold text-fg-muted mb-1.5">Responsable de l&apos;activité</label>
        <input type="text" value={responsable} onChange={(e) => onResponsable(e.target.value)} placeholder="Nom du responsable" className={inputClass} autoFocus />
      </Champ>
    </div>
  );
}

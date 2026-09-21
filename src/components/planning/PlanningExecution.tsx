"use client";

// ══════════════════════════════════════════════════════════════
// PHASE D'EXÉCUTION
//
// L'exécution d'un marché se lit en chaîne, et chaque maillon est un onglet :
//
//   DEVIS  →  PLANNING  →  RÉPARTITION  →  COURBES
//
// Le devis dit ce qu'il y a à faire et pour combien ; le planning dit quand ;
// la répartition étale quantités et montants sur les périodes au prorata des
// jours travaillés ; les courbes montrent ce qu'il faudra décaisser et où l'on
// devrait en être. Seuls les deux premiers se saisissent — les autres se
// calculent.
// ══════════════════════════════════════════════════════════════

import { useState, type ReactNode } from "react";
import { BarChart3, CalendarRange, Hammer, Receipt } from "lucide-react";
import type { TacheExecution } from "@/services/api/planningService";
import type { ActivityType } from "@/lib/activityTypes";
import type { Calendrier } from "@/lib/livrableSchedule";
import type { Fiscalite, LigneDqe } from "@/lib/dqe";
import type { Echelle } from "@/lib/repartition";
import { PlanningFormExecution } from "./PlanningFormExecution";
import { DqeTable } from "./DqeTable";
import { RepartitionTable } from "./RepartitionTable";
import { CourbesExecution } from "./CourbesExecution";

export type OngletExecution = "devis" | "planning" | "repartition" | "courbes";

const ONGLETS: { cle: OngletExecution; label: string; icone: ReactNode; aide: string }[] = [
  { cle: "devis", label: "Devis", icone: <Receipt size={14} />, aide: "Le bordereau du marché : quantités, prix unitaires et fiscalité." },
  { cle: "planning", label: "Planning", icone: <Hammer size={14} />, aide: "Les tâches, leur enchaînement et leurs échéances." },
  { cle: "repartition", label: "Répartition", icone: <CalendarRange size={14} />, aide: "Quantités et montants étalés sur les périodes." },
  { cle: "courbes", label: "Courbes", icone: <BarChart3 size={14} />, aide: "Dépenses par période et avancement cumulé." },
];

interface Props {
  taches: TacheExecution[];
  onTaches: (taches: TacheExecution[]) => void;
  dqe: LigneDqe[];
  onDqe: (lignes: LigneDqe[]) => void;
  fiscalite: Fiscalite;
  onFiscalite: (fiscalite: Fiscalite) => void;
  echelle: Echelle;
  onEchelle: (echelle: Echelle) => void;
  dateT0: string;
  calendrierTravail?: Calendrier;
  readOnly: boolean;
  typeActivite?: ActivityType;
  controleDemande?: boolean;
  /** Action placée dans l'en-tête de la carte (retirer la phase…). */
  action?: ReactNode;
}

export function PlanningExecution({
  taches,
  onTaches,
  dqe,
  onDqe,
  fiscalite,
  onFiscalite,
  echelle,
  onEchelle,
  dateT0,
  calendrierTravail,
  readOnly,
  typeActivite,
  controleDemande,
  action,
}: Props) {
  const [onglet, setOnglet] = useState<OngletExecution>("planning");

  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-line bg-inset/50 p-1" aria-label="Étapes de l'exécution">
        {ONGLETS.map((o) => {
          const actif = onglet === o.cle;
          return (
            <button
              key={o.cle}
              type="button"
              onClick={() => setOnglet(o.cle)}
              title={o.aide}
              aria-current={actif ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                actif ? "bg-surface text-fg shadow-sm border border-line" : "border border-transparent text-fg-muted hover:text-fg hover:bg-surface/60"
              }`}
            >
              {o.icone}
              {o.label}
            </button>
          );
        })}
      </nav>

      {/* Les onglets restent montés : la saisie du devis survit à un aller-retour
          vers le planning, comme les phases sur la page de l'activité. */}
      <div hidden={onglet !== "devis"}>
        <DqeTable
          lignes={dqe}
          onChange={onDqe}
          taches={taches}
          fiscalite={fiscalite}
          onFiscalite={onFiscalite}
          readOnly={readOnly}
          controleDemande={controleDemande}
          action={onglet === "devis" ? action : undefined}
        />
      </div>

      <div hidden={onglet !== "planning"}>
        <PlanningFormExecution
          taches={taches}
          onChange={onTaches}
          dateT0={dateT0}
          calendrierTravail={calendrierTravail}
          readOnly={readOnly}
          typeActivite={typeActivite}
          controleDemande={controleDemande}
          action={onglet === "planning" ? action : undefined}
        />
      </div>

      {/* Répartition et courbes se recalculent entièrement : inutile de les
          garder montées, et leurs tableaux sont larges. */}
      {onglet === "repartition" && (
        <RepartitionTable
          dqe={dqe}
          taches={taches}
          echelle={echelle}
          onEchelle={onEchelle}
          fiscalite={fiscalite}
          calendrierTravail={calendrierTravail}
          readOnly={readOnly}
        />
      )}

      {onglet === "courbes" && (
        <CourbesExecution dqe={dqe} taches={taches} echelle={echelle} calendrierTravail={calendrierTravail} />
      )}
    </div>
  );
}

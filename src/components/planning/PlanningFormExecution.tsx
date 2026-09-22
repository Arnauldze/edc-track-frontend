"use client";

// Planification de l'exécution : tâches T1, T2…, mêmes règles que les livrables
// d'étude, avec unité, quantité et prix unitaire (voir PlanningCalendrierForm).

import type { ReactNode } from "react";
import { Hammer } from "lucide-react";
import type { TacheExecution } from "@/services/api/planningService";
import type { ActivityType } from "@/lib/activityTypes";
import type { Calendrier, ModeFin } from "@/lib/livrableSchedule";
import { PlanningCalendrierForm, nouvelleLigne, type PhaseCalendrier } from "./PlanningCalendrierForm";

/**
 * Type de planification proposé pour l'exécution. Règle de l'équipe : les
 * travaux se planifient au début + durée ; pour toute autre nature, exécuter
 * revient à produire des livrables et le tableau se comporte comme celui de
 * l'étude, l'échéance se comptant depuis T0.
 *
 * Ce n'est qu'un défaut : le sélecteur « Type de planification » permet d'en
 * changer pour toute la phase.
 */
export const modeExecution = (type: ActivityType | undefined): ModeFin =>
  type === "travaux" ? "duree" : "delai";

const phaseExecution = (type: ActivityType | undefined): PhaseCalendrier => ({
  titre: "Planification de l'exécution",
  description: "Tâches d'exécution : pondération, quantités, enchaînement et échéances.",
  icone: <Hammer size={16} />,
  prefixe: "T",
  champNom: "designation",
  libelleNom: "Désignation de la tâche",
  placeholderNom: "Désignation…",
  mot: "tâche",
  importType: "execution",
  modeDefaut: modeExecution(type),
  quantites: true,
});

export const nouvelleTache = (numero: string, type?: ActivityType): TacheExecution => ({
  ...nouvelleLigne<TacheExecution>(phaseExecution(type), numero),
  modeFin: modeExecution(type),
});

interface Props {
  taches: TacheExecution[];
  onChange: (taches: TacheExecution[]) => void;
  dateT0: string;
  /** Jours travaillés de l'activité. */
  calendrierTravail?: Calendrier;
  readOnly: boolean;
  /** Nature de l'activité : elle décide du type de planification proposé. */
  typeActivite?: ActivityType;
  /** Contrôle d'enregistrement demandé : champs obligatoires vides en rouge. */
  controleDemande?: boolean;
  /** Action placée dans l'en-tête de la carte. */
  action?: ReactNode;
}

export function PlanningFormExecution({ taches, onChange, dateT0, calendrierTravail, readOnly, typeActivite, controleDemande, action }: Props) {
  return (
    <PlanningCalendrierForm
      phase={phaseExecution(typeActivite)}
      lignes={taches}
      onChange={onChange}
      dateT0={dateT0}
      calendrierTravail={calendrierTravail}
      readOnly={readOnly}
      controleDemande={controleDemande}
      action={action}
    />
  );
}

"use client";

// Planification de l'exécution : tâches T1, T2…, mêmes règles que les livrables
// d'étude, avec unité, quantité et prix unitaire (voir PlanningCalendrierForm).

import type { ReactNode } from "react";
import { Hammer } from "lucide-react";
import type { TacheExecution } from "@/services/api/planningService";
import { PlanningCalendrierForm, nouvelleLigne, type PhaseCalendrier } from "./PlanningCalendrierForm";

const EXECUTION: PhaseCalendrier = {
  titre: "Planification de l'exécution",
  description: "Tâches d'exécution : pondération, quantités, enchaînement et échéances.",
  icone: <Hammer size={16} />,
  prefixe: "T",
  champNom: "designation",
  libelleNom: "Désignation de la tâche",
  placeholderNom: "Désignation…",
  mot: "tâche",
  importType: "execution",
  quantites: true,
};

export const nouvelleTache = (numero: string): TacheExecution => nouvelleLigne<TacheExecution>(EXECUTION, numero);

interface Props {
  taches: TacheExecution[];
  onChange: (taches: TacheExecution[]) => void;
  dateT0: string;
  readOnly: boolean;
  /** Action placée dans l'en-tête de la carte. */
  action?: ReactNode;
}

export function PlanningFormExecution({ taches, onChange, dateT0, readOnly, action }: Props) {
  return <PlanningCalendrierForm phase={EXECUTION} lignes={taches} onChange={onChange} dateT0={dateT0} readOnly={readOnly} action={action} />;
}

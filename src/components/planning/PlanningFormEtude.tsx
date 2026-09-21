"use client";

// Planification de l'étude préalable : livrables R1, R2… (voir PlanningCalendrierForm).

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { Livrable } from "@/services/api/planningService";
import type { Calendrier } from "@/lib/livrableSchedule";
import { PlanningCalendrierForm, nouvelleLigne, type PhaseCalendrier } from "./PlanningCalendrierForm";

const ETUDE: PhaseCalendrier = {
  titre: "Planification de l'étude préalable",
  description: "Livrables de l'étude : pondération, enchaînement et échéances.",
  icone: <FileText size={16} />,
  prefixe: "R",
  champNom: "intitule",
  libelleNom: "Intitulé du livrable",
  placeholderNom: "Nom du livrable…",
  mot: "livrable",
  importType: "etude",
  // Une étude se planifie au délai depuis T0 : c'est la date de remise du
  // livrable qui compte, pas son enchaînement (décision de l'équipe).
  modeDefaut: "delai",
};

export const nouveauLivrable = (numero: string): Livrable => ({ ...nouvelleLigne<Livrable>(ETUDE, numero), statut: "en_attente" });

interface Props {
  livrables: Livrable[];
  onChange: (livrables: Livrable[]) => void;
  dateT0: string;
  /** Jours travaillés de l'activité. */
  calendrierTravail?: Calendrier;
  readOnly: boolean;
  /** Contrôle d'enregistrement demandé : champs obligatoires vides en rouge. */
  controleDemande?: boolean;
  /** Action placée dans l'en-tête de la carte. */
  action?: ReactNode;
}

export function PlanningFormEtude({ livrables, onChange, dateT0, calendrierTravail, readOnly, controleDemande, action }: Props) {
  return (
    <PlanningCalendrierForm
      phase={ETUDE}
      lignes={livrables}
      onChange={onChange}
      dateT0={dateT0}
      calendrierTravail={calendrierTravail}
      readOnly={readOnly}
      controleDemande={controleDemande}
      action={action}
    />
  );
}

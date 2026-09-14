// Livrables d'étude et tâches d'exécution tels qu'envoyés à l'API. Le serveur
// refuse les champs inconnus et recalcule les dates : on n'envoie que les
// saisies utiles, avec ce qui fixe le début (debutFixe) et l'échéance (modeFin).

import type { Livrable, TacheExecution } from "@/services/api/planningService";
import { toDay } from "./livrableSchedule";

export function livrablePourApi(l: Livrable): Livrable {
  return {
    numero: l.numero,
    intitule: l.intitule,
    ponderation: l.ponderation || 0,
    predecesseur: l.predecesseur || undefined,
    debutFixe: !!l.debutFixe,
    dateDebut: l.debutFixe ? toDay(l.dateDebut) : undefined,
    modeFin: l.modeFin,
    duree: l.modeFin === "duree" ? l.duree : undefined,
    dureeUnite: l.dureeUnite,
    delai: l.modeFin === "delai" ? l.delai : undefined,
    delaiUnite: l.delaiUnite,
    dateFin: l.modeFin === "fin" ? toDay(l.dateFin) : undefined,
    description: l.description || undefined,
    statut: l.statut,
  };
}

export function tachePourApi(t: TacheExecution): TacheExecution {
  return {
    numero: t.numero,
    designation: t.designation,
    ponderation: t.ponderation || 0,
    predecesseur: t.predecesseur || undefined,
    debutFixe: !!t.debutFixe,
    dateDebut: t.debutFixe ? toDay(t.dateDebut) : undefined,
    modeFin: t.modeFin,
    duree: t.modeFin === "duree" ? t.duree : undefined,
    dureeUnite: t.dureeUnite,
    delai: t.modeFin === "delai" ? t.delai : undefined,
    delaiUnite: t.delaiUnite,
    dateFin: t.modeFin === "fin" ? toDay(t.dateFin) : undefined,
    unite: t.unite || undefined,
    quantite: t.quantite,
    prixUnitaire: t.prixUnitaire,
    avancement: t.avancement,
    responsable: t.responsable || undefined,
  };
}

/** Message d'erreur de l'API : texte, ou liste de messages de validation. */
export function messageApi(error: unknown, parDefaut: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(" • ");
  return message || parDefaut;
}

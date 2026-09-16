// ══════════════════════════════════════════════════════════════
// DONNÉES DU TABLEAU DE BORD
// Tout se déduit de ce que le serveur renvoie déjà : les projets et leurs
// planifications. Les synthèses viennent du même moteur que la planification
// (lib/planningRollup.ts), pour que les deux écrans disent la même chose.
// ══════════════════════════════════════════════════════════════

import type { Planning } from "@/services/api/planningService";
import type { Project } from "@/services/api/projectService";
import { PROJECT_ROOT_ID, rollupStructure, type Metrics } from "./planningRollup";

export type StatutProjet = "termine" | "en_cours" | "planifie" | "a_planifier";

export const LIBELLES_STATUT: Record<StatutProjet, string> = {
  termine: "Terminé",
  en_cours: "En cours",
  planifie: "Planifié",
  a_planifier: "À planifier",
};

export interface SyntheseProjet {
  code: string;
  nom: string;
  statut: StatutProjet;
  /** Avancement de 0 à 100, absent tant que rien n'est planifié. */
  avancement?: number;
  unites: number;
  unitesPlanifiees: number;
  debut?: Date;
  fin?: Date;
}

export interface Echeance {
  id: string;
  date: Date;
  titre: string;
  /** Ce qui arrive à cette date : fin d'un livrable, d'une tâche… */
  nature: string;
  /** Projet et activité concernés. */
  contexte: string;
  jalon: boolean;
  href: string;
}

const jourDe = (valeur: unknown): Date | undefined => {
  if (!valeur) return undefined;
  const date = new Date(valeur as string);
  return isNaN(date.getTime()) ? undefined : date;
};

const memeJour = (a: Date | undefined, b: Date | undefined) =>
  !!a && !!b && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/** Synthèse d'un projet : avancement, unités planifiées, période. */
export function syntheseProjet(project: Project, plannings: Planning[]): SyntheseProjet {
  const metrics: Metrics | undefined = rollupStructure(project.components ?? [], plannings).get(PROJECT_ROOT_ID);
  const unites = metrics?.leaves ?? 0;
  const unitesPlanifiees = metrics?.plannedLeaves ?? 0;
  const avancement = metrics?.progress;

  let statut: StatutProjet = "a_planifier";
  if (unitesPlanifiees > 0) {
    if (avancement !== undefined && avancement >= 100) statut = "termine";
    else statut = avancement ? "en_cours" : "planifie";
  }

  return {
    code: project.code,
    nom: project.name,
    statut,
    avancement,
    unites,
    unitesPlanifiees,
    debut: metrics?.start,
    fin: metrics?.finish,
  };
}

/** Avancement moyen des projets, pondéré par leurs unités planifiées. */
export function avancementMoyen(syntheses: SyntheseProjet[]): number | undefined {
  const planifies = syntheses.filter((s) => s.unitesPlanifiees > 0 && s.avancement !== undefined);
  if (planifies.length === 0) return undefined;
  const poids = planifies.reduce((somme, s) => somme + s.unitesPlanifiees, 0);
  return planifies.reduce((somme, s) => somme + (s.avancement ?? 0) * s.unitesPlanifiees, 0) / poids;
}

/**
 * Prochaines échéances, toutes activités confondues : fin des livrables
 * d'étude, des tâches d'exécution et de la phase de passation.
 */
export function prochainesEcheances(
  entrees: { project: Project; plannings: Planning[] }[],
  aujourdhui: Date,
  limite = 4,
): Echeance[] {
  const debutDuJour = new Date(aujourdhui);
  debutDuJour.setHours(0, 0, 0, 0);
  const echeances: Echeance[] = [];

  for (const { project, plannings } of entrees) {
    for (const planning of plannings) {
      const href = `/planification/${encodeURIComponent(project.code)}/${encodeURIComponent(planning.activityPath)}`;
      const contexte = `${project.name} › ${planning.activityName}`;
      const ajouter = (cle: string, date: Date | undefined, titre: string, nature: string, jalon = false) => {
        if (!date || date < debutDuJour || !titre) return;
        echeances.push({ id: `${planning.activityPath}:${cle}`, date, titre, nature, contexte, jalon, href });
      };

      (planning.livrables ?? []).forEach((livrable, index) =>
        ajouter(
          `livrable-${index}`,
          jourDe(livrable.dateFin ?? livrable.dateEcheance),
          livrable.intitule,
          `Échéance du livrable ${livrable.numero}`,
        ),
      );

      (planning.tachesExecution ?? []).forEach((tache, index) => {
        const debut = jourDe(tache.dateDebut);
        const fin = jourDe(tache.dateFin);
        ajouter(
          `tache-${index}`,
          fin,
          tache.designation,
          memeJour(debut, fin) ? "Jalon" : `Fin de la tâche ${tache.numero}`,
          memeJour(debut, fin),
        );
      });

      ajouter("passation", jourDe(planning.dateFinPassation), planning.activityName, "Fin de la passation");
    }
  }

  return echeances.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limite);
}

/** « dans 2 j », « aujourd'hui », « dans 3 mois ». */
export function delaiLisible(date: Date, aujourdhui: Date): string {
  const jour = 86_400_000;
  const debutDuJour = new Date(aujourdhui);
  debutDuJour.setHours(0, 0, 0, 0);
  const cible = new Date(date);
  cible.setHours(0, 0, 0, 0);

  const jours = Math.round((cible.getTime() - debutDuJour.getTime()) / jour);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours < 31) return `dans ${jours} j`;
  const mois = Math.round(jours / 30.44);
  return mois <= 1 ? "dans 1 mois" : `dans ${mois} mois`;
}

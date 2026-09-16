// ══════════════════════════════════════════════════════════════
// SYNTHÈSES DU TABLEAU DE PLANIFICATION
//
// Comme dans MS Project, une ligne de synthèse (projet, composant,
// sous-composant décomposé) ne se saisit pas : elle résume ses unités
// planifiables.
//
//   Début / Fin   plus tôt et plus tard des unités qui ont des dates
//   Durée         écart calendaire entre ces deux dates
//   Avancement    moyenne des unités pondérée par leur durée
//   Budget        somme des budgets des unités (FCFA)
//   Pondération   part du budget du parent
//
// Pour une unité planifiée :
//   - dates : dates globales, livrables, étapes de passation et tâches ;
//   - avancement par phase :
//       étude       livrables validés, selon leur pondération
//       passation   étapes terminées / étapes
//       exécution   avancement des tâches, selon leur pondération
//     puis moyenne des phases pondérée par leur durée ;
//   - jalon : une unité dont le début et la fin tombent le même jour.
// ══════════════════════════════════════════════════════════════

import type { Planning } from "@/services/api/planningService";
import type { Component } from "@/services/api/projectService";
import { daysBetween } from "./timescale";

export interface Metrics {
  start?: Date;
  finish?: Date;
  /** Écart calendaire en jours (0 pour un jalon). */
  days?: number;
  /** Avancement de 0 à 100. */
  progress?: number;
  /** Budget en FCFA. */
  budget?: number;
  /** Part du budget du parent, de 0 à 100. */
  weight?: number;
  milestone: boolean;
  /** Unités planifiables couvertes, et celles qui ont une planification. */
  leaves: number;
  plannedLeaves: number;
}

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? undefined : d;
};

class Span {
  start?: Date;
  finish?: Date;
  add(from: unknown, to?: unknown) {
    for (const d of [toDate(from), toDate(to ?? from)]) {
      if (!d) continue;
      if (!this.start || d < this.start) this.start = d;
      if (!this.finish || d > this.finish) this.finish = d;
    }
    return this;
  }
  get days() {
    return this.start && this.finish ? daysBetween(this.start, this.finish) : undefined;
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Moyenne pondérée ; poids nuls partout : moyenne simple. */
function weightedAverage(items: { value: number; weight: number }[]): number | undefined {
  if (items.length === 0) return undefined;
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  if (total <= 0) return items.reduce((sum, i) => sum + i.value, 0) / items.length;
  return items.reduce((sum, i) => sum + i.value * i.weight, 0) / total;
}

/** Mesures d'une unité planifiable, d'après sa planification. */
export function leafMetrics(planning: Planning | undefined): Metrics {
  if (!planning) return { milestone: false, leaves: 1, plannedLeaves: 0 };

  const span = new Span()
    .add(planning.dateDebutActualisee ?? planning.dateDebutInitiale, planning.dateFinActualisee ?? planning.dateFinInitiale);
  const phases: { value: number; weight: number }[] = [];

  const livrables = planning.livrables ?? [];
  if (livrables.length) {
    const phase = new Span();
    livrables.forEach((l) => phase.add(l.dateDebut ?? l.dateEcheance, l.dateFin ?? l.dateEcheance));
    const done = weightedAverage(livrables.map((l) => ({ value: l.statut === "valide" ? 100 : 0, weight: l.ponderation ?? 0 })));
    if (done !== undefined) phases.push({ value: done, weight: phase.days ?? 0 });
    span.add(phase.start, phase.finish);
  }

  // Passation : sa période élargit celle de l'activité, sans peser sur
  // l'avancement — l'état des marchés du PPM viendra avec le module Suivi.
  span.add(planning.dateDebutPassation, planning.dateFinPassation);

  // Ancien modèle d'étapes, pour les planifications enregistrées avant le PPM.
  const etapes = planning.etapesPassation ?? [];
  if (etapes.length) {
    const phase = new Span();
    etapes.forEach((e) => phase.add(e.dateDebut, e.dateFin));
    phases.push({ value: (etapes.filter((e) => e.statut === "termine").length / etapes.length) * 100, weight: phase.days ?? 0 });
    span.add(phase.start, phase.finish);
  }

  const taches = planning.tachesExecution ?? [];
  if (taches.length) {
    const phase = new Span();
    taches.forEach((t) => phase.add(t.dateDebut, t.dateFin));
    const done = weightedAverage(taches.map((t) => ({ value: t.avancement ?? 0, weight: t.ponderation ?? 0 })));
    if (done !== undefined) phases.push({ value: done, weight: phase.days ?? 0 });
    span.add(phase.start, phase.finish);
  }

  const progress = weightedAverage(phases);
  const budget = planning.budgetActualiseTotal ?? planning.budgetInitialTotal;
  return {
    start: span.start,
    finish: span.finish,
    days: span.days,
    progress: progress === undefined ? undefined : round1(progress),
    budget: budget && budget > 0 ? budget : undefined,
    milestone: span.days === 0,
    leaves: 1,
    plannedLeaves: 1,
  };
}

/** Résume des mesures d'enfants. */
export function summarize(children: Metrics[]): Metrics {
  const span = new Span();
  children.forEach((c) => span.add(c.start, c.finish));
  const withProgress = children.filter((c) => c.progress !== undefined);
  const progress = weightedAverage(withProgress.map((c) => ({ value: c.progress!, weight: c.days ?? 0 })));
  const budgets = children.filter((c) => c.budget !== undefined);
  return {
    start: span.start,
    finish: span.finish,
    days: span.days,
    progress: progress === undefined ? undefined : round1(progress),
    budget: budgets.length ? budgets.reduce((sum, c) => sum + c.budget!, 0) : undefined,
    milestone: false,
    leaves: children.reduce((sum, c) => sum + c.leaves, 0),
    plannedLeaves: children.reduce((sum, c) => sum + c.plannedLeaves, 0),
  };
}

export const PROJECT_ROOT_ID = "project-root";

/**
 * Mesures de chaque unité de la structure et du projet (clé `project-root`).
 * La pondération d'un composant est celle de la structure (part du
 * financement) ; celle des autres unités, leur part du budget du parent.
 */
export function rollupStructure(components: Component[], plannings: Planning[]): Map<string, Metrics> {
  const byUnit = new Map(plannings.map((p) => [p.activityPath, p]));
  const result = new Map<string, Metrics>();

  const withWeights = (list: { id: string; metrics: Metrics }[], parent: Metrics) => {
    list.forEach(({ id, metrics }) => {
      const weight = parent.budget && metrics.budget !== undefined ? round1((metrics.budget / parent.budget) * 100) : undefined;
      result.set(id, { ...metrics, weight });
    });
  };

  const componentMetrics = components.map((comp) => {
    const scs = comp.sousComposants ?? [];
    let metrics: Metrics;
    if (scs.length === 0) {
      metrics = leafMetrics(byUnit.get(comp.id));
    } else {
      const scMetrics = scs.map((sc) => {
        const acts = sc.activities ?? [];
        if (acts.length === 0) return { id: sc.id, metrics: leafMetrics(byUnit.get(sc.id)) };
        const actMetrics = acts.map((a) => ({ id: a.id, metrics: leafMetrics(byUnit.get(a.id)) }));
        const scSummary = summarize(actMetrics.map((a) => a.metrics));
        withWeights(actMetrics, scSummary);
        return { id: sc.id, metrics: scSummary };
      });
      metrics = summarize(scMetrics.map((s) => s.metrics));
      withWeights(scMetrics, metrics);
    }
    return { id: comp.id, metrics, ponderation: comp.ponderation };
  });

  const project = summarize(componentMetrics.map((c) => c.metrics));
  componentMetrics.forEach(({ id, metrics, ponderation }) => {
    const weight = ponderation !== undefined && ponderation > 0
      ? ponderation
      : project.budget && metrics.budget !== undefined ? round1((metrics.budget / project.budget) * 100) : undefined;
    result.set(id, { ...metrics, weight });
  });
  result.set(PROJECT_ROOT_ID, { ...project, weight: 100 });
  return result;
}

/** Durée lisible : jours jusqu'à 60, puis semaines jusqu'à 26, puis mois (30,44 j). */
export function formatDuration(days: number | undefined): string {
  if (days === undefined) return "—";
  if (days === 0) return "0 j";
  if (days <= 60) return `${days} j`;
  if (days <= 182) return `${round1(days / 7).toLocaleString("fr-FR")} sem.`;
  return `${round1(days / 30.44).toLocaleString("fr-FR")} mois`;
}

/** Montant FCFA compact : 1,5 Md, 250 M, 12 k. */
export function formatBudget(amount: number | undefined): string {
  if (amount === undefined) return "—";
  const units: [number, string][] = [[1e9, "Md"], [1e6, "M"], [1e3, "k"]];
  for (const [size, suffix] of units) {
    if (amount >= size) return `${round1(amount / size).toLocaleString("fr-FR")} ${suffix}`;
  }
  return Math.round(amount).toLocaleString("fr-FR");
}

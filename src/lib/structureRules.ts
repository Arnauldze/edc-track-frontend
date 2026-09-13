// ══════════════════════════════════════════════════════════════
// RÈGLES D'UNE MODIFICATION DE STRUCTURE FACE AUX PLANIFICATIONS
//
// Miroir des vérifications du serveur (ProjectsService.planStructureChange),
// appliqué à chaque opération pour prévenir l'utilisateur tout de suite
// plutôt qu'à l'enregistrement. Le serveur reste l'arbitre.
// ══════════════════════════════════════════════════════════════

import type { Component } from "@/services/api/projectService";
import { listUnits, type UnitInfo } from "./structureUnits";

export interface StructureCheck {
  /** Raison du refus ; absente si la modification est permise. */
  error?: string;
  /** Conséquences à annoncer (transferts de planification). */
  notices: string[];
}

const typeOf = (unit: UnitInfo | undefined) => unit?.typeActivite ?? "travaux";

/**
 * @param plannedIds identifiants des unités qui ont une planification
 */
export function checkStructureChange(before: Component[], after: Component[], plannedIds: Set<string>): StructureCheck {
  const previous = new Map(listUnits(before).map((u) => [u.id, u]));
  const nextUnits = listUnits(after);
  const next = new Map(nextUnits.map((u) => [u.id, u]));
  const notices: string[] = [];

  for (const old of previous.values()) {
    if (next.has(old.id) || !plannedIds.has(old.id)) continue;
    return { error: `« ${old.name} » est planifiée : supprimez d'abord sa planification.`, notices };
  }

  for (const unit of nextUnits) {
    const old = previous.get(unit.id);
    if (!old || !plannedIds.has(unit.id)) continue;

    if (old.isLeaf && unit.isLeaf && typeOf(old) !== typeOf(unit)) {
      return { error: `Le type de « ${unit.name} » ne peut plus changer : elle est planifiée.`, notices };
    }

    if (old.isLeaf && !unit.isLeaf) {
      const receiver = nextUnits.find((u) => u.isLeaf && u.context.startsWith(`${unit.context}/`));
      if (!receiver) continue;
      if (plannedIds.has(receiver.id)) {
        return {
          error: `« ${unit.name} » est planifiée et « ${receiver.name} », qui recevrait sa planification, l'est déjà.`,
          notices,
        };
      }
      if (typeOf(old) !== typeOf(receiver)) {
        return {
          error: `« ${receiver.name} » doit être du même type que « ${unit.name} » pour recevoir sa planification.`,
          notices,
        };
      }
      notices.push(`La planification de « ${unit.name} » sera transférée à « ${receiver.name} ».`);
    }
  }

  return { notices };
}

/** L'unité ou l'une de ses descendantes est-elle planifiée ? */
export function hasPlannedDescendant(components: Component[], id: string, plannedIds: Set<string>): boolean {
  const unit = listUnits(components).find((u) => u.id === id);
  if (!unit) return false;
  return listUnits(components).some(
    (u) => plannedIds.has(u.id) && (u.id === id || u.context.startsWith(`${unit.context}/`)),
  );
}

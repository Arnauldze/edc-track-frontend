// ══════════════════════════════════════════════════════════════
// UNITÉS DE STRUCTURE
//
// Composants, sous-composants et activités ont chacun un identifiant unique
// dans le projet, qui ne change jamais : ni quand l'unité change de place,
// ni quand elle change de niveau. Tout ce qui s'y rattache s'appuie dessus :
//   - planification : clé = identifiant de l'unité planifiée ;
//   - équipe        : `entityId` de l'affectation ;
//   - archives      : `context` = chemin d'identifiants, ex. c1/sc1/{idActivité}.
//
// Miroir de backend/src/modules/projects/structure-units.ts : le serveur
// attribue un identifiant aux activités qui n'en ont pas et fait suivre
// documents et planifications quand une unité se déplace.
// ══════════════════════════════════════════════════════════════

import type { Component } from "@/services/api/projectService";

export type UnitLevel = "component" | "subcomponent" | "activity";

export interface UnitInfo {
  id: string;
  name: string;
  level: UnitLevel;
  /** Chemin d'identifiants depuis le composant, séparé par « / » (format `context` des archives). */
  context: string;
  /** Identifiants des unités parentes, du composant au parent direct. */
  ancestors: string[];
  /** Unité la plus fine : seule elle peut être planifiée. */
  isLeaf: boolean;
  typeActivite?: string;
}

const PREFIX: Record<UnitLevel, string> = { component: "c", subcomponent: "sc", activity: "a" };

/** Nouvel identifiant d'unité. Le préfixe indique le niveau de création, pas le niveau actuel. */
export function newUnitId(level: UnitLevel): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${PREFIX[level]}-${random}`;
}

/** Toutes les unités de la structure, dans l'ordre d'affichage. */
export function listUnits(components: Component[] | undefined): UnitInfo[] {
  const units: UnitInfo[] = [];
  for (const comp of components ?? []) {
    const scs = comp.sousComposants ?? [];
    units.push({
      id: comp.id,
      name: comp.name,
      level: "component",
      context: comp.id,
      ancestors: [],
      isLeaf: scs.length === 0,
      typeActivite: comp.typeActivite,
    });
    for (const sc of scs) {
      const activities = sc.activities ?? [];
      units.push({
        id: sc.id,
        name: sc.name,
        level: "subcomponent",
        context: `${comp.id}/${sc.id}`,
        ancestors: [comp.id],
        isLeaf: activities.length === 0,
        typeActivite: sc.typeActivite,
      });
      for (const act of activities) {
        units.push({
          id: act.id,
          name: act.name,
          level: "activity",
          context: `${comp.id}/${sc.id}/${act.id}`,
          ancestors: [comp.id, sc.id],
          isLeaf: true,
          typeActivite: act.typeActivite,
        });
      }
    }
  }
  return units;
}

export const findUnit = (components: Component[] | undefined, id: string) =>
  listUnits(components).find((u) => u.id === id);

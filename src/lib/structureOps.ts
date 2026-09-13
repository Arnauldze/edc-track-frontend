// ══════════════════════════════════════════════════════════════
// OPÉRATIONS SUR LA STRUCTURE D'UN PROJET
//
// Fonctions pures, désignant les unités par leur identifiant. Chaque
// opération renvoie une nouvelle structure ; elle renvoie la structure
// reçue, inchangée, quand elle n'est pas possible (voir les `can…`).
//
// Règles :
//   - trois niveaux au plus : composant › sous-composant › activité ;
//   - une unité garde son identifiant (et donc sa planification, ses
//     documents, ses affectations) quand elle change de niveau ou de place ;
//   - seule une unité fine (sans enfant) porte un type d'activité ;
//   - seul un composant porte un budget : un composant rétrogradé ajoute
//     le sien à celui du composant qui l'accueille.
// ══════════════════════════════════════════════════════════════

import type { Activity, Component, SousComposant } from "@/services/api/projectService";
import { newUnitId, type UnitLevel } from "./structureUnits";

export type ActivityType = Activity["typeActivite"];

export const MAX_DEPTH = 3;
const DEFAULT_TYPE: ActivityType = "travaux";
const LEVEL_BY_DEPTH: UnitLevel[] = ["component", "subcomponent", "activity"];

/** Représentation uniforme des trois niveaux. */
interface UnitNode {
  id: string;
  name: string;
  typeActivite?: ActivityType;
  budget?: number;
  devise?: string;
  ponderation?: number;
  children: UnitNode[];
}

interface Location {
  siblings: UnitNode[];
  index: number;
  /** 1 = composant, 2 = sous-composant, 3 = activité */
  depth: number;
  parent: UnitNode | null;
  /** Frères du parent, pour sortir d'un niveau. */
  parentSiblings: UnitNode[] | null;
}

// ── Conversion ─────────────────────────────────────────────────

function toTree(components: Component[]): UnitNode[] {
  return components.map((c) => ({
    id: c.id,
    name: c.name,
    typeActivite: c.typeActivite,
    budget: c.budget,
    devise: c.devise,
    ponderation: c.ponderation,
    children: (c.sousComposants ?? []).map((sc) => ({
      id: sc.id,
      name: sc.name,
      typeActivite: sc.typeActivite,
      children: (sc.activities ?? []).map((a) => ({ id: a.id, name: a.name, typeActivite: a.typeActivite, children: [] })),
    })),
  }));
}

const leafType = (node: UnitNode): ActivityType | undefined =>
  node.children.length === 0 ? node.typeActivite ?? DEFAULT_TYPE : undefined;

function fromTree(nodes: UnitNode[]): Component[] {
  return nodes.map((c) => {
    const component: Component = {
      id: c.id,
      name: c.name,
      sousComposants: c.children.map((sc) => {
        const sousComposant: SousComposant = {
          id: sc.id,
          name: sc.name,
          activities: sc.children.map((a) => ({ id: a.id, name: a.name, typeActivite: a.typeActivite ?? DEFAULT_TYPE })),
        };
        const type = leafType(sc);
        if (type) sousComposant.typeActivite = type;
        return sousComposant;
      }),
    };
    if (c.budget !== undefined) component.budget = c.budget;
    if (c.devise !== undefined) component.devise = c.devise;
    if (c.ponderation !== undefined) component.ponderation = c.ponderation;
    const type = leafType(c);
    if (type) component.typeActivite = type;
    return component;
  });
}

function locate(nodes: UnitNode[], id: string): Location | null {
  const walk = (siblings: UnitNode[], depth: number, parent: UnitNode | null, parentSiblings: UnitNode[] | null): Location | null => {
    for (let index = 0; index < siblings.length; index++) {
      const node = siblings[index];
      if (node.id === id) return { siblings, index, depth, parent, parentSiblings };
      const found = walk(node.children, depth + 1, node, siblings);
      if (found) return found;
    }
    return null;
  };
  return walk(nodes, 1, null, null);
}

/** Nombre de niveaux occupés par une unité et ses descendants (1 pour une unité fine). */
const height = (node: UnitNode): number => 1 + Math.max(0, ...node.children.map(height));

/** Applique une modification sur une copie ; `false` = opération impossible. */
function edit(components: Component[], change: (tree: UnitNode[]) => boolean): Component[] {
  const tree = toTree(components);
  return change(tree) ? fromTree(tree) : components;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Le composant `from` cesse d'en être un : son budget rejoint celui de `into`. */
function mergeBudget(from: UnitNode, into: UnitNode, rates: Record<string, number>) {
  if (from.budget && from.budget > 0) {
    const fromRate = rates[from.devise || "FCFA"] ?? 1;
    const intoRate = rates[into.devise || "FCFA"] ?? 1;
    into.budget = round2((into.budget ?? 0) + (from.budget * fromRate) / intoRate);
    if (from.ponderation !== undefined || into.ponderation !== undefined) {
      into.ponderation = Math.min(100, round2((into.ponderation ?? 0) + (from.ponderation ?? 0)));
    }
  }
  delete from.budget;
  delete from.devise;
  delete from.ponderation;
}

/** Une unité qui perd son dernier enfant redevient fine : elle reprend un type. */
function restoreLeafType(node: UnitNode | null) {
  if (node && node.children.length === 0 && !node.typeActivite) node.typeActivite = DEFAULT_TYPE;
}

// ── Niveau ─────────────────────────────────────────────────────

/** Descendre d'un niveau : l'unité devient le dernier enfant de l'unité qui la précède. */
export function canIndent(components: Component[], id: string): boolean {
  const tree = toTree(components);
  const at = locate(tree, id);
  return !!at && at.index > 0 && at.depth + height(at.siblings[at.index]) <= MAX_DEPTH;
}

export function indentUnit(components: Component[], id: string, rates: Record<string, number> = {}): Component[] {
  if (!canIndent(components, id)) return components;
  return edit(components, (tree) => {
    const at = locate(tree, id)!;
    const [node] = at.siblings.splice(at.index, 1);
    const target = at.siblings[at.index - 1];
    if (at.depth === 1) mergeBudget(node, target, rates);
    target.children.push(node);
    return true;
  });
}

/** Monter d'un niveau : l'unité se place juste après son parent. */
export function canOutdent(components: Component[], id: string): boolean {
  const at = locate(toTree(components), id);
  return !!at && at.depth > 1;
}

export function outdentUnit(components: Component[], id: string): Component[] {
  if (!canOutdent(components, id)) return components;
  return edit(components, (tree) => {
    const at = locate(tree, id)!;
    const [node] = at.siblings.splice(at.index, 1);
    const parentIndex = at.parentSiblings!.indexOf(at.parent!);
    at.parentSiblings!.splice(parentIndex + 1, 0, node);
    restoreLeafType(at.parent);
    return true;
  });
}

// ── Ordre ──────────────────────────────────────────────────────

/**
 * Unité voisine qui peut accueillir l'unité en fin (vers le haut) ou en tête
 * (vers le bas) quand elle est déjà première ou dernière de son parent.
 * Seule une unité qui a déjà des enfants accueille : on ne décompose pas
 * une unité fine par un simple déplacement.
 */
function neighbourParent(at: Location, direction: -1 | 1): UnitNode | null {
  if (!at.parent || !at.parentSiblings) return null;
  const neighbour = at.parentSiblings[at.parentSiblings.indexOf(at.parent) + direction];
  return neighbour && neighbour.children.length > 0 ? neighbour : null;
}

export function canMoveUp(components: Component[], id: string): boolean {
  const at = locate(toTree(components), id);
  return !!at && (at.index > 0 || !!neighbourParent(at, -1));
}

export function canMoveDown(components: Component[], id: string): boolean {
  const at = locate(toTree(components), id);
  return !!at && (at.index < at.siblings.length - 1 || !!neighbourParent(at, 1));
}

function move(components: Component[], id: string, direction: -1 | 1): Component[] {
  return edit(components, (tree) => {
    const at = locate(tree, id);
    if (!at) return false;
    const swapWith = at.index + direction;
    if (swapWith >= 0 && swapWith < at.siblings.length) {
      [at.siblings[at.index], at.siblings[swapWith]] = [at.siblings[swapWith], at.siblings[at.index]];
      return true;
    }
    const neighbour = neighbourParent(at, direction);
    if (!neighbour) return false;
    const [node] = at.siblings.splice(at.index, 1);
    if (direction === -1) neighbour.children.push(node);
    else neighbour.children.unshift(node);
    restoreLeafType(at.parent);
    return true;
  });
}

export const moveUnitUp = (components: Component[], id: string) => move(components, id, -1);
export const moveUnitDown = (components: Component[], id: string) => move(components, id, 1);

// ── Création, suppression, modification ────────────────────────

export interface Inserted {
  components: Component[];
  /** Identifiant de l'unité créée, `null` si l'insertion était impossible. */
  id: string | null;
}

/** Ajoute un composant en fin de structure. */
export function addComponent(components: Component[], name: string, typeActivite: ActivityType = DEFAULT_TYPE): Inserted {
  const id = newUnitId("component");
  return { components: [...components, { id, name, typeActivite, sousComposants: [] }], id };
}

/** Ajoute une unité de même niveau, juste après `afterId`. */
export function addSibling(components: Component[], afterId: string, name: string, typeActivite: ActivityType = DEFAULT_TYPE): Inserted {
  let id: string | null = null;
  const result = edit(components, (tree) => {
    const at = locate(tree, afterId);
    if (!at) return false;
    id = newUnitId(LEVEL_BY_DEPTH[at.depth - 1]);
    at.siblings.splice(at.index + 1, 0, { id, name, typeActivite, children: [] });
    return true;
  });
  return { components: result, id };
}

export function canAddChild(components: Component[], parentId: string): boolean {
  const at = locate(toTree(components), parentId);
  return !!at && at.depth < MAX_DEPTH;
}

/**
 * Ajoute une unité en fin des enfants de `parentId`. Si le parent était une
 * unité fine, c'est une décomposition : le nouvel enfant reprend son type,
 * et le serveur lui transmet la planification du parent.
 */
export function addChild(components: Component[], parentId: string, name: string): Inserted {
  if (!canAddChild(components, parentId)) return { components, id: null };
  let id: string | null = null;
  const result = edit(components, (tree) => {
    const at = locate(tree, parentId)!;
    const parent = at.siblings[at.index];
    const typeActivite = parent.children.length === 0 ? parent.typeActivite ?? DEFAULT_TYPE : DEFAULT_TYPE;
    id = newUnitId(LEVEL_BY_DEPTH[at.depth]);
    parent.children.push({ id, name, typeActivite, children: [] });
    return true;
  });
  return { components: result, id };
}

/** Supprime une unité et ses descendants. */
export function removeUnit(components: Component[], id: string): Component[] {
  return edit(components, (tree) => {
    const at = locate(tree, id);
    if (!at) return false;
    at.siblings.splice(at.index, 1);
    restoreLeafType(at.parent);
    return true;
  });
}

export function renameUnit(components: Component[], id: string, name: string): Component[] {
  return edit(components, (tree) => {
    const at = locate(tree, id);
    if (!at) return false;
    at.siblings[at.index].name = name;
    return true;
  });
}

/** Change le type d'une unité fine. Sans effet sur une unité qui a des enfants. */
export function setUnitType(components: Component[], id: string, typeActivite: ActivityType): Component[] {
  return edit(components, (tree) => {
    const at = locate(tree, id);
    if (!at || at.siblings[at.index].children.length > 0) return false;
    at.siblings[at.index].typeActivite = typeActivite;
    return true;
  });
}

// ── Lecture ────────────────────────────────────────────────────

/** Numérotation hiérarchique (WBS) : 1, 1.2, 1.2.3. */
export function wbsNumbers(components: Component[]): Map<string, string> {
  const numbers = new Map<string, string>();
  const walk = (nodes: UnitNode[], prefix: string) =>
    nodes.forEach((node, index) => {
      const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      numbers.set(node.id, number);
      walk(node.children, number);
    });
  walk(toTree(components), "");
  return numbers;
}

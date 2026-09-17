// ══════════════════════════════════════════════════════════════
// TYPES D'ACTIVITÉ
// Source unique du libellé, de l'icône et de la couleur des cinq types.
// La couleur est un rôle du design system (--type-*), jamais une teinte
// en dur : elle a sa valeur claire et sa valeur sombre.
// ══════════════════════════════════════════════════════════════

import { Briefcase, FileText, Hammer, Lightbulb, Wrench, type LucideIcon } from "lucide-react";
import type { ActivityType } from "./structureOps";

export type { ActivityType };

export interface ActivityTypeInfo {
  label: string;
  /** Libellé court, pour une légende ou une colonne étroite. */
  court: string;
  icon: LucideIcon;
  /** Rôle de couleur, à utiliser tel quel : `style={{ color: info.couleur }}`. */
  couleur: string;
}

export const ACTIVITY_TYPES: Record<ActivityType, ActivityTypeInfo> = {
  travaux: { label: "Travaux", court: "Travaux", icon: Hammer, couleur: "var(--type-travaux)" },
  fourniture: { label: "Fourniture", court: "Fourniture", icon: Briefcase, couleur: "var(--type-fourniture)" },
  services: { label: "Services", court: "Services", icon: Wrench, couleur: "var(--type-services)" },
  etudes: { label: "Études", court: "Études", icon: FileText, couleur: "var(--type-etudes)" },
  pi: { label: "Prestations intellectuelles", court: "Prestations intell.", icon: Lightbulb, couleur: "var(--type-pi)" },
};

export const ACTIVITY_TYPE_ORDER: ActivityType[] = ["travaux", "fourniture", "services", "etudes", "pi"];

export const estTypeActivite = (valeur: unknown): valeur is ActivityType =>
  typeof valeur === "string" && valeur in ACTIVITY_TYPES;

/** Type d'activité connu, ou « Travaux » par défaut. */
export const typeActivite = (valeur: unknown): ActivityTypeInfo =>
  ACTIVITY_TYPES[estTypeActivite(valeur) ? valeur : "travaux"];

/**
 * Fond discret dérivé d'une couleur de rôle : le même voile que la maquette
 * pose derrière une icône ou une pastille.
 */
export const voile = (couleur: string, pourcentage = 12) =>
  `color-mix(in srgb, ${couleur} ${pourcentage}%, transparent)`;

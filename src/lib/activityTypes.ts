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
  /**
   * Mêmes couleurs en classes utilitaires, pour les appelants qui composent un
   * `className`. Écrites en toutes lettres : Tailwind lit le source, une classe
   * assemblée à l'exécution (`bg-type-${id}`) ne serait jamais générée.
   */
  /** Pastille pleine : `bg-type-*`. */
  pastille: string;
  /** Puce teintée : fond, texte et bordure du même rôle. */
  puce: string;
}

export const ACTIVITY_TYPES: Record<ActivityType, ActivityTypeInfo> = {
  travaux: { label: "Travaux", court: "Travaux", icon: Hammer, couleur: "var(--type-travaux)", pastille: "bg-type-travaux", puce: "bg-type-travaux/10 text-type-travaux border-type-travaux/20" },
  fourniture: { label: "Fourniture", court: "Fourniture", icon: Briefcase, couleur: "var(--type-fourniture)", pastille: "bg-type-fourniture", puce: "bg-type-fourniture/10 text-type-fourniture border-type-fourniture/20" },
  services: { label: "Services", court: "Services", icon: Wrench, couleur: "var(--type-services)", pastille: "bg-type-services", puce: "bg-type-services/10 text-type-services border-type-services/20" },
  etudes: { label: "Études", court: "Études", icon: FileText, couleur: "var(--type-etudes)", pastille: "bg-type-etudes", puce: "bg-type-etudes/10 text-type-etudes border-type-etudes/20" },
  pi: { label: "Prestations intellectuelles", court: "Prestations intell.", icon: Lightbulb, couleur: "var(--type-pi)", pastille: "bg-type-pi", puce: "bg-type-pi/10 text-type-pi border-type-pi/20" },
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

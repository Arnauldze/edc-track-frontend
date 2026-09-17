// ══════════════════════════════════════════════════════════════
// RBAC — Rôles et permissions (miroir d'affichage)
//
// Le serveur fait autorité : backend/src/common/constants/permissions.constant.ts.
// Pour décider d'afficher une action sur un projet, utiliser usePermissions,
// qui lit les permissions calculées par le serveur. Ce fichier fournit les
// libellés, couleurs et règles d'attribution nécessaires à l'interface.
//
//   admin                : tous les droits.
//   coordinateur_general : voit et consulte tout, partout, sans rien modifier.
//   coordinateur         : même supervision, sur les projets qu'il coordonne.
//   chef_projet          : gestion complète de ses projets.
//   contributeur         : dépôt et consultation là où il est invité.
// ══════════════════════════════════════════════════════════════

export type Permission =
  | "doc:view" | "doc:download" | "doc:upload" | "doc:edit" | "doc:delete"
  | "doc:validate" | "doc:reject" | "doc:unlock"
  | "team:view" | "team:add" | "team:remove" | "team:edit"
  | "structure:view" | "structure:edit"
  | "project:create" | "project:delete"
  | "planning:view" | "planning:edit"
  | "users:manage";

export type PlatformRole = "admin" | "user";

export type ProjectRole = "coordinateur_general" | "coordinateur" | "chef_projet" | "contributeur";

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  coordinateur_general: "Coordinateur Général",
  coordinateur: "Coordinateur",
  chef_projet: "Chef de Projet",
  contributeur: "Contributeur",
};

export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  coordinateur_general: "Supervise toute la plateforme : voit et consulte tous les projets, sans rien modifier.",
  coordinateur: "Supervise les projets qu'il coordonne : voit et consulte tout, sans rien modifier.",
  chef_projet: "Gère entièrement le projet : informations, structure, équipe, validation des documents, planification.",
  contributeur: "Dépose et consulte les documents du projet ; peut modifier ses propres dépôts.",
};

/**
 * Couleurs des rôles. Un rôle n'est pas un état : il ne se lit pas comme une
 * réussite ou une alerte, il doit seulement se distinguer des autres. D'où la
 * rampe catégorielle --cat-* pour la supervision, et les rôles opérationnels
 * sur les jetons déjà porteurs de sens dans l'application.
 *
 * Source unique : les avatars comme les badges partent d'ici. Les chaînes sont
 * écrites en toutes lettres car Tailwind lit le source ; une classe assemblée
 * à l'exécution (`bg-cat-${teinte}`) ne serait jamais générée.
 */
export interface RoleColors {
  /** Puce teintée : fond, texte et bordure du même rôle (badges). */
  bg: string;
  text: string;
  border: string;
  /** Anneau de sélection (cartes de choix de rôle). */
  ring: string;
  /**
   * Pastille pleine (avatars) : fond ET encre. En thème sombre les teintes
   * s'éclaircissent, du blanc par-dessus deviendrait illisible.
   */
  pastille: string;
}

export const PROJECT_ROLE_COLORS: Record<ProjectRole, RoleColors> = {
  coordinateur_general: { bg: "bg-cat-violet/10", text: "text-cat-violet", border: "border-cat-violet/20", ring: "ring-cat-violet/30", pastille: "bg-cat-violet text-on-cat" },
  coordinateur: { bg: "bg-cat-indigo/10", text: "text-cat-indigo", border: "border-cat-indigo/20", ring: "ring-cat-indigo/30", pastille: "bg-cat-indigo text-on-cat" },
  chef_projet: { bg: "bg-primary-subtle", text: "text-primary-fg", border: "border-primary/20", ring: "ring-primary/30", pastille: "bg-primary text-on-primary" },
  contributeur: { bg: "bg-warning-subtle", text: "text-warning", border: "border-warning/20", ring: "ring-warning/30", pastille: "bg-warning text-on-warning" },
};

/** Repli pour un rôle inconnu ou une simple consultation : neutre, sans teinte. */
export const ROLE_COLORS_FALLBACK: RoleColors = {
  bg: "bg-inset",
  text: "text-fg-muted",
  border: "border-line",
  ring: "ring-line",
  pastille: "bg-fg-muted text-fg-inverted",
};

/** Pastille pleine d'un rôle, repli neutre compris. */
export function rolePastille(role: string): string {
  return PROJECT_ROLE_COLORS[role as ProjectRole]?.pastille ?? ROLE_COLORS_FALLBACK.pastille;
}

/** Classes d'une puce teintée (fond + texte + bordure), repli neutre compris. */
export function rolePuce(role: string): string {
  const c = PROJECT_ROLE_COLORS[role as ProjectRole] ?? ROLE_COLORS_FALLBACK;
  return `${c.bg} ${c.text} ${c.border}`;
}

export const ALL_PROJECT_ROLES: ProjectRole[] = [
  "coordinateur_general",
  "coordinateur",
  "chef_projet",
  "contributeur",
];

/** Rôles de supervision : consultation sans modification. */
export const SUPERVISION_ROLES: ProjectRole[] = ["coordinateur_general", "coordinateur"];

/**
 * Rôles qu'un non-admin peut attribuer selon son rôle sur le projet — identique
 * au serveur (GRANTABLE_ROLES). Chef et rôles de supervision relèvent de l'admin.
 */
const GRANTABLE_ROLES: Partial<Record<ProjectRole, ProjectRole[]>> = {
  chef_projet: ["contributeur"],
};

export function getGrantableRoles(isAdmin: boolean, heldRoles: string[]): ProjectRole[] {
  if (isAdmin) return ALL_PROJECT_ROLES;
  const grantable = new Set(heldRoles.flatMap((role) => GRANTABLE_ROLES[role as ProjectRole] ?? []));
  return ALL_PROJECT_ROLES.filter((role) => grantable.has(role));
}

export function isProjectRole(role: string): role is ProjectRole {
  return (ALL_PROJECT_ROLES as string[]).includes(role);
}

/** Actions sensibles demandant une confirmation renforcée. */
export function requiresSecurityPassword(permission: Permission): boolean {
  return (["team:remove", "doc:delete", "doc:unlock"] as Permission[]).includes(permission);
}

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

export const PROJECT_ROLE_COLORS: Record<ProjectRole, { bg: string; text: string; border: string }> = {
  coordinateur_general: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" },
  coordinateur: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/20" },
  chef_projet: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
  contributeur: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
};

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

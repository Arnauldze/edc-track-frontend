// ══════════════════════════════════════
// RBAC STORE — Role-Based Access Control
// Moteur de permissions pour EDC Track
// Hiérarchie : View < Contributeur < Chef Projet < Coordinateur < Coordinateur Général
// ══════════════════════════════════════

// ── Types de permissions ──

export type Permission =
  | "doc:view" | "doc:download" | "doc:upload" | "doc:edit" | "doc:delete"
  | "doc:validate" | "doc:reject" | "doc:unlock"
  | "team:view" | "team:add" | "team:remove" | "team:edit"
  | "structure:view" | "structure:edit"
  | "project:create" | "project:delete"
  | "planning:view" | "planning:edit"
  | "users:manage";

// ── Rôle plateforme ──
export type PlatformRole = "admin" | "user";

// ── Rôle projet ──
export type ProjectRole = "coordinateur_general" | "coordinateur" | "chef_projet" | "contributeur" | "view";

// Labels d'affichage
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  coordinateur_general: "Coordinateur Général",
  coordinateur: "Coordinateur",
  chef_projet: "Chef de Projet",
  contributeur: "Contributeur",
  view: "Lecture seule",
};

// Descriptions des rôles (pour tooltips)
export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  coordinateur_general: "Supervise tous les projets. Accès complet à l'ensemble de la plateforme, juste en dessous de l'administrateur.",
  coordinateur: "Supervise un ou plusieurs projets. Mêmes droits que le chef de projet sur les projets qu'il coordonne.",
  chef_projet: "Accès complet au projet : modifier, gérer l'équipe, valider/rejeter, planifier.",
  contributeur: "Peut charger, télécharger et modifier ses propres uploads. Ne peut pas gérer l'équipe ni modifier le projet.",
  view: "Lecture seule : peut uniquement consulter et prévisualiser les documents. Aucun téléchargement ni modification.",
};

export const PROJECT_ROLE_COLORS: Record<ProjectRole, { bg: string; text: string; border: string }> = {
  coordinateur_general: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" },
  coordinateur: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/20" },
  chef_projet: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
  contributeur: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
  view: { bg: "bg-gray-500/10", text: "text-gray-600", border: "border-gray-500/20" },
};

export const ALL_PROJECT_ROLES: ProjectRole[] = [
  "coordinateur_general",
  "coordinateur",
  "chef_projet",
  "contributeur",
  "view",
];

// ── Matrice de permissions par rôle projet ──

const PROJECT_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  coordinateur_general: [
    "doc:view", "doc:download", "doc:upload", "doc:edit", "doc:delete",
    "doc:validate", "doc:reject",
    "team:view", "team:add", "team:remove", "team:edit",
    "structure:view", "structure:edit",
    "planning:view", "planning:edit",
  ],
  coordinateur: [
    "doc:view", "doc:download", "doc:upload", "doc:edit", "doc:delete",
    "doc:validate", "doc:reject",
    "team:view", "team:add", "team:remove", "team:edit",
    "structure:view", "structure:edit",
    "planning:view", "planning:edit",
  ],
  chef_projet: [
    "doc:view", "doc:download", "doc:upload", "doc:edit", "doc:delete",
    "doc:validate", "doc:reject",
    "team:view", "team:add", "team:remove", "team:edit",
    "structure:view", "structure:edit",
    "planning:view", "planning:edit",
  ],
  contributeur: [
    "doc:view", "doc:download", "doc:upload", "doc:edit", // Modifier ses propres uploads (avec traçabilité)
    "team:view",
    "structure:view",
    "planning:view",
  ],
  view: [
    "doc:view", // Lecture seule — pas de téléchargement
    "team:view",
    "structure:view",
    "planning:view",
  ],
};

// Admin a toutes les permissions + les exclusives
const ADMIN_ONLY_PERMISSIONS: Permission[] = [
  "doc:unlock",
  "project:create", "project:delete",
  "users:manage",
];

const ALL_PERMISSIONS: Permission[] = [
  ...PROJECT_PERMISSIONS.coordinateur_general,
  ...ADMIN_ONLY_PERMISSIONS,
];

// ── Fonctions de vérification ──

/**
 * Vérifie si un utilisateur a une permission sur un projet donné.
 * L'admin plateforme a toutes les permissions sur tous les projets.
 */
export function hasPermission(
  platformRole: PlatformRole,
  projectRole: ProjectRole | null,
  permission: Permission,
): boolean {
  // Admin plateforme → tout autorisé
  if (platformRole === "admin") {
    return ALL_PERMISSIONS.includes(permission);
  }

  // Si pas de rôle projet → seules les permissions basiques
  if (!projectRole) {
    return false;
  }

  // Permissions admin-only → refusé pour tout le monde sauf admin
  if (ADMIN_ONLY_PERMISSIONS.includes(permission)) {
    return false;
  }

  // Vérifier dans la matrice
  return PROJECT_PERMISSIONS[projectRole]?.includes(permission) ?? false;
}

/**
 * Retourne toutes les permissions d'un utilisateur pour un projet.
 */
export function getPermissions(
  platformRole: PlatformRole,
  projectRole: ProjectRole | null,
): Permission[] {
  if (platformRole === "admin") {
    return [...ALL_PERMISSIONS];
  }
  if (!projectRole) return [];
  return [...(PROJECT_PERMISSIONS[projectRole] || [])];
}

/**
 * Vérifie si une action nécessite une confirmation par mot de passe sécurité.
 */
export function requiresSecurityPassword(permission: Permission): boolean {
  const SENSITIVE_ACTIONS: Permission[] = [
    "team:remove",
    "doc:delete",
    "doc:unlock",
  ];
  return SENSITIVE_ACTIONS.includes(permission);
}

/**
 * Vérifie si une action doit générer un log d'audit.
 */
export function requiresAuditLog(permission: Permission): boolean {
  const AUDITABLE_ACTIONS: Permission[] = [
    "doc:upload", "doc:edit", "doc:delete",
    "doc:validate", "doc:reject", "doc:unlock",
    "team:add", "team:remove", "team:edit",
    "structure:edit",
    "planning:edit",
    "project:create", "project:delete",
  ];
  return AUDITABLE_ACTIONS.includes(permission);
}

/**
 * Vérifie si un rôle projet est supérieur ou égal à un autre.
 * Utile pour déterminer si un utilisateur peut assigner un rôle.
 */
export function isRoleHigherOrEqual(role: ProjectRole, thanRole: ProjectRole): boolean {
  const ROLE_HIERARCHY: Record<ProjectRole, number> = {
    view: 0,
    contributeur: 1,
    chef_projet: 2,
    coordinateur: 3,
    coordinateur_general: 4,
  };
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[thanRole];
}


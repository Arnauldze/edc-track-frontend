"use client";

// ══════════════════════════════════════
// PermissionGate — Composant de contrôle d'accès
// Affiche ou masque du contenu selon les permissions RBAC
// ══════════════════════════════════════

import React from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/rbacStore";

type PermissionGateProps = {
  /** ID du projet pour vérifier les permissions projet */
  projectId?: string;
  /** Permission requise pour afficher le contenu */
  permission: Permission;
  /** Contenu affiché si la permission est refusée (optionnel) */
  fallback?: React.ReactNode;
  /** Contenu à afficher si la permission est accordée */
  children: React.ReactNode;
};

/**
 * Composant qui conditionne l'affichage selon les permissions RBAC.
 * 
 * @example
 * <PermissionGate projectId="PRJ-001" permission="doc:upload">
 *   <button>Charger un fichier</button>
 * </PermissionGate>
 * 
 * @example
 * <PermissionGate 
 *   projectId="PRJ-001" 
 *   permission="doc:delete"
 *   fallback={<span className="text-gray-400">Non autorisé</span>}
 * >
 *   <button>Supprimer</button>
 * </PermissionGate>
 */
export function PermissionGate({
  projectId,
  permission,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can } = usePermissions(projectId);

  if (!can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ── Variante: AdminOnly ──

type AdminOnlyProps = {
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Affiche le contenu uniquement pour les administrateurs plateforme.
 */
export function AdminOnly({ fallback = null, children }: AdminOnlyProps) {
  const { isAdmin } = usePermissions();
  if (!isAdmin) return <>{fallback}</>;
  return <>{children}</>;
}

// ── Variante: ProjectRoleGate ──

type ProjectRoleGateProps = {
  projectId: string;
  /** Rôles autorisés (au moins un doit correspondre) */
  roles: Array<"coordinateur_general" | "coordinateur" | "chef_projet" | "contributeur" | "view">;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Affiche le contenu si l'utilisateur a l'un des rôles spécifiés sur le projet.
 * Les admin plateforme passent toujours.
 */
export function ProjectRoleGate({
  projectId,
  roles,
  fallback = null,
  children,
}: ProjectRoleGateProps) {
  const { isAdmin, projectRole } = usePermissions(projectId);
  
  if (isAdmin) return <>{children}</>;
  if (!projectRole || !roles.includes(projectRole)) return <>{fallback}</>;
  return <>{children}</>;
}

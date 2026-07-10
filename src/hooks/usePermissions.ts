"use client";

// ══════════════════════════════════════
// usePermissions — Hook RBAC pour React
// Vérifie les permissions de l'utilisateur connecté
// ══════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react";
import { getCurrentSession, type AuthSession } from "@/lib/authStore";
import { getUserProjectRole, getUserById, type User } from "@/lib/userStore";
import { hasPermission, getPermissions, type Permission, type PlatformRole, type ProjectRole } from "@/lib/rbacStore";

export type UsePermissionsReturn = {
  /** L'utilisateur connecté */
  user: User | null;
  /** La session courante */
  session: AuthSession | null;
  /** Le rôle plateforme */
  platformRole: PlatformRole | null;
  /** Le rôle projet (null si pas affecté) */
  projectRole: ProjectRole | null;
  /** Vérifier une permission */
  can: (permission: Permission) => boolean;
  /** Toutes les permissions de l'utilisateur */
  permissions: Permission[];
  /** Est-ce un admin plateforme ? */
  isAdmin: boolean;
  /** Est-ce un coordinateur général ? */
  isCoordinateurGeneral: boolean;
  /** Est-ce un coordinateur ? */
  isCoordinateur: boolean;
  /** Est-ce un chef de projet (ou rôle supérieur) ? */
  isChefProjet: boolean;
  /** Est-ce un contributeur ? */
  isContributeur: boolean;
  /** Est-ce un view ? */
  isView: boolean;
  /** Est-ce que l'utilisateur est connecté ? */
  isAuthenticated: boolean;
};

/**
 * Hook principal pour vérifier les permissions RBAC.
 * @param projectId - ID du projet (optionnel, pour vérifier les permissions projet)
 */
export function usePermissions(projectId?: string): UsePermissionsReturn {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);

  useEffect(() => {
    // Charger la session initiale
    setSession(getCurrentSession());

    // Écouter les changements de session
    const handleAuthChange = () => setSession(getCurrentSession());
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  useEffect(() => {
    async function loadUser() {
      if (!session) {
        setUser(null);
        return;
      }
      const u = await getUserById(session.userId);
      setUser(u ?? null);
    }
    loadUser();
  }, [session]);

  useEffect(() => {
    async function loadProjectRole() {
      if (!session || !projectId) {
        setProjectRole(null);
        return;
      }
      if (session.platformRole === "admin") {
        setProjectRole("coordinateur_general" as ProjectRole);
        return;
      }
      const role = await getUserProjectRole(session.userId, projectId);
      setProjectRole(role);
    }
    loadProjectRole();
  }, [session, projectId]);

  const platformRole = session?.platformRole ?? null;

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!platformRole) return false;
      return hasPermission(platformRole, projectRole, permission);
    },
    [platformRole, projectRole],
  );

  const permissions = useMemo(
    () => (platformRole ? getPermissions(platformRole, projectRole) : []),
    [platformRole, projectRole],
  );

  const HIGHER_ROLES: ProjectRole[] = ["coordinateur_general", "coordinateur", "chef_projet"];

  return {
    user,
    session,
    platformRole,
    projectRole,
    can,
    permissions,
    isAdmin: platformRole === "admin",
    isCoordinateurGeneral: projectRole === "coordinateur_general" || platformRole === "admin",
    isCoordinateur: projectRole === "coordinateur" || projectRole === "coordinateur_general" || platformRole === "admin",
    isChefProjet: (projectRole !== null && HIGHER_ROLES.includes(projectRole)) || platformRole === "admin",
    isContributeur: projectRole === "contributeur",
    isView: projectRole === "view",
    isAuthenticated: session !== null,
  };
}

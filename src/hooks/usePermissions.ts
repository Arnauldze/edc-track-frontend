"use client";

// ══════════════════════════════════════
// usePermissions — permissions de l'utilisateur connecté
//
// Sur un projet, les permissions viennent du serveur
// (GET /projects/:code/permissions) : il cumule tous les rôles détenus et
// applique la même matrice qu'aux requêtes. Le front ne recalcule rien.
// Tant que la réponse n'est pas arrivée, `can` renvoie false : une action
// n'apparaît qu'une fois confirmée.
// ══════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { getCurrentSession, type AuthSession } from "@/lib/authStore";
import { projectService } from "@/services/api/projectService";
import { SUPERVISION_ROLES, type Permission, type PlatformRole, type ProjectRole } from "@/lib/rbacStore";

export type UsePermissionsReturn = {
  session: AuthSession | null;
  platformRole: PlatformRole | null;
  /** Rôles détenus sur le projet (vide hors projet ou si non membre). */
  roles: ProjectRole[];
  can: (permission: Permission) => boolean;
  permissions: Permission[];
  isAdmin: boolean;
  /** Peut gérer le projet : chef de projet ou admin. */
  isChefProjet: boolean;
  /** Supervise le projet sans en être chef : consultation seule. */
  isSupervisor: boolean;
  /** Le projet fait partie de son espace Initialisation. */
  canAccessInitialisation: boolean;
  loading: boolean;
  isAuthenticated: boolean;
};

export function usePermissions(projectId?: string): UsePermissionsReturn {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [canAccessInitialisation, setCanAccessInitialisation] = useState(false);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    setSession(getCurrentSession());
    const handleAuthChange = () => setSession(getCurrentSession());
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  useEffect(() => {
    // Hors projet, rien à charger : `loading` est initialisé à false dans ce cas.
    if (!projectId) return;

    let cancelled = false;
    setLoading(true);
    projectService
      .getMyPermissions(projectId)
      .then((result) => {
        if (cancelled) return;
        setRoles(result.roles as ProjectRole[]);
        setPermissions(result.permissions as Permission[]);
        setCanAccessInitialisation(result.canAccessInitialisation);
      })
      .catch((error) => {
        console.error("Impossible de charger les permissions du projet:", error);
        if (cancelled) return;
        setRoles([]);
        setPermissions([]);
        setCanAccessInitialisation(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const platformRole = session?.platformRole ?? null;
  const isAdmin = platformRole === "admin";

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  const isChefProjet = isAdmin || roles.includes("chef_projet");

  return {
    session,
    platformRole,
    roles,
    can,
    permissions,
    isAdmin,
    isChefProjet,
    isSupervisor: !isChefProjet && roles.some((role) => SUPERVISION_ROLES.includes(role)),
    canAccessInitialisation,
    loading,
    isAuthenticated: session !== null,
  };
}

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
  /** Emplacements où déposer (paths null = tout le projet). */
  uploadScope: { paths: string[] | null; labels: string[] };
  /** Le dépôt est-il permis à cet emplacement (`global`, `c1`, `c1/sc1`…) ? */
  canUploadIn: (context: string) => boolean;
  loading: boolean;
  isAuthenticated: boolean;
};

export function usePermissions(projectId?: string): UsePermissionsReturn {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [canAccessInitialisation, setCanAccessInitialisation] = useState(false);
  const [uploadScope, setUploadScope] = useState<{ paths: string[] | null; labels: string[] }>({ paths: [], labels: [] });
  // Projet dont les permissions sont chargées : le chargement se déduit de l'écart.
  const [loadedProjectId, setLoadedProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSession(getCurrentSession());
    const handleAuthChange = () => setSession(getCurrentSession());
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    projectService
      .getMyPermissions(projectId)
      .then((result) => {
        if (cancelled) return;
        setRoles(result.roles as ProjectRole[]);
        setPermissions(result.permissions as Permission[]);
        setCanAccessInitialisation(result.canAccessInitialisation);
        setUploadScope(result.uploadScope ?? { paths: [], labels: [] });
      })
      .catch((error) => {
        console.error("Impossible de charger les permissions du projet:", error);
        if (cancelled) return;
        setRoles([]);
        setPermissions([]);
        setCanAccessInitialisation(false);
        setUploadScope({ paths: [], labels: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadedProjectId(projectId);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const platformRole = session?.platformRole ?? null;
  const isAdmin = platformRole === "admin";

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  const isChefProjet = isAdmin || roles.includes("chef_projet");

  // Même règle que le serveur : l'emplacement ou l'un de ses descendants.
  const canUploadIn = useCallback(
    (context: string) =>
      permissions.includes("doc:upload") &&
      (uploadScope.paths === null ||
        uploadScope.paths.some((path) => context === path || context.startsWith(`${path}/`))),
    [permissions, uploadScope],
  );

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
    uploadScope,
    canUploadIn,
    loading: Boolean(projectId) && loadedProjectId !== projectId,
    isAuthenticated: session !== null,
  };
}

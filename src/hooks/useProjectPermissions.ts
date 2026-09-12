"use client";

import { useCallback, useEffect, useState } from "react";
import { projectService } from "@/services/api/projectService";
import type { Permission } from "@/lib/rbacStore";

/**
 * Permissions de l'utilisateur courant sur un projet, telles que le serveur
 * les applique. À préférer à usePermissions pour conditionner une action :
 * le calcul local retient la première affectation trouvée, là où le serveur
 * retient la plus élevée — les deux peuvent diverger.
 *
 * Tant que la réponse n'est pas arrivée, `can` renvoie false : une action
 * n'apparaît qu'une fois confirmée par le serveur.
 */
export function useProjectPermissions(projectCode: string | undefined) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectCode) return;

    let cancelled = false;
    projectService
      .getMyPermissions(projectCode)
      .then((result) => {
        if (!cancelled) setPermissions(new Set(result.permissions));
      })
      .catch((error) => {
        console.error("Impossible de charger les permissions du projet:", error);
        if (!cancelled) setPermissions(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectCode]);

  const can = useCallback((permission: Permission) => permissions.has(permission), [permissions]);

  return { can, loading };
}

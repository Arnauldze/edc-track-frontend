"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { planningService, type Planning } from "@/services/api/planningService";

// ══════════════════════════════════════════════════════════════
// PLANIFICATIONS D'UN PROJET
// Une requête par projet, mise en cache : les écrans qui les partagent
// (tableau de bord, liste des projets) ne rechargent rien.
// ══════════════════════════════════════════════════════════════

const CACHE = 3 * 60 * 1000;

export function useProjectPlannings(projectCode: string) {
  return useQuery({
    queryKey: ["plannings", projectCode],
    queryFn: () => planningService.getByProject(projectCode),
    enabled: !!projectCode,
    staleTime: CACHE,
  });
}

/** Planifications de plusieurs projets, par code de projet. */
export function usePlanningsByProject(projectCodes: string[]) {
  const results = useQueries({
    queries: projectCodes.map((code) => ({
      queryKey: ["plannings", code],
      queryFn: () => planningService.getByProject(code),
      staleTime: CACHE,
    })),
    combine: (queries) => ({
      data: new Map<string, Planning[]>(projectCodes.map((code, index) => [code, queries[index]?.data ?? []])),
      isLoading: queries.some((query) => query.isLoading),
      isError: queries.some((query) => query.isError),
    }),
  });
  return results;
}

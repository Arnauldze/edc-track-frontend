"use client";

import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/api/authService";

/**
 * Profil et capacités de l'utilisateur connecté, relus sur le serveur
 * (GET /auth/me). Mis en cache : la sidebar persiste d'une page à l'autre,
 * un seul appel suffit pour la navigation courante.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authService.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

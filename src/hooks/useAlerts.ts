import { useQuery } from "@tanstack/react-query";
import { alertService } from "@/services/api";

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertService.getAll(),
    staleTime: 1 * 60 * 1000, // 1 minute (plus frais pour les alertes)
  });
}

export function useAlertsCount() {
  return useQuery({
    queryKey: ["alerts", "count"],
    queryFn: () => alertService.getCount(),
    staleTime: 30 * 1000, // 30 secondes
    refetchInterval: 60 * 1000, // Refetch toutes les minutes
  });
}

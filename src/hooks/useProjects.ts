import { useQuery } from "@tanstack/react-query";
import { projectService } from "@/services/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => projectService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProjectStats() {
  return useQuery({
    queryKey: ["projects", "stats"],
    queryFn: () => projectService.getStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useProject(code: string) {
  return useQuery({
    queryKey: ["projects", code],
    queryFn: () => projectService.getByCode(code),
    enabled: !!code,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

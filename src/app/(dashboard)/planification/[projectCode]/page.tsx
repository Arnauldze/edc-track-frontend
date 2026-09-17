"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getProjectById, countLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type Planning } from "@/services/api/planningService";
import { MSProjectViewV2 } from "@/components/planning/MSProjectViewV2";
import { usePermissions } from "@/hooks/usePermissions";
import { Spinner } from "@/components/ui/LoadingSpinner";

export default function ProjectPlanningPage() {
  const params = useParams();
  const router = useRouter();
  const projectCode = typeof params.projectCode === "string" ? params.projectCode : "";

  const [project, setProject] = useState<Project | null>(null);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const focusedActivity = searchParams.get('activity') || undefined;
  const refreshToken = searchParams.get('t') || '';
  const { can } = usePermissions(projectCode);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);

  // Recharger quand le refreshToken change (après création/modification d'une planification)
  useEffect(() => {
    if (refreshToken) loadData({ silencieux: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  /**
   * Charge le projet et ses planifications. En mode silencieux (après une
   * modification dans le tableau), la page reste affichée pendant le rechargement.
   */
  async function loadData({ silencieux = false } = {}) {
    if (!silencieux) setLoading(true);
    try {
      const proj = await getProjectById(projectCode);
      if (!proj) return;
      setProject(proj);
      try {
        setPlannings(await planningService.getByProject(projectCode));
      } catch (error) {
        console.error("Erreur chargement planifications:", error);
        setPlannings([]);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Structure enregistrée depuis le tableau : le serveur a pu transférer des
   * planifications. On recharge sans repasser par l'écran de chargement.
   */
  async function handleStructureSaved(saved: Project) {
    setProject(saved);
    try {
      const plans = await planningService.getByProject(projectCode);
      setPlannings(Array.isArray(plans) ? plans : []);
    } catch (error) {
      console.error("Erreur chargement planifications:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-6 text-primary-fg" />
          <p className="text-sm text-fg-muted">Chargement du projet…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-fg-muted">Projet introuvable</p>
        <Link href="/planification" className="mt-2 inline-block text-sm font-semibold text-primary-fg hover:underline">
          Retour à la planification
        </Link>
      </div>
    );
  }

  const totalActivities = countLeafActivities(project);
  const plannedActivities = plannings.length;

  return (
    <div className="flex h-full flex-col">
      {/* ── En-tête, barre d'outils, tableau et Gantt : maquette « Planification » ── */}
      <div className="flex-1 overflow-hidden">
        <MSProjectViewV2
          project={project}
          plannings={plannings}
          onActivityClick={(activityPath) => router.push(`/planification/${projectCode}/${activityPath}`)}
          onRefresh={() => loadData({ silencieux: true })}
          focusedActivityPath={focusedActivity}
          canEditStructure={can("structure:edit")}
          onStructureSaved={handleStructureSaved}
          entete={{ titre: project.name, code: project.code, planifiees: plannedActivities, total: totalActivities }}
        />
      </div>
    </div>
  );
}

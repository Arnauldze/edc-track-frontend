"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, ChevronLeft } from "lucide-react";
import { getProjectById, countLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type Planning } from "@/services/api/planningService";
import { MSProjectViewV2 } from "@/components/planning/MSProjectViewV2";
import { usePermissions } from "@/hooks/usePermissions";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_ORDER, voile } from "@/lib/activityTypes";
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
  const progressPct = totalActivities > 0 ? Math.round((plannedActivities / totalActivities) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* ── En-tête du projet ── */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-line bg-surface px-8 pt-3.5 pb-3">
        <Link
          href="/planification"
          className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-fg-muted transition-colors hover:text-primary-fg"
        >
          <ChevronLeft size={14} /> Tous les projets
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-primary-fg"
              style={{ background: voile("var(--primary)") }}
            >
              <Calendar size={20} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.75">
              <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-fg">
                <span className="truncate">{project.name}</span>
                <span className="rounded border border-line bg-inset px-1.5 py-px font-mono text-[11px] font-medium text-fg-muted">
                  {project.code}
                </span>
              </h1>
              <p className="text-[12.5px] text-fg-muted">Planification des activités</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="text-right">
              <div className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">Activités planifiées</div>
              <div className="text-[18px] font-bold text-fg">
                {plannedActivities} <span className="text-fg-muted">/ {totalActivities}</span>
              </div>
            </div>
            <div className="relative size-14" title={`${progressPct} % des activités sont planifiées`}>
              <svg className="size-full -rotate-90" viewBox="0 0 56 56" aria-hidden>
                <circle cx="28" cy="28" r="24" stroke="var(--bg-inset)" strokeWidth="6" fill="none" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="var(--primary)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(progressPct / 100) * 150.8} 150.8`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-fg">{progressPct} %</div>
            </div>
          </div>
        </div>

        {/* Légende des types d'activité, reprise par les barres du Gantt */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-fg-muted">
          <span className="text-fg-subtle">Types d&apos;activité :</span>
          {ACTIVITY_TYPE_ORDER.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-inset px-2.5 py-0.5">
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: ACTIVITY_TYPES[id].couleur }} />
              {ACTIVITY_TYPES[id].court}
            </span>
          ))}
        </div>
      </div>

      {/* ── Tableau et Gantt, côte à côte et plein écran ── */}
      <div className="flex-1 overflow-hidden">
        <MSProjectViewV2
          project={project}
          plannings={plannings}
          onActivityClick={(activityPath) => router.push(`/planification/${projectCode}/${activityPath}`)}
          onRefresh={() => loadData({ silencieux: true })}
          focusedActivityPath={focusedActivity}
          canEditStructure={can("structure:edit")}
          onStructureSaved={handleStructureSaved}
        />
      </div>
    </div>
  );
}

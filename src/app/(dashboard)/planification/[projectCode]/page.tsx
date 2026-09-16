"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, Calendar, ChevronLeft, Layers } from "lucide-react";
import { getProjectById, countLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type Planning } from "@/services/api/planningService";
import { MSProjectViewV2 } from "@/components/planning/MSProjectViewV2";
import { usePermissions } from "@/hooks/usePermissions";

// Types d'activités avec couleurs
const ACTIVITY_TYPES = [
  { id: "travaux", label: "Travaux", color: "bg-blue-500", textColor: "text-blue-600" },
  { id: "fourniture", label: "Fourniture", color: "bg-amber-500", textColor: "text-amber-600" },
  { id: "services", label: "Services", color: "bg-green-500", textColor: "text-green-600" },
  { id: "etudes", label: "Études", color: "bg-purple-500", textColor: "text-purple-600" },
  { id: "pi", label: "Prestations Intellectuelles", color: "bg-rose-500", textColor: "text-rose-600" },
];

export default function ProjectPlanningPage() {
  const params = useParams();
  const router = useRouter();
  const projectCode = typeof params.projectCode === "string" ? params.projectCode : "";

  const [project, setProject] = useState<Project | null>(null);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "gantt">("table");
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Projet introuvable</p>
        <Link href="/planification" className="text-[var(--primary-text)] text-sm mt-2 inline-block">
          Retour
        </Link>
      </div>
    );
  }

  const totalActivities = countLeafActivities(project);
  const plannedActivities = plannings.length;
  const progressPct = totalActivities > 0 ? Math.round((plannedActivities / totalActivities) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/planification"
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--primary-text)] transition-colors"
          >
            <ChevronLeft size={14} /> Tous les projets
          </Link>
        </div>

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                {project.name}
                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">
                  {project.code}
                </span>
              </h1>
              <div className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5">
                Planification des activités
              </div>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
                Activités planifiées
              </div>
              <div className="text-[18px] font-bold text-[var(--text-primary)]">
                {plannedActivities} / {totalActivities}
              </div>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="var(--bg-inset)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="var(--primary)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(progressPct / 100) * 176} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-[var(--text-primary)]">
                {progressPct}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              viewMode === "table"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
            }`}
          >
            <Layers size={12} className="inline mr-1.5" />
            Tableau
          </button>
          <button
            onClick={() => setViewMode("gantt")}
            className={`px-3 py-1.5 rounded-[var(--radius-md)] text-[11px] font-semibold transition-colors ${
              viewMode === "gantt"
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
            }`}
          >
            <BarChart3 size={12} className="inline mr-1.5" />
            Gantt
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-semibold">
          <span>Légende :</span>
          {ACTIVITY_TYPES.map((type) => (
            <span
              key={type.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-inset)]"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${type.color}`} />
              {type.label}
            </span>
          ))}
        </div>
      </div>

      {/* CONTENT - Plein écran sans padding */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "table" ? (
          <MSProjectViewV2
            project={project}
            plannings={plannings}
            onActivityClick={(activityPath) => router.push(`/planification/${projectCode}/${activityPath}`)}
            onRefresh={() => loadData({ silencieux: true })}
            focusedActivityPath={focusedActivity}
            canEditStructure={can("structure:edit")}
            onStructureSaved={handleStructureSaved}
          />
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] p-8 text-center m-8">
            <BarChart3 size={48} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-30" />
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              Vue Gantt en cours de développement
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Cette fonctionnalité sera disponible prochainement
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

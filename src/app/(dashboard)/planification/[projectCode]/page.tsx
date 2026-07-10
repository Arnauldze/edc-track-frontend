"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  DollarSign,
  User,
  Clock,
  Plus,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { getProjectById, getLeafActivities, countLeafActivities, type Project, type Component, type SousComposant } from "@/lib/projectStore";
import { planningService, type Planning } from "@/services/api/planningService";
import { MSProjectViewV2 } from "@/components/planning/MSProjectViewV2";

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
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [expandedSousComposants, setExpandedSousComposants] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "gantt">("table");
  const searchParams = useSearchParams();
  const focusedActivity = searchParams.get('activity') || undefined;
  const refreshToken = searchParams.get('t') || '';

  useEffect(() => {
    loadData();
  }, [projectCode]);

  // Recharger quand le refreshToken change (après création/modification d'une planification)
  useEffect(() => {
    if (refreshToken) {
      console.log("🔄 Rechargement après sauvegarde, activité ciblée:", focusedActivity);
      loadData();
    }
  }, [refreshToken]);

  async function loadData() {
    setLoading(true);
    try {
      const proj = await getProjectById(projectCode);
      if (proj) {
        setProject(proj);
        
        // 🎨 DONNÉES MOCK HARDCODÉES pour DEMO-2026
        if (projectCode === 'DEMO-2026') {
          // Utiliser getLeafActivities pour générer les mocks à TOUS les niveaux
          const leafActivities = getLeafActivities(proj);
          const mockPlannings: Planning[] = [];
          const RESPONSABLES = [
            'Dr. Amina Ndiaye', 'Ing. Jean-Paul Mbarga', 'Arch. Sophie Kamdem',
            'Tech. Ibrahim Sow', 'Dr. Marie Fotso', 'Ing. Fatou Diop', 'Arch. Moussa Kane',
          ];
          
          leafActivities.forEach((leaf, planningIndex) => {
            const startDate = new Date(2024, planningIndex % 12, 1);
            const endDate = new Date(2024 + Math.floor((planningIndex + 6) / 12), (planningIndex + 6) % 12, 28);
            const responsable = RESPONSABLES[planningIndex % RESPONSABLES.length];
            
            const mockPlanning: Planning = {
              _id: `mock-${leaf.path}`,
              projectCode: 'DEMO-2026',
              activityPath: leaf.path,
              activityName: leaf.name,
              activityType: leaf.type as any,
              hasEtudePrealable: leaf.type === 'etudes',
              hasPassation: leaf.type === 'travaux' || leaf.type === 'fourniture',
              hasExecution: leaf.type !== 'etudes',
              budgetInitial: [{ devise: 'FCFA', montant: 150000000 + (planningIndex * 30000000), pourcentage: 100 }],
              budgetInitialTotal: 150000000 + (planningIndex * 30000000),
              budgetActualise: [{ devise: 'FCFA', montant: 150000000 + (planningIndex * 30000000), pourcentage: 100 }],
              budgetActualiseTotal: 150000000 + (planningIndex * 30000000),
              dateDebutInitiale: startDate,
              dateFinInitiale: endDate,
              delaiInitialMois: 6,
              dateDebutActualisee: startDate,
              dateFinActualisee: endDate,
              delaiActualiseMois: 6,
              responsablePrincipal: responsable,
              responsablesSecondaires: [],
              livrables: leaf.type === 'etudes' ? [
                { numero: 'R1', intitule: 'Rapport de démarrage', ponderation: 15, delaiMois: 1, statut: 'valide' },
                { numero: 'R2', intitule: 'Rapport intermédiaire', ponderation: 35, delaiMois: 3, statut: 'soumis' },
                { numero: 'R3', intitule: 'Rapport final', ponderation: 50, delaiMois: 6, statut: 'en_attente' },
              ] : [],
              etapesPassation: (leaf.type === 'travaux' || leaf.type === 'fourniture') ? [
                { ordre: 1, nom: 'Rédaction DAO', delaiJours: 20, statut: 'termine' },
                { ordre: 2, nom: 'Publication avis', delaiJours: 30, statut: 'en_cours' },
                { ordre: 3, nom: 'Réception offres', delaiJours: 7, statut: 'non_demarre' },
              ] : [],
              tachesExecution: leaf.type !== 'etudes' ? [
                {
                  numero: 'T1', designation: `Phase 1 - ${leaf.name}`,
                  unite: leaf.type === 'services' ? 'j' : (leaf.type === 'fourniture' ? 'u' : 'ens'),
                  quantite: leaf.type === 'services' ? 10 : (leaf.type === 'fourniture' ? 40 : 1),
                  prixUnitaire: leaf.type === 'services' ? 450000 : (leaf.type === 'fourniture' ? 2500000 : 12000000),
                  dateDebut: startDate,
                  dateFin: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
                  dureeJours: 30, avancement: 75, responsable,
                },
                {
                  numero: 'T2', designation: `Phase 2 - ${leaf.name}`,
                  unite: leaf.type === 'services' ? 'j' : (leaf.type === 'fourniture' ? 'u' : 'm²'),
                  quantite: leaf.type === 'services' ? 25 : (leaf.type === 'fourniture' ? 40 : 2000),
                  prixUnitaire: leaf.type === 'services' ? 400000 : (leaf.type === 'fourniture' ? 400000 : 50000),
                  dateDebut: new Date(startDate.getTime() + 31 * 24 * 60 * 60 * 1000),
                  dateFin: new Date(startDate.getTime() + 120 * 24 * 60 * 60 * 1000),
                  dureeJours: 90, avancement: 40, responsable,
                },
                {
                  numero: 'T3', designation: `Phase 3 - ${leaf.name}`,
                  unite: leaf.type === 'services' ? 'j' : (leaf.type === 'fourniture' ? 'u' : 'm²'),
                  quantite: leaf.type === 'services' ? 15 : (leaf.type === 'fourniture' ? 40 : 2000),
                  prixUnitaire: leaf.type === 'services' ? 280000 : (leaf.type === 'fourniture' ? 400000 : 20000),
                  dateDebut: new Date(startDate.getTime() + 121 * 24 * 60 * 60 * 1000),
                  dateFin: endDate,
                  dureeJours: 60, avancement: 5, responsable,
                },
              ] : [],
              createdBy: 'mock-user',
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Planning;
            
            mockPlannings.push(mockPlanning);
          });
          
          setPlannings(mockPlannings);
          console.log(`✅ ${mockPlannings.length} planifications mock chargées pour DEMO-2026 (feuilles à tous niveaux)`);
        } else {
          // Pour les autres projets, charger depuis l'API
          try {
            const plans = await planningService.getByProject(projectCode);
            console.log(`📊 Planifications chargées pour ${projectCode}:`, plans);
            setPlannings(Array.isArray(plans) ? plans : []);
          } catch (error) {
            console.error("Erreur chargement planifications:", error);
            setPlannings([]);
          }
        }
        
        // Tout déplier par défaut
        const compIds = new Set(proj.components.map((c) => c.id));
        const scIds = new Set(
          proj.components.flatMap((c) => c.sousComposants.map((sc) => `${c.id}.${sc.id}`))
        );
        setExpandedComponents(compIds);
        setExpandedSousComposants(scIds);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoading(false);
    }
  }

  const toggleComponent = (compId: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(compId)) {
        next.delete(compId);
      } else {
        next.add(compId);
      }
      return next;
    });
  };

  const toggleSousComposant = (scKey: string) => {
    setExpandedSousComposants((prev) => {
      const next = new Set(prev);
      if (next.has(scKey)) {
        next.delete(scKey);
      } else {
        next.add(scKey);
      }
      return next;
    });
  };

  const getPlanningForActivity = (activityPath: string): Planning | undefined => {
    if (!Array.isArray(plannings)) return undefined;
    return plannings.find((p) => p.activityPath === activityPath);
  };

  const getActivityTypeInfo = (typeId: string) => {
    return ACTIVITY_TYPES.find((t) => t.id === typeId) || ACTIVITY_TYPES[0];
  };

  const formatBudget = (budget?: number) => {
    if (!budget) return "—";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XAF",
      minimumFractionDigits: 0,
    }).format(budget);
  };

  const formatDate = (date?: Date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Projet introuvable</p>
        <Link href="/planification" className="text-[var(--accent)] text-sm mt-2 inline-block">
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
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
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
                  stroke="var(--accent)"
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
                ? "bg-[var(--accent)] text-white"
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
                ? "bg-[var(--accent)] text-white"
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
            onRefresh={loadData}
            focusedActivityPath={focusedActivity}
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

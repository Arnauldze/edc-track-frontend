"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  Save,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Clock,
  User,
  FileText,
  Briefcase,
  Hammer,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getProjectById, getLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type Planning, type CreatePlanningDto, type UpdatePlanningDto } from "@/services/api/planningService";
import { toast } from "@/lib/toastStore";
import { PlanningFormEtude } from "@/components/planning/PlanningFormEtude";
import { PlanningFormPassation } from "@/components/planning/PlanningFormPassation";
import { PlanningFormExecution } from "@/components/planning/PlanningFormExecution";
import { BudgetMultiDevise } from "@/components/planning/BudgetMultiDevise";

// Types d'activités
const ACTIVITY_TYPES = {
  travaux: { label: "Travaux", icon: Hammer, color: "blue" },
  fourniture: { label: "Fourniture", icon: Briefcase, color: "amber" },
  services: { label: "Services", icon: User, color: "green" },
  etudes: { label: "Études", icon: FileText, color: "purple" },
  pi: { label: "Prestations Intellectuelles", icon: FileText, color: "rose" },
};

export default function ActivityPlanningPage() {
  const params = useParams();
  const router = useRouter();
  const projectCode = typeof params.projectCode === "string" ? params.projectCode : "";
  const activityPath = typeof params.activityPath === "string" ? params.activityPath : "";

  const [project, setProject] = useState<Project | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  // Informations de l'activité
  const [activityName, setActivityName] = useState("");
  const [activityType, setActivityType] = useState<"travaux" | "fourniture" | "services" | "etudes" | "pi">("travaux");

  // Types de planification activés
  const [hasEtudePrealable, setHasEtudePrealable] = useState(false);
  const [hasPassation, setHasPassation] = useState(false);
  const [hasExecution, setHasExecution] = useState(false);

  // Données communes
  const [budgetInitial, setBudgetInitial] = useState<Array<{ devise: string; montant: number; pourcentage?: number }>>([
    { devise: "FCFA", montant: 0, pourcentage: 100 }
  ]);
  const [dateT0, setDateT0] = useState<string>(""); // Date de début globale de l'activité
  const [responsablePrincipal, setResponsablePrincipal] = useState("");

  // Données spécifiques (gérées par les sous-composants)
  const [etudeData, setEtudeData] = useState<any>(null);
  const [passationData, setPassationData] = useState<any>(null);
  const [executionData, setExecutionData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [projectCode, activityPath]);

  async function loadData() {
    setLoading(true);
    try {
      // Charger le projet
      const proj = await getProjectById(projectCode);
      if (!proj) {
        toast.error("Projet introuvable");
        router.push("/planification");
        return;
      }
      setProject(proj);

      // Trouver l'activité dans la structure
      const activity = findActivityByPath(proj, activityPath);
      if (activity) {
        setActivityName(activity.name);
        setActivityType(activity.type);
      }

      // Charger la planification existante
      try {
        const existingPlanning = await planningService.getOne(projectCode, activityPath);
        setPlanning(existingPlanning);
        setIsEditMode(true);
        setShowConfig(false);
        populateFormFromPlanning(existingPlanning);
      } catch {
        // 404 = pas de planification existante → mode création (normal)
        setIsEditMode(false);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  function findActivityByPath(proj: Project, path: string) {
    // Utiliser getLeafActivities pour trouver la feuille correspondante
    const leaves = getLeafActivities(proj);
    const leaf = leaves.find((l) => l.path === path);
    if (leaf) {
      return {
        name: leaf.name,
        type: leaf.type as any,
      };
    }

    // Fallback : parsing manuel pour le cas 3 niveaux
    const parts = path.split(".");
    if (parts.length >= 3) {
      const [compId, scId, actId] = parts;
      const comp = proj.components.find((c) => c.id === compId);
      if (!comp) return null;
      const sc = comp.sousComposants.find((s) => s.id === scId);
      if (!sc) return null;
      const actIndex = parseInt(actId.replace("A", "")) - 1;
      const act = sc.activities[actIndex];
      if (!act) return null;
      return {
        name: typeof act === "string" ? act : act.name,
        type: (typeof act === "string" ? "travaux" : act.typeActivite) as any,
      };
    }

    return null;
  }

  function populateFormFromPlanning(p: Planning) {
    console.log("📋 Chargement de la planification existante:", p);
    
    setHasEtudePrealable(!!p.hasEtudePrealable);
    setHasPassation(!!p.hasPassation);
    setHasExecution(!!p.hasExecution);
    setBudgetInitial(p.budgetInitial || []);
    setDateT0(p.dateDebutInitiale ? new Date(p.dateDebutInitiale).toISOString().split("T")[0] : "");
    setResponsablePrincipal(p.responsablePrincipal || "");

    // Données spécifiques - IMPORTANT : Charger immédiatement
    if (p.hasEtudePrealable && p.livrables && p.livrables.length > 0) {
      console.log("📦 Chargement des livrables:", p.livrables);
      const etudeDataToSet = {
        livrables: p.livrables || [],
      };
      setEtudeData(etudeDataToSet);
      console.log("✅ EtudeData défini:", etudeDataToSet);
    }
    if (p.hasPassation) {
      setPassationData({
        typePassation: p.typePassation || "",
        etapesPassation: p.etapesPassation || [],
      });
    }
    if (p.hasExecution && p.tachesExecution && p.tachesExecution.length > 0) {
      console.log("🔧 Chargement des tâches d'exécution:", p.tachesExecution);
      const executionDataToSet = {
        tachesExecution: p.tachesExecution || [],
      };
      setExecutionData(executionDataToSet);
      console.log("✅ ExecutionData défini:", executionDataToSet);
    }
  }

  async function handleSave() {
    // Validation
    if (!hasEtudePrealable && !hasPassation && !hasExecution) {
      toast.error("Sélectionnez au moins un type de planification");
      return;
    }

    if (budgetInitial.length === 0 || budgetInitial.every((b) => b.montant === 0)) {
      toast.error("Veuillez saisir un budget");
      return;
    }

    setSaving(true);
    try {
      const budgetInitialTotal = budgetInitial.reduce((sum, b) => sum + b.montant, 0);

      // Nettoyage des dates vides ("") pour éviter l'erreur Invalid Date sur le backend
      const cleanDates = (arr: any[]) => arr.map(item => {
        const cleaned = { ...item };
        if (cleaned.dateDebut === "") cleaned.dateDebut = undefined;
        if (cleaned.dateFin === "") cleaned.dateFin = undefined;
        if (cleaned.dateEcheance === "") cleaned.dateEcheance = undefined;
        return cleaned;
      });

      const data: CreatePlanningDto | UpdatePlanningDto = {
        projectCode,
        activityPath,
        activityName,
        activityType,
        hasEtudePrealable,
        hasPassation,
        hasExecution,
        budgetInitial,
        budgetInitialTotal,
        dateDebutInitiale: dateT0 ? new Date(dateT0) : undefined,
        dateFinInitiale: undefined, // Sera calculée automatiquement depuis les livrables
        delaiInitialMois: undefined, // Sera calculé automatiquement
        responsablePrincipal: responsablePrincipal || undefined,
        // Données spécifiques
        ...(hasEtudePrealable && etudeData
          ? {
              livrables: cleanDates(etudeData.livrables || []),
              dateT0Etude: dateT0 ? new Date(dateT0) : undefined, // Utiliser dateT0 global
            }
          : {}),
        ...(hasPassation && passationData
          ? {
              typePassation: passationData.typePassation,
              etapesPassation: cleanDates(passationData.etapesPassation || []),
            }
          : {}),
        ...(hasExecution && executionData
          ? {
              tachesExecution: cleanDates(executionData.tachesExecution || []),
            }
          : {}),
      };

      if (isEditMode) {
        await planningService.update(projectCode, activityPath, data as UpdatePlanningDto);
        toast.success("Planification mise à jour");
      } else {
        const created = await planningService.create(data as CreatePlanningDto);
        console.log("✅ Planification créée:", created);
        toast.success("Planification créée avec succès");
      }
      // Redirection automatique vers le Gantt pour voir les livrables créés/modifiés
      router.push(`/planification/${projectCode}?activity=${encodeURIComponent(activityPath)}&t=${Date.now()}`);
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error(error.response?.data?.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette planification ?")) return;

    try {
      await planningService.delete(projectCode, activityPath);
      toast.success("Planification supprimée");
      router.push(`/planification/${projectCode}`);
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  }

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

  const ActivityIcon = ACTIVITY_TYPES[activityType]?.icon || FileText;
  const activityColor = ACTIVITY_TYPES[activityType]?.color || "blue";

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href={`/planification/${projectCode}`}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            <ChevronLeft size={14} /> Retour au projet
          </Link>
        </div>

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-${activityColor}-500 to-${activityColor}-600 flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0`}
            >
              <ActivityIcon size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                {activityName}
                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">
                  {activityPath}
                </span>
              </h1>
              <div className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5">
                {project.name} • {ACTIVITY_TYPES[activityType]?.label}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/planification/${projectCode}`}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-inset)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-sm font-semibold hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <BarChart3 size={16} /> Voir le Gantt
            </Link>
            {isEditMode && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 rounded-[var(--radius-md)] text-sm font-semibold hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={16} /> Supprimer
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-[var(--radius-md)] text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {saving ? "Enregistrement..." : isEditMode ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className={`flex-1 overflow-y-auto ${hasPassation ? 'px-3' : 'px-8'} py-6`}>
        <div className={`${hasPassation ? 'max-w-full px-2' : 'max-w-5xl'} mx-auto space-y-6`}>
          {/* Paramètres d'activité - Compact Layout */}
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] shadow-sm">
            {/* Header / Toggle Config */}
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between p-4 bg-[var(--bg-inset)] hover:bg-[var(--bg-surface-hover)] transition-colors rounded-t-[var(--radius-lg)]"
            >
              <div className="flex items-center gap-3">
                <Settings size={18} className="text-[var(--accent)]" />
                <span className="font-bold text-[14px] text-[var(--text-primary)]">Configuration de l'activité</span>
                {!showConfig && (
                  <div className="flex gap-2 ml-4">
                    {hasEtudePrealable && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Étude</span>}
                    {hasPassation && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Passation</span>}
                    {hasExecution && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">Exécution</span>}
                  </div>
                )}
              </div>
              {showConfig ? <ChevronUp size={18} className="text-[var(--text-secondary)]" /> : <ChevronDown size={18} className="text-[var(--text-secondary)]" />}
            </button>

            {showConfig && (
              <div className="p-5 border-t border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Left side: Types */}
                <div className="md:col-span-4 space-y-3">
                  <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Phases à planifier</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] hover:border-[var(--accent)] transition-colors cursor-pointer bg-[var(--bg-surface)]">
                      <input type="checkbox" checked={hasEtudePrealable} onChange={(e) => setHasEtudePrealable(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">Étude Préalable</span>
                    </label>
                    <label className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] hover:border-[var(--accent)] transition-colors cursor-pointer bg-[var(--bg-surface)]">
                      <input type="checkbox" checked={hasPassation} onChange={(e) => setHasPassation(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">Passation</span>
                    </label>
                    <label className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] hover:border-[var(--accent)] transition-colors cursor-pointer bg-[var(--bg-surface)]">
                      <input type="checkbox" checked={hasExecution} onChange={(e) => setHasExecution(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">Exécution</span>
                    </label>
                  </div>
                </div>

                {/* Right side: Config */}
                <div className="md:col-span-8">
                  <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Informations Générales</label>
                  <div className="grid grid-cols-2 gap-5 bg-[var(--bg-inset)] p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-2">Budget Initial</label>
                      <BudgetMultiDevise budgets={budgetInitial} onChange={setBudgetInitial} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-2">Date T0 (Début global)</label>
                      <input type="date" value={dateT0} onChange={(e) => setDateT0(e.target.value)} className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[12px] focus:outline-none focus:border-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-2">Responsable</label>
                      <input type="text" value={responsablePrincipal} onChange={(e) => setResponsablePrincipal(e.target.value)} placeholder="Nom du responsable" className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[12px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Formulaires Spécifiques */}
          {hasEtudePrealable && (
            <PlanningFormEtude
              data={etudeData}
              onChange={setEtudeData}
              dateT0={dateT0}
            />
          )}

          {hasPassation && (
            <PlanningFormPassation data={passationData} onChange={setPassationData} />
          )}

          {hasExecution && (
            <PlanningFormExecution
              data={executionData}
              onChange={setExecutionData}
              dateT0={dateT0}
            />
          )}
        </div>
      </div>
    </div>
  );
}

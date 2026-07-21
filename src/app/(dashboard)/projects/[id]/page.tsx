"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Settings, Users, Layers, Plus, Trash2, Edit2,
  ChevronUp, ChevronDown, ChevronRight, Save, MapPin, DollarSign, Calendar,
  Search, MoreHorizontal, AlertCircle, Info,
} from "lucide-react";
import { getProjectById, updateProject, deleteProject, isComponentLowestLevel, isSousComposantLowestLevel, type Project, type Component, type SousComposant } from "@/lib/projectStore";
import { getProjectTeam, getUserById, getUserFullName, type TeamAssignment, getUsers, addTeamAssignment, removeTeamAssignment, type User } from "@/lib/userStore";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_COLORS, type ProjectRole } from "@/lib/rbacStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import AddMemberModal, { type MemberFormData } from "@/components/team/AddMemberModal";
import { ProjectInfoCard } from "@/components/projects/ProjectInfoCard";
import { ProjectTeamCard } from "@/components/projects/ProjectTeamCard";
import { CURRENCIES, DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";
import { formatMoney } from "@/lib/utils";

type ConfirmState = {
  type: "component" | "subcomponent" | "activity";
  title: string;
  message: string;
  onConfirm: () => void;
} | null;

// ══════════════════════════════════════
// ACTIVITY TYPES
// ══════════════════════════════════════
export const ACTIVITY_TYPES = [
  { id: "travaux", label: "Travaux", color: "bg-blue-500", bgColor: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "fourniture", label: "Fourniture", color: "bg-amber-500", bgColor: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { id: "services", label: "Services", color: "bg-green-500", bgColor: "bg-green-500/10 text-green-600 border-green-500/20" },
  { id: "etudes", label: "Études", color: "bg-purple-500", bgColor: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { id: "pi", label: "Prestations Intellectuelles", color: "bg-rose-500", bgColor: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
];

const getActivityName = (act: string | { name: string; typeActivite: string }): string =>
  typeof act === "string" ? act : act.name;

const getActivityType = (act: string | { name: string; typeActivite: string }): string =>
  typeof act === "string" ? "travaux" : act.typeActivite;

// ══════════════════════════════════════
// PAGE
// ══════════════════════════════════════
export default function ProjectConfigPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [project, setProject] = useState<Project | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"info" | "structure" | "team">("info");

  // Load project
  useEffect(() => {
    async function loadProject() {
      const proj = await getProjectById(projectId);
      setProject(proj);
      if (proj) {
        setComponents(proj.components || []);
      }
    }
    loadProject();
  }, [projectId]);

  // ── Editable structure state ──
  const [components, setComponents] = useState<Component[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isEditingStructure, setIsEditingStructure] = useState(false);
  const [originalComponents, setOriginalComponents] = useState<Component[]>([]);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const [showStructureHelp, setShowStructureHelp] = useState(false);
  const [showAllComponentWeights, setShowAllComponentWeights] = useState(false);

  // ── Delete project state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteCodeInput, setDeleteCodeInput] = useState("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  // Fermer le menu quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => setShowProjectMenu(false);
    if (showProjectMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showProjectMenu]);

  // ── Collapsed state for tree levels ──
  const [collapsedComponents, setCollapsedComponents] = useState<Set<number>>(new Set());
  const [collapsedSousComposants, setCollapsedSousComposants] = useState<Set<string>>(new Set());

  const toggleComponent = (ci: number) => {
    setCollapsedComponents(prev => {
      const next = new Set(prev);
      if (next.has(ci)) next.delete(ci);
      else next.add(ci);
      return next;
    });
  };

  const toggleSousComposant = (ci: number, si: number) => {
    const key = `${ci}-${si}`;
    setCollapsedSousComposants(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Team data ──
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [teamUsers, setTeamUsers] = useState<Map<string, any>>(new Map());
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeamAssignment | null>(null);
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    async function loadTeam() {
      const team = await getProjectTeam(projectId);
      setTeamAssignments(team);

      // Charger les utilisateurs
      const usersMap = new Map();
      for (const assignment of team) {
        const user = await getUserById(assignment.userId);
        if (user) {
          usersMap.set(assignment.userId, user);
        }
      }
      setTeamUsers(usersMap);
    }
    loadTeam();
  }, [projectId]);

  // Charger tous les utilisateurs pour le modal
  useEffect(() => {
    async function loadAllUsers() {
      const users = await getUsers();
      setAllUsers(users);
    }
    loadAllUsers();
  }, []);

  const markChanged = () => setHasChanges(true);

  // ── Mode édition ──
  const handleStartEditing = () => {
    setOriginalComponents(JSON.parse(JSON.stringify(components)));
    setIsEditingStructure(true);
    setHasChanges(false);
  };

  const handleCancelEditing = () => {
    setComponents(originalComponents);
    setIsEditingStructure(false);
    setHasChanges(false);
  };

  const handleSaveStructure = async () => {
    console.log('💾 Début sauvegarde, components:', components);
    try {
      const result = await updateProject(projectId, { components });
      console.log('✅ Résultat sauvegarde:', result);

      // Recharger le projet depuis le backend pour s'assurer d'avoir les données à jour
      const updatedProject = await getProjectById(projectId);
      console.log('🔄 Projet rechargé:', updatedProject);
      if (updatedProject) {
        setProject(updatedProject);
        setComponents(updatedProject.components || []);
      }

      setIsEditingStructure(false);
      setHasChanges(false);
      setOriginalComponents([]); // Réinitialiser l'état original
      toast.success("Structure du projet mise à jour");
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde:', error);
      toast.error(error?.message || "Erreur lors de la sauvegarde");
    }
  };

  // ── Navigation guard ──
  const handleTabChange = (tab: "info" | "structure" | "team") => {
    if (isEditingStructure && hasChanges) {
      setNavigationTarget(tab);
      setShowUnsavedChangesModal(true);
    } else {
      setActiveTab(tab);
    }
  };

  // ── Structure actions ──
  const addComponent = () => {
    if (!isEditingStructure) return;
    // Nouvelle composante sans sous-composantes = niveau le plus bas, donc ajouter typeActivite
    setComponents(prev => [...prev, { id: `c${Date.now()}`, name: "", sousComposants: [], typeActivite: "travaux" }]);
    markChanged();
  };
  const removeComponent = (idx: number) => {
    if (!isEditingStructure) return;
    setConfirmState({
      type: "component",
      title: "Supprimer le composant",
      message: "Êtes-vous sûr de vouloir supprimer ce composant ? Cette action est irréversible.",
      onConfirm: () => {
        setComponents(prev => prev.filter((_, i) => i !== idx));
        markChanged();
      }
    });
  };
  const updateComponentName = (idx: number, name: string) => {
    if (!isEditingStructure) return;
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, name } : c));
    markChanged();
  };
  const updateComponentBudget = (idx: number, budget: string) => {
    if (!isEditingStructure) return;
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, budget: budget ? parseFloat(budget) : undefined } : c));
    markChanged();
  };

  // Devise par composant
  const updateComponentDevise = (idx: number, devise: string) => {
    if (!isEditingStructure) return;
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, devise } : c));
    markChanged();
  };

  // TypeActivite pour composantes et sous-composantes
  const updateComponentType = (idx: number, typeActivite: string) => {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' } : c));
    markChanged();
  };
  const updateSCType = (compIdx: number, scIdx: number, typeActivite: string) => {
    setComponents(prev => prev.map((c, ci) => ci === compIdx ? { ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? { ...sc, typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' } : sc) } : c));
    markChanged();
  };
  const addSousComposant = (compIdx: number) => {
    setComponents(prev => prev.map((c, i) => {
      if (i !== compIdx) return c;
      // Quand on ajoute une sous-composante, retirer le typeActivite de la composante
      const { typeActivite, ...compWithoutType } = c;
      return {
        ...compWithoutType,
        sousComposants: [...c.sousComposants, { id: `sc${Date.now()}`, name: "", activities: [] }]
      };
    }));
    markChanged();
  };
  const removeSousComposant = (compIdx: number, scIdx: number) => {
    setConfirmState({
      type: "subcomponent",
      title: "Supprimer le sous-composant",
      message: "Êtes-vous sûr de vouloir supprimer ce sous-composant ? Cette action est irréversible.",
      onConfirm: () => {
        setComponents(prev => prev.map((c, ci) => {
          if (ci !== compIdx) return c;
          const updatedSCs = c.sousComposants.filter((_, si) => si !== scIdx);
          // Si on supprime la dernière sous-composante, ajouter typeActivite à la composante
          if (updatedSCs.length === 0) {
            return { ...c, sousComposants: updatedSCs, typeActivite: "travaux" };
          }
          return { ...c, sousComposants: updatedSCs };
        }));
        markChanged();
      }
    });
  };
  const updateSCName = (compIdx: number, scIdx: number, name: string) => {
    setComponents(prev => prev.map((c, ci) => ci === compIdx ? { ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? { ...sc, name } : sc) } : c));
    markChanged();
  };
  const addActivity = (compIdx: number, scIdx: number, typeActivite: string = "travaux") => {
    const newAct = { name: "", typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' };
    setComponents(prev => prev.map((c, ci) => {
      if (ci !== compIdx) return c;
      return {
        ...c,
        sousComposants: c.sousComposants.map((sc, si) => {
          if (si !== scIdx) return sc;
          // Quand on ajoute une activité, retirer le typeActivite de la sous-composante
          const { typeActivite: scType, ...scWithoutType } = sc;
          return { ...scWithoutType, activities: [...sc.activities, newAct] };
        })
      };
    }));
    markChanged();
  };
  const updateActivityName = (compIdx: number, scIdx: number, actIdx: number, name: string) => {
    setComponents(prev => prev.map((c, ci) => ci === compIdx ? {
      ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? {
        ...sc, activities: sc.activities.map((a, ai) => ai === actIdx ? { ...a, name } : a)
      } : sc)
    } : c));
    markChanged();
  };
  const updateActivityType = (compIdx: number, scIdx: number, actIdx: number, typeActivite: string) => {
    setComponents(prev => prev.map((c, ci) => ci === compIdx ? {
      ...c, sousComposants: c.sousComposants.map((sc, si) => si === scIdx ? {
        ...sc, activities: sc.activities.map((a, ai) => ai === actIdx ? { ...a, typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' } : a)
      } : sc)
    } : c));
    markChanged();
  };
  const removeActivity = (compIdx: number, scIdx: number, actIdx: number) => {
    setConfirmState({
      type: "activity",
      title: "Supprimer l'activité",
      message: "Êtes-vous sûr de vouloir supprimer cette activité ? Cette action est irréversible.",
      onConfirm: () => {
        setComponents(prev => prev.map((c, ci) => {
          if (ci !== compIdx) return c;
          return {
            ...c,
            sousComposants: c.sousComposants.map((sc, si) => {
              if (si !== scIdx) return sc;
              const updatedActivities = sc.activities.filter((_, ai) => ai !== actIdx);
              // Si on supprime la dernière activité, ajouter typeActivite à la sous-composante
              if (updatedActivities.length === 0) {
                return { ...sc, activities: updatedActivities, typeActivite: "travaux" };
              }
              return { ...sc, activities: updatedActivities };
            })
          };
        }));
        markChanged();
      }
    });
  };

  // ═══ Promotion / Rétrogradation ═══
  const demoteComponent = (ci: number) => {
    if (ci <= 0) return;
    setComponents(prev => {
      const comp = prev[ci];
      const newSC: SousComposant = { id: `sc${Date.now()}`, name: comp.name, activities: comp.sousComposants.flatMap(sc => sc.activities.length > 0 ? sc.activities : [{ name: sc.name, typeActivite: "travaux" as const }]) };
      const result = prev.filter((_, i) => i !== ci);
      result[ci - 1] = { ...result[ci - 1], sousComposants: [...result[ci - 1].sousComposants, newSC] };
      return result;
    });
    markChanged();
  };

  const promoteSC = (ci: number, si: number) => {
    setComponents(prev => {
      const comp = prev[ci];
      const sc = comp.sousComposants[si];
      const newComp: Component = { id: `c${Date.now()}`, name: sc.name, sousComposants: [] };
      if (sc.activities.length > 0) {
        newComp.sousComposants = sc.activities.map((a, idx) => ({ id: `sc${Date.now() + idx + 1}`, name: getActivityName(a), activities: [] }));
      }
      const updatedComp = { ...comp, sousComposants: comp.sousComposants.filter((_, j) => j !== si) };
      const result = [...prev];
      result[ci] = updatedComp;
      result.splice(ci + 1, 0, newComp);
      return result;
    });
    markChanged();
  };

  const demoteSC = (ci: number, si: number) => {
    if (si <= 0) return;
    setComponents(prev => prev.map((c, i) => {
      if (i !== ci) return c;
      const sc = c.sousComposants[si];
      const updatedSCs = c.sousComposants.filter((_, j) => j !== si);
      const prevSCIdx = si - 1;
      updatedSCs[prevSCIdx] = {
        ...updatedSCs[prevSCIdx],
        activities: [...updatedSCs[prevSCIdx].activities, { name: sc.name, typeActivite: "travaux" }, ...sc.activities],
      };
      return { ...c, sousComposants: updatedSCs };
    }));
    markChanged();
  };

  const promoteActivity = (ci: number, si: number, ai: number) => {
    setComponents(prev => prev.map((c, i) => {
      if (i !== ci) return c;
      const actName = getActivityName(c.sousComposants[si].activities[ai]);
      const newSC: SousComposant = { id: `sc${Date.now()}`, name: actName, activities: [] };
      const updatedSC = c.sousComposants.map((sc, j) => j === si ? { ...sc, activities: sc.activities.filter((_, k) => k !== ai) } : sc);
      updatedSC.splice(si + 1, 0, newSC);
      return { ...c, sousComposants: updatedSC };
    }));
    markChanged();
  };

  // ── Save ──
  const handleSave = () => {
    updateProject(projectId, { components });
    setHasChanges(false);
    toast.success("Structure du projet mise à jour");
  };

  // ── Delete ──
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteProject(projectId);
      toast.success("Projet supprimé avec succès");
      router.push("/projects");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression du projet");
      setDeleting(false);
    }
  };

  // ── Stats ──
  const totalSC = components.reduce((sum, c) => sum + c.sousComposants.length, 0);
  const totalActivities = components.reduce((sum, c) => sum + c.sousComposants.reduce((s, sc) => s + sc.activities.length, 0), 0);

  // ── Budget et pondération (calculés à partir des montants) ──
  const budgetParDevise = components.reduce((acc, c) => {
    if (c.budget) {
      const devise = c.devise || 'FCFA'; // Valeur par défaut si devise non définie
      acc[devise] = (acc[devise] || 0) + c.budget;
    }
    return acc;
  }, {} as Record<string, number>);

  const exchangeRates = project?.financement?.tauxChange || DEFAULT_EXCHANGE_RATES;
  const allocatedBudgetFCFA = components.reduce((sum, c) => {
    if (c.budget) {
      const devise = c.devise || 'FCFA'; // Valeur par défaut si devise non définie
      const rate = exchangeRates[devise] || 1;
      return sum + (c.budget * rate);
    }
    return sum;
  }, 0);
  const projectBudgetFCFA = project?.budget
    ? project.budget * (exchangeRates[project.devise || 'FCFA'] || 1)
    : 0;
  const budgetTotalFCFA = projectBudgetFCFA || allocatedBudgetFCFA;
  const totalPonderation = budgetTotalFCFA > 0 ? (allocatedBudgetFCFA / budgetTotalFCFA) * 100 : 0;
  const remainingBudgetFCFA = Math.max(budgetTotalFCFA - allocatedBudgetFCFA, 0);
  const weightedComponents = components.map((component, index) => {
    const devise = component.devise || 'FCFA';
    const budget = component.budget || 0;
    const budgetFCFA = budget * (exchangeRates[devise] || 1);
    return {
      component,
      index,
      devise,
      budget,
      budgetFCFA,
      percentage: budgetTotalFCFA > 0 ? (budgetFCFA / budgetTotalFCFA) * 100 : 0,
    };
  });
  const displayedWeightedComponents = showAllComponentWeights ? weightedComponents : weightedComponents.slice(0, 3);
  const usedExchangeRates = Object.entries(exchangeRates)
    .filter(([devise]) => devise !== 'FCFA' && budgetParDevise[devise])
    .map(([devise, rate]) => `1 ${devise} = ${rate.toLocaleString('fr-FR')} FCFA`)
    .join(', ');

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Projet introuvable</p>
        <Link href="/projects" className="text-[var(--accent)] text-sm mt-2 inline-block">Retour</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-4 pb-4 flex-shrink-0">
        {/* Breadcrumb en haut */}
        <div className="mb-3">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors inline-flex"
          >
            <ChevronLeft size={14} /> Tous les projets
          </Link>
        </div>

        {/* Titre et boutons */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                {project.name}
                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">
                  {project.code}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Menu contextuel */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProjectMenu(!showProjectMenu);
                }}
                className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors border border-[var(--border-default)]"
                title="Options du projet"
              >
                <MoreHorizontal size={18} />
              </button>

              {/* Dropdown menu */}
              {showProjectMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] shadow-[var(--shadow-lg)] z-50 py-1 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowProjectMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={16} /> Supprimer le projet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div className="flex items-center px-8 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex-shrink-0">
        <div className="flex gap-0.5">
          <button
            onClick={() => handleTabChange("info")}
            className={`py-3 px-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === "info"
              ? "border-[var(--text-primary)] text-[var(--text-primary)] font-bold"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
          >
            <Settings size={14} /> Informations
          </button>
          <button
            onClick={() => handleTabChange("structure")}
            className={`py-3 px-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === "structure"
              ? "border-[var(--text-primary)] text-[var(--text-primary)] font-bold"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
          >
            <Layers size={14} /> Structure & Activités
          </button>
          {/* Onglet Équipe */}
          <button
            onClick={() => handleTabChange("team")}
            className={`py-3 px-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === "team"
              ? "border-[var(--text-primary)] text-[var(--text-primary)] font-bold"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
          >
            <Users size={14} /> Équipe
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* ══ TAB: Informations ══ */}
        {activeTab === "info" && (
          <div className="max-w-7xl w-full space-y-4">
            {/* En-tête avec compteurs et bouton d'action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">{components.length}</strong> composants
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">{totalSC}</strong> sous-composants
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">{totalActivities}</strong> activités
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold flex items-center gap-1.5">
                  <DollarSign size={12} />
                  {project.financement?.type || "MOP"} • {project.financement ? ((project.financement.budgetNational ? 1 : 0) + (project.financement.bailleurs?.length || 0) + (project.financement.partiesPubliques?.length || 0) + (project.financement.partiesPrivees?.length || 0)) : 5} financeurs
                </span>
              </div>

              <button
                onClick={() => toast.info("Modification des informations du projet")}
                className="flex items-center gap-2 px-4 py-1.5 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Edit2 size={13} />
                Modifier les informations
              </button>
            </div>

            {/* Layout 2 colonnes : Infos projet + Équipe */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <ProjectInfoCard project={project} />
              <ProjectTeamCard projectId={project.code} />
            </div>
          </div>
        )}

        {/* ══ TAB: Structure & Activités ══ */}
        {activeTab === "structure" && (
          <div className="max-w-7xl w-full pb-12">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">

              {/* SECTION PRINCIPALE (Composants) */}
              <div className="order-1 xl:order-1 space-y-3">
                {/* En-tête fixe avec compteurs, hover info et bouton d'action */}
                <div className="sticky -top-6 z-20 bg-[var(--bg-root)] py-2.5 border-b border-[var(--border-default)] flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">{components.length}</strong> composants
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">{totalSC}</strong> sous-composants
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">{totalActivities}</strong> activités
                    </span>

                    {/* Types & navigation - Info sur hover */}
                    <div className="relative group inline-block">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] cursor-help hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors">
                        <Info size={13} className="text-[var(--accent)]" />
                        <span>Types & navigation</span>
                      </div>

                      {/* Tooltip / Popover au hover */}
                      <div className="absolute left-0 top-full mt-2 w-80 p-3.5 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-lg)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto">
                        <div className="text-[11px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">Types d&apos;activités & Navigation</div>
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {ACTIVITY_TYPES.map((t) => (
                            <span key={t.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${t.bgColor}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${t.color}`} />
                              {t.label}
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                          Utilisez les flèches pour déplier les niveaux. En mode édition, les commandes permettent de modifier la structure.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'action : Modifier la structure / Enregistrer / Annuler */}
                  <div>
                    {!isEditingStructure ? (
                      <button
                        onClick={handleStartEditing}
                        className="flex items-center gap-2 px-4 py-1.5 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Edit2 size={13} />
                        Modifier la structure
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-orange-600 font-semibold bg-orange-500/10 px-2.5 py-1 rounded-[var(--radius-md)] border border-orange-500/20">
                          <Edit2 size={13} />
                          Mode édition actif
                        </span>
                        <button
                          onClick={handleCancelEditing}
                          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-xs font-semibold hover:bg-[var(--bg-surface-hover)] transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleSaveStructure}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-[var(--radius-md)] text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm"
                        >
                          <Save size={13} />
                          Enregistrer
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arbre des composants */}
                <div className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-4 space-y-3">
                    {components.map((comp, ci) => (
                      <div key={comp.id} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4">
                        {/* Component header */}
                        <div className="flex items-center gap-2">
                          {/* Collapse toggle for component */}
                          {comp.sousComposants.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleComponent(ci)}
                              className="p-0.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all flex-shrink-0"
                              title={collapsedComponents.has(ci) ? "Déplier" : "Replier"}
                            >
                              <ChevronRight size={16} className={`transition-transform duration-200 ${collapsedComponents.has(ci) ? '' : 'rotate-90'}`} />
                            </button>
                          ) : (
                            <div className="w-[20px] flex-shrink-0" />
                          )}
                          <div className="w-7 h-7 bg-blue-500/15 text-blue-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[10px] flex-shrink-0">C{ci + 1}</div>

                          {/* MODE LECTURE */}
                          {!isEditingStructure ? (
                            <>
                              <div className="flex-1 min-w-0 px-1 py-1">
                                <span className="text-[14px] font-bold text-[var(--text-primary)]">{comp.name || "Sans nom"}</span>
                              </div>

                              {/* Budget et pondération calculée */}
                              {comp.budget !== undefined && comp.budget !== null ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-inset)] rounded-[var(--radius-sm)] border border-[var(--border-default)] flex-shrink-0">
                                  <span className="text-[12px] font-bold text-[var(--text-primary)]">
                                    {formatMoney(comp.budget, 2)} {comp.devise || 'FCFA'}
                                  </span>
                                  {budgetTotalFCFA > 0 && (
                                    <span className="text-[11px] font-semibold text-green-600">
                                      ({(() => {
                                        const rate = exchangeRates[comp.devise || 'FCFA'] || 1;
                                        const budgetFCFA = comp.budget * rate;
                                        const percentage = (budgetFCFA / budgetTotalFCFA) * 100;
                                        return percentage.toFixed(2);
                                      })()}%)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="px-2 py-1 text-[10px] text-orange-600 bg-orange-50 rounded border border-orange-200">
                                  Budget non défini
                                </div>
                              )}

                              {/* Type d'activité (si niveau le plus bas) */}
                              {isComponentLowestLevel(comp) && comp.typeActivite && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${ACTIVITY_TYPES.find(t => t.id === comp.typeActivite)?.bgColor || ACTIVITY_TYPES[0].bgColor}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_TYPES.find(t => t.id === comp.typeActivite)?.color || ACTIVITY_TYPES[0].color}`} />
                                  {ACTIVITY_TYPES.find(t => t.id === comp.typeActivite)?.label || "Travaux"}
                                </span>
                              )}
                            </>
                          ) : (
                            /* MODE ÉDITION */
                            <>
                              <input type="text" value={comp.name} onChange={e => updateComponentName(ci, e.target.value)} placeholder="Nom du composant..." className="flex-1 min-w-0 bg-transparent border-b-2 border-transparent hover:border-[var(--border-default)] focus:border-[var(--accent)] outline-none text-[14px] font-bold text-[var(--text-primary)] px-1 py-1 transition-colors" style={{ minWidth: '200px' }} />

                              {/* Budget + Devise */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <div className="relative w-[140px]">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={comp.budget ? formatMoney(comp.budget, 2) : ''}
                                    onChange={e => {
                                      const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                                      updateComponentBudget(ci, raw);
                                    }}
                                    placeholder="0,00"
                                    className="w-full bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  />
                                </div>
                                <select value={comp.devise || "FCFA"} onChange={e => updateComponentDevise(ci, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--text-secondary)] px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[75px] flex-shrink-0">
                                  {CURRENCIES.map(curr => (<option key={curr.code} value={curr.code}>{curr.code}</option>))}
                                </select>
                              </div>

                              {/* Pondération calculée en temps réel */}
                              <div className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface-hover)] text-[11px] font-bold text-[var(--text-primary)] whitespace-nowrap flex-shrink-0">
                                {budgetTotalFCFA > 0 && comp.budget ? (() => {
                                  const rate = exchangeRates[comp.devise || 'FCFA'] || 1;
                                  return ((comp.budget * rate / budgetTotalFCFA) * 100).toFixed(2);
                                })() : '0.00'}%
                              </div>
                              {/* Type d'activité (si niveau le plus bas) */}
                              {isComponentLowestLevel(comp) && (
                                <select value={comp.typeActivite || "travaux"} onChange={e => updateComponentType(ci, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--text-secondary)] px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[140px] flex-shrink-0">
                                  {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                </select>
                              )}
                              {/* Boutons d'action — ordre uniforme : (monter) → (descendre) → (supprimer), gap-2 = 8px, icônes 16px */}
                              <div className="flex items-center gap-2 flex-shrink-0 ml-1 border-l border-[var(--border-subtle)] pl-2">
                                <button type="button" onClick={() => demoteComponent(ci)} disabled={ci === 0} className="p-1 rounded-[var(--radius-sm)] hover:bg-orange-500/10 text-orange-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Transformer en Sous-composant"><ChevronDown size={16} /></button>
                                <button type="button" onClick={() => removeComponent(ci)} className="p-1 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all" title="Supprimer"><Trash2 size={16} /></button>
                              </div>
                            </>
                          )}

                          {/* Collapsed count badge */}
                          {collapsedComponents.has(ci) && comp.sousComposants.length > 0 && (
                            <span className="text-[9px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded-full border border-[var(--border-default)] flex-shrink-0">
                              {comp.sousComposants.length} SC · {comp.sousComposants.reduce((s, sc) => s + sc.activities.length, 0)} Act.
                            </span>
                          )}
                        </div>

                        {/* Sous-composants */}
                        {!collapsedComponents.has(ci) && (
                          <div className="ml-9 pl-3 border-l-2 border-blue-500/20 space-y-1 mt-3">
                            {comp.sousComposants.map((sc, si) => (
                              <div key={sc.id}>
                                <div className="flex items-center gap-2 py-1.5">
                                  {/* Collapse toggle for sous-composant */}
                                  {sc.activities.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleSousComposant(ci, si)}
                                      className="p-0.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all flex-shrink-0"
                                      title={collapsedSousComposants.has(`${ci}-${si}`) ? "Déplier" : "Replier"}
                                    >
                                      <ChevronRight size={14} className={`transition-transform duration-200 ${collapsedSousComposants.has(`${ci}-${si}`) ? '' : 'rotate-90'}`} />
                                    </button>
                                  ) : (
                                    <div className="w-[18px] flex-shrink-0" />
                                  )}
                                  <div className="w-5 h-5 bg-amber-500/15 text-amber-500 rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[8px] flex-shrink-0">SC</div>

                                  {/* MODE LECTURE */}
                                  {!isEditingStructure ? (
                                    <>
                                      <div className="flex-1 min-w-0 px-1 py-0.5">
                                        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{sc.name || "Sans nom"}</span>
                                      </div>

                                      {/* Type d'activité (si niveau le plus bas) */}
                                      {isSousComposantLowestLevel(sc) && sc.typeActivite && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${ACTIVITY_TYPES.find(t => t.id === sc.typeActivite)?.bgColor || ACTIVITY_TYPES[0].bgColor}`}>
                                          <div className={`w-1 h-1 rounded-full ${ACTIVITY_TYPES.find(t => t.id === sc.typeActivite)?.color || ACTIVITY_TYPES[0].color}`} />
                                          {ACTIVITY_TYPES.find(t => t.id === sc.typeActivite)?.label || "Travaux"}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    /* MODE ÉDITION */
                                    <>
                                      <input type="text" value={sc.name} onChange={e => updateSCName(ci, si, e.target.value)} placeholder="Sous-composant..." className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-[var(--border-default)] focus:border-[var(--accent)] outline-none text-[12px] font-semibold text-[var(--text-secondary)] px-1 py-0.5 transition-colors" />
                                      {/* Type d'activité (si niveau le plus bas) */}
                                      {isSousComposantLowestLevel(sc) && (
                                        <select value={sc.typeActivite || "travaux"} onChange={e => updateSCType(ci, si, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[9px] font-semibold text-[var(--text-secondary)] px-1.5 py-1 focus:outline-none focus:border-[var(--accent)] cursor-pointer w-[120px] flex-shrink-0">
                                          {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                        </select>
                                      )}
                                      {/* Boutons d'action — ordre uniforme : (monter) → (descendre) → (supprimer), gap-2 = 8px, icônes 16px */}
                                      <div className="flex items-center gap-2 flex-shrink-0 border-l border-[var(--border-subtle)] pl-2">
                                        <button type="button" onClick={() => promoteSC(ci, si)} className="p-1 rounded-[var(--radius-sm)] hover:bg-green-500/10 text-green-500 transition-all" title="Transformer en Composant"><ChevronUp size={16} /></button>
                                        <button type="button" onClick={() => demoteSC(ci, si)} disabled={si === 0} className="p-1 rounded-[var(--radius-sm)] hover:bg-orange-500/10 text-orange-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Transformer en Activité"><ChevronDown size={16} /></button>
                                        <button type="button" onClick={() => removeSousComposant(ci, si)} className="p-1 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                      </div>
                                    </>
                                  )}

                                  {/* Collapsed count badge */}
                                  {collapsedSousComposants.has(`${ci}-${si}`) && sc.activities.length > 0 && (
                                    <span className="text-[9px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded-full border border-[var(--border-default)] flex-shrink-0">
                                      {sc.activities.length} activité{sc.activities.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>

                                {/* Activities with type selector */}
                                {!collapsedSousComposants.has(`${ci}-${si}`) && (
                                  <div className="ml-7 pl-3 border-l border-amber-500/15 space-y-1 mt-0.5">
                                    {sc.activities.map((act, ai) => {
                                      const actName = getActivityName(act);
                                      const actType = getActivityType(act);
                                      const typeInfo = ACTIVITY_TYPES.find(t => t.id === actType) || ACTIVITY_TYPES[0];
                                      return (
                                        <div key={ai} className="flex items-center gap-1.5 py-0.5 group">
                                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${typeInfo.color}`} />

                                          {/* MODE LECTURE */}
                                          {!isEditingStructure ? (
                                            <>
                                              <div className="flex-1 min-w-0 px-2 py-1">
                                                <span className="text-[11px] text-[var(--text-secondary)]">{actName || "Sans nom"}</span>
                                              </div>
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border ${typeInfo.bgColor}`}>
                                                {typeInfo.label}
                                              </span>
                                            </>
                                          ) : (
                                            /* MODE ÉDITION */
                                            <>
                                              <input
                                                type="text"
                                                value={actName}
                                                onChange={e => updateActivityName(ci, si, ai, e.target.value)}
                                                placeholder="Nom de l'activité..."
                                                className="flex-1 min-w-0 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] outline-none text-[11px] text-[var(--text-secondary)] px-2 py-1 focus:border-[var(--accent)] transition-colors"
                                              />
                                              {/* Type selector */}
                                              <select
                                                value={actType}
                                                onChange={e => updateActivityType(ci, si, ai, e.target.value)}
                                                className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--text-secondary)] px-1.5 py-1 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer w-[140px] flex-shrink-0"
                                              >
                                                {ACTIVITY_TYPES.map(t => (
                                                  <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                              </select>
                                              {/* Boutons d'action — ordre uniforme : (monter) → (supprimer), gap-2 = 8px, icônes 16px */}
                                              <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity border-l border-[var(--border-subtle)] pl-2">
                                                <button type="button" onClick={() => promoteActivity(ci, si, ai)} className="p-1 rounded-[var(--radius-sm)] hover:bg-green-500/10 text-green-500 transition-all" title="Transformer en Sous-composant"><ChevronUp size={16} /></button>
                                                <button type="button" onClick={() => removeActivity(ci, si, ai)} className="p-1 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Add activity with type dropdown (uniquement en mode édition) */}
                                    {isEditingStructure && (
                                      <div className="flex items-center gap-1.5 mt-1 py-1">
                                        <button type="button" onClick={() => addActivity(ci, si, "travaux")} className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:underline"><Plus size={10} /> Activité</button>
                                        <span className="text-[var(--text-tertiary)] text-[9px]">—</span>
                                        {ACTIVITY_TYPES.map(t => (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => addActivity(ci, si, t.id)}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border hover:opacity-80 transition-opacity ${t.bgColor}`}
                                            title={`Ajouter une activité de type ${t.label}`}
                                          >
                                            <div className={`w-1 h-1 rounded-full ${t.color}`} />
                                            {t.label.substring(0, 4)}.
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {isEditingStructure && (
                              <button type="button" onClick={() => addSousComposant(ci)} className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mt-2 pt-1"><Plus size={12} /> Sous-composant</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {isEditingStructure && (
                      <button type="button" onClick={addComponent} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[var(--border-default)] rounded-[var(--radius-md)] text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-all">
                        <Plus size={14} /> Ajouter un composant
                      </button>
                    )}
                  </div>
                </div>

              {/* SIDEBAR (Budget & Pondération Totale & Répartition) */}
              <aside className="order-2 xl:order-2 xl:sticky xl:top-6 xl:max-h-[calc(100vh-6rem)] flex flex-col gap-2.5">
                {/* CARTE 1 : Budget total — Disposition horizontale (conforme à la maquette) */}
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-[var(--radius-lg)] p-3.5 flex-shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
                        Budget total
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5 truncate">
                        {usedExchangeRates ? usedExchangeRates : 'Montant de référence'}
                      </div>
                    </div>
                    <div className="text-[17px] font-bold tracking-tight text-green-700 dark:text-green-400 whitespace-nowrap flex-shrink-0">
                      {formatMoney(budgetTotalFCFA, 2)} FCFA
                    </div>
                  </div>
                </div>

                {/* CARTE 2 : Pondération totale */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-sm flex-shrink-0 p-3.5">
                  <div className="space-y-1.5">
                    {/* Ligne 1 : Titre + % */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                        Pondération totale
                      </span>
                      <span className={`text-xl font-bold ${Math.abs(totalPonderation - 100) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalPonderation.toFixed(2)}%
                      </span>
                    </div>

                    {/* Ligne 2 : Barre */}
                    <div className="h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          totalPonderation > 100 ? 'bg-red-500' : totalPonderation === 100 ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(totalPonderation, 100)}%` }}
                      />
                    </div>

                    {/* Ligne 3 : Montant réparti / Budget total */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[var(--text-primary)]">
                        {formatMoney(allocatedBudgetFCFA, 2)} FCFA
                      </span>
                      <span className="text-[var(--text-tertiary)] font-medium">
                        / {formatMoney(budgetTotalFCFA, 2)} FCFA
                      </span>
                    </div>

                    {/* Ligne 4 : Alerte */}
                    {remainingBudgetFCFA > 0 ? (
                      <div className="text-[11px] font-medium text-red-500 flex items-center gap-1.5 pt-0.5">
                        <AlertCircle size={12} className="flex-shrink-0 text-red-500" />
                        <span>
                          Reste <strong>{formatMoney(remainingBudgetFCFA, 2)} FCFA</strong> à affecter ({Math.max(0, 100 - totalPonderation).toFixed(2)}%)
                        </span>
                      </div>
                    ) : totalPonderation > 100 ? (
                      <div className="text-[11px] font-medium text-red-500 flex items-center gap-1.5 pt-0.5">
                        <AlertCircle size={12} className="flex-shrink-0 text-red-500" />
                        <span>
                          Dépassement de <strong>{formatMoney(allocatedBudgetFCFA - budgetTotalFCFA, 2)} FCFA</strong> ({(totalPonderation - 100).toFixed(2)}%)
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] font-medium text-green-600 flex items-center gap-1.5 pt-0.5">
                        <span>✓ Budget équilibré (100%)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CARTE 3 : Répartition par composante */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-sm flex flex-col min-h-0 flex-1 p-3.5">
                  <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2.5 flex-shrink-0">
                    Répartition par composante
                  </div>

                  {/* Liste scrollable */}
                  <div className="overflow-y-auto flex-1 min-h-0 space-y-2 pr-1">
                    {weightedComponents.map(({ component, index, budget, devise, percentage }) => (
                      <div key={component.id} className="pb-2 border-b border-[var(--border-subtle)] last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`w-6 h-5 flex items-center justify-center rounded-[var(--radius-sm)] text-[9px] font-bold flex-shrink-0 ${budget > 0 ? 'bg-blue-500/15 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                              C{index + 1}
                            </span>
                            <span className={`truncate text-[12px] font-semibold ${budget > 0 ? 'text-[var(--text-primary)]' : 'text-red-500'}`}>
                              {component.name || 'Sans nom'}
                            </span>
                          </div>
                          <span className={`text-[12px] font-bold flex-shrink-0 ${budget > 0 ? 'text-[var(--text-primary)]' : 'text-red-500'}`}>
                            {percentage.toFixed(2)}%
                          </span>
                        </div>
                        <div className={`mt-0.5 text-[11px] ${budget > 0 ? 'text-[var(--text-tertiary)]' : 'text-red-500'}`}>
                          {budget > 0 ? `${formatMoney(budget, 2)} ${devise}` : '0,00 FCFA — non défini'}
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(percentage, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Indicateur de défilement */}
                  {weightedComponents.length > 4 && (
                    <div className="pt-2 text-[10px] text-center text-[var(--text-tertiary)] flex items-center justify-center gap-1 font-medium border-t border-[var(--border-subtle)] flex-shrink-0 mt-1">
                      <span>↕</span> défiler pour voir les {weightedComponents.length - 4} restantes
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ══ TAB: Équipe ══ */}
        {activeTab === "team" && (
          <div className="max-w-6xl space-y-4">
            {/* Actions bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                />
                <input
                  type="text"
                  placeholder="Rechercher un membre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                />
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus size={16} />
                Ajouter un membre
              </button>
            </div>

            {/* Team table */}
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-[var(--bg-inset)] border-b border-[var(--border-default)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Membre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Rôle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Niveau
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Affectation
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {teamAssignments
                    .filter((assignment) => {
                      const user = teamUsers.get(assignment.userId);
                      if (!user) return false;
                      const roleLabel = PROJECT_ROLE_LABELS[assignment.projectRole] || assignment.projectRole;
                      const searchStr = `${user.firstName} ${user.lastName} ${roleLabel} ${assignment.entityName || ""}`.toLowerCase();
                      return searchStr.includes(searchQuery.toLowerCase());
                    })
                    .map((assignment, index) => {
                      const user = teamUsers.get(assignment.userId);
                      if (!user) return null;

                      const getLevelLabel = (level: string) => {
                        switch (level) {
                          case "project": return "Projet";
                          case "component": return "Composant";
                          case "subcomponent": return "Sous-composant";
                          case "activity": return "Activité";
                          default: return level;
                        }
                      };

                      return (
                        <tr key={`assignment-${index}`} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                                {user.firstName?.[0] || ""}{user.lastName?.[0] || ""}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-[var(--text-primary)]">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-xs text-[var(--text-tertiary)]">
                                  {user.position || "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${PROJECT_ROLE_COLORS[assignment.projectRole]?.bg || 'bg-gray-100'} ${PROJECT_ROLE_COLORS[assignment.projectRole]?.text || 'text-gray-800'} border ${PROJECT_ROLE_COLORS[assignment.projectRole]?.border || 'border-gray-200'}`}>
                              {PROJECT_ROLE_LABELS[assignment.projectRole]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                            {getLevelLabel(assignment.level)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                            {assignment.entityName || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingAssignment(assignment);
                                  setShowAddModal(true);
                                }}
                                className="p-1.5 rounded-[var(--radius-sm)] hover:bg-blue-500/10 text-blue-500 transition-all"
                                title="Modifier"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteTeamConfirm({ id: assignment._id, name: `${user.firstName} ${user.lastName}` })}
                                className="p-1.5 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-red-500 transition-all"
                                title="Retirer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {teamAssignments.length === 0 && (
                <div className="text-center py-12 text-[var(--text-tertiary)]">
                  <Users size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucun membre dans l&apos;équipe</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-[var(--accent)] text-sm font-semibold hover:underline mt-2 inline-block"
                  >
                    Ajouter le premier membre
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal d'ajout/modification de membre */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingAssignment(null);
        }}
        onSubmit={async (data) => {
          if (!data.userId) {
            toast.error("Veuillez sélectionner un utilisateur");
            return;
          }

          try {
            if (editingAssignment) {
              await removeTeamAssignment(editingAssignment._id);
              await addTeamAssignment({
                projectId,
                userId: data.userId,
                projectRole: data.projectRole,
                level: data.level,
                entityId: data.entityId,
                entityName: data.entityName,
              });
              toast.success("Affectation modifiée");
            } else {
              await addTeamAssignment({
                projectId,
                userId: data.userId,
                projectRole: data.projectRole,
                level: data.level,
                entityId: data.entityId,
                entityName: data.entityName,
              });
              toast.success("Membre ajouté à l'équipe");
            }

            // Recharger l'équipe
            const team = await getProjectTeam(projectId);
            setTeamAssignments(team);
            const usersMap = new Map();
            for (const assignment of team) {
              const user = await getUserById(assignment.userId);
              if (user) {
                usersMap.set(assignment.userId, user);
              }
            }
            setTeamUsers(usersMap);

            setShowAddModal(false);
            setEditingAssignment(null);
          } catch (error) {
            console.error('Error saving team assignment:', error);
            toast.error("Erreur lors de l'enregistrement");
          }
        }}
        projectId={projectId}
        project={project}
        editingAssignment={editingAssignment}
      />

      {/* Modal de confirmation de suppression de membre */}
      <ConfirmDialog
        isOpen={deleteTeamConfirm !== null}
        title="Retirer le membre"
        message={`Êtes-vous sûr de vouloir retirer ${deleteTeamConfirm?.name} de l'équipe du projet ?`}
        confirmLabel="Retirer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={async () => {
          if (deleteTeamConfirm) {
            try {
              await removeTeamAssignment(deleteTeamConfirm.id);
              toast.success("Membre retiré de l'équipe");

              // Recharger l'équipe
              const team = await getProjectTeam(projectId);
              setTeamAssignments(team);
              const usersMap = new Map();
              for (const assignment of team) {
                const user = await getUserById(assignment.userId);
                if (user) {
                  usersMap.set(assignment.userId, user);
                }
              }
              setTeamUsers(usersMap);

              setDeleteTeamConfirm(null);
            } catch (error) {
              console.error('Error removing team member:', error);
              toast.error("Erreur lors de la suppression");
            }
          }
        }}
        onCancel={() => setDeleteTeamConfirm(null)}
      />

      {/* Modal de confirmation de suppression avec saisie du code */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowDeleteConfirm(false);
            setDeleteCodeInput("");
          }}
        >
          <div
            className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md border border-[var(--border-default)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-[var(--border-subtle)]">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Supprimer le projet
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Action irréversible
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-red-500/10 rounded-[var(--radius-md)] border border-red-500/20">
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  <strong>⚠️ Attention :</strong> Vous êtes sur le point de supprimer définitivement le projet{" "}
                  <strong>&quot;{project.name}&quot;</strong>. Cette action supprimera toutes les données associées
                  (structure, équipe, planification, documents, etc.).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  Pour confirmer, saisissez le code du projet : <strong className="text-[var(--text-primary)]">{project.code}</strong>
                </label>
                <input
                  type="text"
                  value={deleteCodeInput}
                  onChange={(e) => setDeleteCodeInput(e.target.value)}
                  placeholder={`Tapez ${project.code}`}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-5 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteCodeInput("");
                }}
                className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (deleteCodeInput === project.code) {
                    setShowDeleteConfirm(false);
                    setDeleteCodeInput("");
                    handleDelete();
                  }
                }}
                disabled={deleteCodeInput !== project.code || deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-[var(--radius-md)] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Trash2 size={14} />
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation pour les actions de structure */}
      <ConfirmDialog
        isOpen={confirmState !== null}
        title={confirmState?.title || ""}
        message={confirmState?.message || ""}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => {
          confirmState?.onConfirm();
          setConfirmState(null);
        }}
        onCancel={() => setConfirmState(null)}
      />

      {/* Modal de modifications non sauvegardées */}
      {showUnsavedChangesModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowUnsavedChangesModal(false)}
        >
          <div
            className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md border border-[var(--border-default)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-[var(--border-subtle)]">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-orange-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Modifications non sauvegardées
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Vous avez des modifications en cours
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Vous avez effectué des modifications qui ne sont pas encore enregistrées.
                Que souhaitez-vous faire ?
              </p>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 p-5 border-t border-[var(--border-subtle)]">
              <button
                onClick={async () => {
                  await handleSaveStructure();
                  setShowUnsavedChangesModal(false);
                  if (navigationTarget) {
                    setActiveTab(navigationTarget as "info" | "structure" | "team");
                    setNavigationTarget(null);
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-[var(--radius-md)] shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Save size={14} />
                Enregistrer et quitter
              </button>
              <button
                onClick={() => {
                  handleCancelEditing();
                  setShowUnsavedChangesModal(false);
                  if (navigationTarget) {
                    setActiveTab(navigationTarget as "info" | "structure" | "team");
                    setNavigationTarget(null);
                  }
                }}
                className="w-full px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Quitter sans enregistrer
              </button>
              <button
                onClick={() => setShowUnsavedChangesModal(false)}
                className="w-full px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Rester et continuer l'édition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

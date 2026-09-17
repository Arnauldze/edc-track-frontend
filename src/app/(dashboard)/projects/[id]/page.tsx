"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ACTIVITY_TYPES as TYPES_ACTIVITE, ACTIVITY_TYPE_ORDER } from "@/lib/activityTypes";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Settings, Users, Layers, Plus, Trash2, Edit2,
  ChevronUp, ChevronDown, ChevronRight, Save, MapPin, DollarSign, Calendar,
  Search, MoreHorizontal, AlertCircle, Info,
} from "lucide-react";
import { getProjectById, updateProject, deleteProject, isComponentLowestLevel, isSousComposantLowestLevel, type Project, type Component, type SousComposant } from "@/lib/projectStore";
import { getProjectTeam, getUserById, getUserDirectory, type TeamAssignment, type DirectoryUser, addTeamAssignment, removeTeamAssignment } from "@/lib/userStore";
import { PROJECT_ROLE_LABELS, rolePuce, getGrantableRoles, isProjectRole, type ProjectRole } from "@/lib/rbacStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AddMemberModal, { type MemberFormData } from "@/components/team/AddMemberModal";
import { ChangeChefModal } from "@/components/team/ChangeChefModal";
import { teamService } from "@/services/api/teamService";
import { getErrorMessage } from "@/services/api/client";
import { ProjectInfoCard } from "@/components/projects/ProjectInfoCard";
import { ProjectTeamCard } from "@/components/projects/ProjectTeamCard";
import { ComponentBudgetInput } from "@/components/projects/ComponentBudgetInput";
import { allocationStatus, formatShare, round2, shareOf, toFCFA } from "@/lib/componentBudget";
import { EditProjectInfoModal } from "@/components/projects/EditProjectInfoModal";
import { usePermissions } from "@/hooks/usePermissions";
import { DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";
import { newUnitId } from "@/lib/structureUnits";
import { canIndent, indentUnit, outdentUnit } from "@/lib/structureOps";
import { formatMoney } from "@/lib/utils";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";

type ConfirmState = {
  type: "component" | "subcomponent" | "activity";
  title: string;
  message: string;
  onConfirm: () => void;
} | null;

// ══════════════════════════════════════
// ACTIVITY TYPES
// ══════════════════════════════════════
// Les 5 types viennent de lib/activityTypes.ts ; seules les classes utilitaires
// sont dérivées ici, à partir des jetons --color-type-* du design system.
export const ACTIVITY_TYPES = ACTIVITY_TYPE_ORDER.map((id) => ({
  id,
  label: TYPES_ACTIVITE[id].label,
  color: TYPES_ACTIVITE[id].pastille,
  bgColor: TYPES_ACTIVITE[id].puce,
}));

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

  // Navigation guard
  const { blockNavigation, unblockNavigation } = useNavigationGuard();

  const [project, setProject] = useState<Project | undefined>(undefined);
  // Distingue « en cours de chargement » de « introuvable » : les deux laissaient
  // project à undefined, et la page affichait « Projet introuvable » avant le projet.
  const [projectLoading, setProjectLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "structure" | "team">("info");

  // Load project
  useEffect(() => {
    async function loadProject() {
      setProjectLoading(true);
      try {
        const proj = await getProjectById(projectId);
        setProject(proj);
        if (proj) {
          setComponents(proj.components || []);
        }
      } finally {
        setProjectLoading(false);
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
  // Source unique pour la carte Équipe de l'onglet Informations et pour
  // l'onglet Équipe : un ajout depuis l'une se reflète dans l'autre.
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [teamUsers, setTeamUsers] = useState<Map<string, DirectoryUser>>(new Map());
  const [teamLoading, setTeamLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeamAssignment | null>(null);
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState<{ id: string; name: string } | null>(null);
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);

  const { can, roles, isAdmin, canAccessInitialisation, loading: permissionsLoading } = usePermissions(projectId);

  // Initialisation n'est ouverte, projet par projet, qu'au chef de projet et aux
  // coordinateurs. Un utilisateur simple contributeur ici (même s'il est chef
  // ailleurs) consulte ce projet depuis Archives, Suivi ou Planification.
  useEffect(() => {
    if (permissionsLoading || canAccessInitialisation) return;
    toast.info("Vous contribuez à ce projet sans le gérer : consultez-le depuis Archives ou Suivi.");
    router.replace("/projects");
  }, [permissionsLoading, canAccessInitialisation, router]);

  const canEditStructure = can("structure:edit");
  // Lignes d'équipe modifiables : rôle que l'utilisateur est autorisé à attribuer
  // (un chef de projet gère ses contributeurs ; l'admin gère tout).
  const grantableRoles = getGrantableRoles(isAdmin, roles);
  const [showChangeChef, setShowChangeChef] = useState(false);
  const canManageAssignment = (role: string) => isProjectRole(role) && grantableRoles.includes(role);

  const reloadTeam = useCallback(async () => {
    try {
      // Équipe et annuaire en parallèle : deux requêtes, au lieu d'un
      // /users/:id séquentiel par membre.
      const [team, directory] = await Promise.all([getProjectTeam(projectId), getUserDirectory()]);
      const usersById = new Map(directory.map((u) => [u.id, u]));

      // L'annuaire ne liste que les comptes actifs. Un membre désactivé mais
      // encore affecté doit rester visible, ne serait-ce que pour pouvoir le retirer.
      const missing = [...new Set(team.map((a) => a.userId))].filter((id) => !usersById.has(id));
      const fallback = await Promise.all(missing.map((id) => getUserById(id)));
      for (const user of fallback) {
        if (user) usersById.set(user.id, user);
      }

      setTeamAssignments(team);
      setTeamUsers(usersById);
    } catch (error) {
      console.error("Error loading team:", error);
      toast.error("Impossible de charger l'équipe du projet");
    } finally {
      setTeamLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    reloadTeam();
  }, [reloadTeam]);

  // Un projet n'a qu'un chef ; plusieurs subsistent sur des données antérieures à la règle.
  const currentChefs = teamAssignments
    .filter((a) => a.projectRole === "chef_projet" && a.activeInProject)
    .map((a) => {
      const u = teamUsers.get(a.userId);
      return { userId: a.userId, name: u ? `${u.firstName} ${u.lastName}` : "Utilisateur inconnu" };
    });

  const openInviteModal = () => {
    setEditingAssignment(null);
    setShowAddModal(true);
  };

  const markChanged = () => setHasChanges(true);

  // ── Auto-save local (localStorage) ──
  const DRAFT_KEY = `project-structure-draft-${projectId}`;

  // Sauvegarder dans localStorage avec debounce
  useEffect(() => {
    if (isEditingStructure && hasChanges) {
      const timer = setTimeout(() => {
        const draft = {
          components,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        console.log('💾 Draft sauvegardé localement:', draft.timestamp);
      }, 2000); // Sauvegarde après 2 secondes d'inactivité

      return () => clearTimeout(timer);
    }
  }, [components, isEditingStructure, hasChanges, DRAFT_KEY]);

  // Vérifier s'il existe un draft au chargement
  useEffect(() => {
    const checkDraft = () => {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          const draftDate = new Date(draft.timestamp);
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - draftDate.getTime()) / 60000);

          if (diffMinutes < 60) { // Draft de moins d'1 heure
            const restore = confirm(
              `Une modification non enregistrée a été trouvée (${diffMinutes} minute(s) ago).\n\nVoulez-vous la restaurer ?`
            );
            if (restore) {
              setComponents(draft.components);
              toast.success("Brouillon restauré avec succès");
            } else {
              localStorage.removeItem(DRAFT_KEY);
            }
          } else {
            // Draft trop ancien, on le supprime
            localStorage.removeItem(DRAFT_KEY);
          }
        } catch (error) {
          console.error('Erreur lecture draft:', error);
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    };

    if (project && components.length > 0) {
      checkDraft();
    }
  }, [project]); // Exécuter une seule fois au chargement du projet

  // Nettoyer le draft après sauvegarde réussie
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    console.log('🗑️ Draft local supprimé');
  };

  // ── Protection beforeunload (fermeture onglet) ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditingStructure && hasChanges) {
        e.preventDefault();
        e.returnValue = ''; // Chrome nécessite returnValue
        return ''; // Certains navigateurs utilisent la valeur de retour
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditingStructure, hasChanges]);

  // ── Mode édition ──
  const handleStartEditing = () => {
    setOriginalComponents(JSON.parse(JSON.stringify(components)));
    setIsEditingStructure(true);
    setHasChanges(false);
    blockNavigation("Vous avez des modifications non enregistrées. Voulez-vous quitter sans enregistrer ?");
  };

  const handleCancelEditing = () => {
    setComponents(originalComponents);
    setIsEditingStructure(false);
    setHasChanges(false);
    clearDraft(); // Supprimer le draft local
    unblockNavigation();
  };

  const handleSaveStructure = async () => {
    console.log('💾 Début sauvegarde, components:', components);
    try {
      // La pondération enregistrée est la part du budget financé, déduite du montant.
      const withWeights = components.map((c) => ({
        ...c,
        ponderation: hasProjectBudget
          ? Math.min(100, round2(shareOf(toFCFA(c.budget, c.devise, exchangeRates), projectBudgetFCFA)))
          : c.ponderation,
      }));
      const result = await updateProject(projectId, { components: withWeights });
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
      clearDraft(); // Supprimer le draft local après succès
      unblockNavigation();
      toast.success("Structure du projet mise à jour");
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde:', error);
      // Le serveur explique ses refus (ex. unité qui porte encore une planification)
      toast.error(error?.response?.data?.message || error?.message || "Erreur lors de la sauvegarde");
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
    setComponents(prev => [...prev, { id: newUnitId("component"), name: "", sousComposants: [], typeActivite: "travaux" }]);
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
        sousComposants: [...c.sousComposants, { id: newUnitId("subcomponent"), name: "", activities: [] }]
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
    const newAct = { id: newUnitId("activity"), name: "", typeActivite: typeActivite as 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi' };
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
  // Une unité garde son identifiant en changeant de niveau : sa planification,
  // ses documents et ses affectations la suivent (voir lib/structureOps.ts).
  const demoteComponent = (ci: number) => {
    setComponents(prev => indentUnit(prev, prev[ci].id, exchangeRates));
    markChanged();
  };

  const promoteSC = (ci: number, si: number) => {
    setComponents(prev => outdentUnit(prev, prev[ci].sousComposants[si].id));
    markChanged();
  };

  const demoteSC = (ci: number, si: number) => {
    setComponents(prev => indentUnit(prev, prev[ci].sousComposants[si].id));
    markChanged();
  };

  const promoteActivity = (ci: number, si: number, ai: number) => {
    setComponents(prev => outdentUnit(prev, prev[ci].sousComposants[si].activities[ai].id));
    markChanged();
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
  // Référence des pourcentages : le budget financé. Sans financement, les parts
  // se calculent sur le total réparti, faute de mieux, et l'écran le signale.
  const hasProjectBudget = projectBudgetFCFA > 0;
  const budgetTotalFCFA = projectBudgetFCFA || allocatedBudgetFCFA;
  const totalPonderation = shareOf(allocatedBudgetFCFA, budgetTotalFCFA);
  const remainingBudgetFCFA = Math.max(budgetTotalFCFA - allocatedBudgetFCFA, 0);
  const status = hasProjectBudget ? allocationStatus(allocatedBudgetFCFA, projectBudgetFCFA) : "undefined";
  const statusColor =
    status === "balanced" ? "text-success" : status === "over" ? "text-danger" : status === "under" ? "text-warning" : "text-[var(--text-secondary)]";
  const statusBar =
    status === "balanced" ? "bg-success" : status === "over" ? "bg-danger" : status === "under" ? "bg-warning" : "bg-[var(--text-tertiary)]";
  const weightedComponents = components.map((component, index) => {
    const devise = component.devise || 'FCFA';
    const budget = component.budget || 0;
    const budgetFCFA = toFCFA(budget, devise, exchangeRates);
    return { component, index, devise, budget, budgetFCFA, percentage: shareOf(budgetFCFA, budgetTotalFCFA) };
  });
  const usedExchangeRates = Object.entries(exchangeRates)
    .filter(([devise]) => devise !== 'FCFA' && budgetParDevise[devise])
    .map(([devise, rate]) => `1 ${devise} = ${rate.toLocaleString('fr-FR')} FCFA`)
    .join(', ');

  if (projectLoading) {
    return <LoadingSpinner className="min-h-[60vh]" />;
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--text-secondary)]">Projet introuvable</p>
        <Link href="/projects" className="text-[var(--primary-text)] text-sm mt-2 inline-block">Retour</Link>
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
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-tertiary)] hover:text-[var(--primary-text)] transition-colors inline-flex"
          >
            <ChevronLeft size={14} /> Tous les projets
          </Link>
        </div>

        {/* Titre et boutons */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-on-primary shadow-[var(--shadow-sm)] flex-shrink-0">
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
            {/* Menu contextuel — seule action : suppression, réservée à l'admin */}
            {can("project:delete") && (
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
                  >
                    <Trash2 size={16} /> Supprimer le projet
                  </button>
                </div>
              )}
            </div>
            )}
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
                <span className="px-2.5 py-1 rounded-full bg-primary-subtle text-primary-fg border border-primary/20 text-[11px] font-semibold flex items-center gap-1.5">
                  <DollarSign size={12} />
                  {project.financement?.type || "MOP"} • {project.financement ? ((project.financement.budgetNational ? 1 : 0) + (project.financement.bailleurs?.length || 0) + (project.financement.partiesPubliques?.length || 0) + (project.financement.partiesPrivees?.length || 0)) : 5} financeurs
                </span>
              </div>

              {can("structure:edit") && (
                <button
                  onClick={() => setShowEditInfoModal(true)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)] text-on-primary rounded-[var(--radius-md)] text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Edit2 size={13} />
                  Modifier les informations
                </button>
              )}
            </div>

            {/* Layout 2 colonnes : Infos projet + Équipe */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              <ProjectInfoCard project={project} />
              <ProjectTeamCard
                assignments={teamAssignments}
                usersById={teamUsers}
                loading={teamLoading}
                onInvite={can("team:add") ? openInviteModal : undefined}
              />
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
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">{components.length}</strong> composant{components.length > 1 ? "s" : ""}
                      <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                      <strong className="text-[var(--text-primary)]">{totalSC}</strong> sous-composant{totalSC > 1 ? "s" : ""}
                      <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                      <strong className="text-[var(--text-primary)]">{totalActivities}</strong> activité{totalActivities > 1 ? "s" : ""}
                    </span>

                    {/* Types & navigation - Info sur hover */}
                    <div className="relative group inline-block">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] cursor-help hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors">
                        <Info size={13} className="text-[var(--primary-text)]" />
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
                    {!canEditStructure ? null : !isEditingStructure ? (
                      <button
                        onClick={handleStartEditing}
                        className="flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)] text-on-primary rounded-[var(--radius-md)] text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Edit2 size={13} />
                        Modifier la structure
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-warning font-semibold bg-warning-subtle px-2.5 py-1 rounded-[var(--radius-md)] border border-warning/20">
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-on-success rounded-[var(--radius-md)] text-xs font-semibold hover:bg-success transition-colors shadow-sm"
                        >
                          <Save size={13} />
                          Enregistrer
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arbre des composants */}
                <div className="space-y-3">
                    {components.map((comp, ci) => (
                      <div key={comp.id} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] px-4 py-3.5">
                        {/* Component header */}
                        <div className="flex items-start gap-2">
                          {comp.sousComposants.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleComponent(ci)}
                              className="mt-1 p-0.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all flex-shrink-0"
                              title={collapsedComponents.has(ci) ? "Déplier" : "Replier"}
                            >
                              <ChevronRight size={16} className={`transition-transform duration-200 ${collapsedComponents.has(ci) ? '' : 'rotate-90'}`} />
                            </button>
                          ) : (
                            <div className="w-[20px] flex-shrink-0" />
                          )}
                          <div className="mt-0.5 w-7 h-7 bg-primary-subtle text-primary-fg rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[10px] flex-shrink-0">C{ci + 1}</div>

                          <div className="flex-1 min-w-0">
                            {/* Ligne 1 : nom, type, actions */}
                            <div className="flex flex-wrap items-center gap-2">
                              {!isEditingStructure ? (
                                <span className="flex-1 min-w-0 text-[14px] font-bold text-[var(--text-primary)] py-1 break-words">{comp.name || "Sans nom"}</span>
                              ) : (
                                <input
                                  type="text"
                                  value={comp.name}
                                  onChange={e => updateComponentName(ci, e.target.value)}
                                  placeholder="Nom du composant..."
                                  className="flex-1 min-w-[12rem] bg-transparent border-b-2 border-[var(--border-subtle)] hover:border-[var(--border-default)] focus:border-[var(--primary)] outline-none text-[14px] font-bold text-[var(--text-primary)] px-1 py-1 transition-colors"
                                />
                              )}

                              {isComponentLowestLevel(comp) && (
                                !isEditingStructure ? (
                                  comp.typeActivite && (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${ACTIVITY_TYPES.find(t => t.id === comp.typeActivite)?.bgColor || ACTIVITY_TYPES[0].bgColor}`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_TYPES.find(t => t.id === comp.typeActivite)?.color || ACTIVITY_TYPES[0].color}`} />
                                      {ACTIVITY_TYPES.find(t => t.id === comp.typeActivite)?.label || "Travaux"}
                                    </span>
                                  )
                                ) : (
                                  <select value={comp.typeActivite || "travaux"} onChange={e => updateComponentType(ci, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[11px] font-semibold text-[var(--text-secondary)] px-2 py-1.5 focus:outline-none focus:border-[var(--primary)] cursor-pointer max-w-[11rem]">
                                    {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                  </select>
                                )
                              )}

                              {collapsedComponents.has(ci) && comp.sousComposants.length > 0 && (
                                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded-full">
                                  {comp.sousComposants.length} SC · {comp.sousComposants.reduce((sum, sc) => sum + sc.activities.length, 0)} Act.
                                </span>
                              )}

                              {isEditingStructure && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button type="button" onClick={() => demoteComponent(ci)} disabled={!canIndent(components, comp.id)} className="p-1 rounded-[var(--radius-sm)] hover:bg-warning-subtle text-warning disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Transformer en Sous-composant"><ChevronDown size={16} /></button>
                                  <button type="button" onClick={() => removeComponent(ci)} className="p-1 rounded-[var(--radius-sm)] hover:bg-danger-subtle text-danger/60 hover:text-danger transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                </div>
                              )}
                            </div>

                            {/* Ligne 2 : budget — montant ou pourcentage */}
                            <div className="mt-1.5">
                              {isEditingStructure ? (
                                <ComponentBudgetInput
                                  budget={comp.budget}
                                  devise={comp.devise}
                                  referenceFCFA={projectBudgetFCFA}
                                  rates={exchangeRates}
                                  onChange={({ budget, devise }) => {
                                    setComponents(prev => prev.map((c, i) => i === ci ? { ...c, budget, devise } : c));
                                    markChanged();
                                  }}
                                />
                              ) : comp.budget ? (
                                <span className="text-[12px] text-[var(--text-secondary)] tabular-nums">
                                  <span className="font-semibold text-[var(--text-primary)]">{formatMoney(comp.budget, 2)} {comp.devise || 'FCFA'}</span>
                                  {budgetTotalFCFA > 0 && (
                                    <span className="ml-2 text-[var(--text-tertiary)]">
                                      {formatShare(shareOf(toFCFA(comp.budget, comp.devise, exchangeRates), budgetTotalFCFA))} du budget
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-warning">Budget non défini</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Sous-composants */}
                        {!collapsedComponents.has(ci) && (
                          <div className="ml-9 pl-3 border-l-2 border-primary/20 space-y-1 mt-3">
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
                                  <div className="w-5 h-5 bg-warning-subtle text-warning rounded-[var(--radius-sm)] flex items-center justify-center font-bold text-[8px] flex-shrink-0">SC</div>

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
                                      <input type="text" value={sc.name} onChange={e => updateSCName(ci, si, e.target.value)} placeholder="Sous-composant..." className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-[var(--border-default)] focus:border-[var(--primary)] outline-none text-[12px] font-semibold text-[var(--text-secondary)] px-1 py-0.5 transition-colors" />
                                      {/* Type d'activité (si niveau le plus bas) */}
                                      {isSousComposantLowestLevel(sc) && (
                                        <select value={sc.typeActivite || "travaux"} onChange={e => updateSCType(ci, si, e.target.value)} className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[9px] font-semibold text-[var(--text-secondary)] px-1.5 py-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer w-[120px] flex-shrink-0">
                                          {ACTIVITY_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                        </select>
                                      )}
                                      {/* Boutons d'action — ordre uniforme : (monter) → (descendre) → (supprimer), gap-2 = 8px, icônes 16px */}
                                      <div className="flex items-center gap-2 flex-shrink-0 border-l border-[var(--border-subtle)] pl-2">
                                        <button type="button" onClick={() => promoteSC(ci, si)} className="p-1 rounded-[var(--radius-sm)] hover:bg-success-subtle text-success transition-all" title="Transformer en Composant"><ChevronUp size={16} /></button>
                                        <button type="button" onClick={() => demoteSC(ci, si)} disabled={!canIndent(components, sc.id)} className="p-1 rounded-[var(--radius-sm)] hover:bg-warning-subtle text-warning disabled:opacity-20 disabled:cursor-not-allowed transition-all" title="Transformer en Activité"><ChevronDown size={16} /></button>
                                        <button type="button" onClick={() => removeSousComposant(ci, si)} className="p-1 rounded-[var(--radius-sm)] hover:bg-danger-subtle text-danger/60 hover:text-danger transition-all" title="Supprimer"><Trash2 size={16} /></button>
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
                                  <div className="ml-7 pl-3 border-l border-warning/15 space-y-1 mt-0.5">
                                    {sc.activities.map((act, ai) => {
                                      const actName = getActivityName(act);
                                      const actType = getActivityType(act);
                                      const typeInfo = ACTIVITY_TYPES.find(t => t.id === actType) || ACTIVITY_TYPES[0];
                                      return (
                                        <div key={ai} className="flex flex-wrap items-center gap-1.5 py-0.5 group">
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
                                                className="flex-1 min-w-0 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] outline-none text-[11px] text-[var(--text-secondary)] px-2 py-1 focus:border-[var(--primary)] transition-colors"
                                              />
                                              {/* Type selector */}
                                              <select
                                                value={actType}
                                                onChange={e => updateActivityType(ci, si, ai, e.target.value)}
                                                className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--text-secondary)] px-1.5 py-1 focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer w-[140px] flex-shrink-0"
                                              >
                                                {ACTIVITY_TYPES.map(t => (
                                                  <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                              </select>
                                              {/* Boutons d'action — ordre uniforme : (monter) → (supprimer), gap-2 = 8px, icônes 16px */}
                                              <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity border-l border-[var(--border-subtle)] pl-2">
                                                <button type="button" onClick={() => promoteActivity(ci, si, ai)} className="p-1 rounded-[var(--radius-sm)] hover:bg-success-subtle text-success transition-all" title="Transformer en Sous-composant"><ChevronUp size={16} /></button>
                                                <button type="button" onClick={() => removeActivity(ci, si, ai)} className="p-1 rounded-[var(--radius-sm)] hover:bg-danger-subtle text-danger/60 hover:text-danger transition-all" title="Supprimer"><Trash2 size={16} /></button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Add activity with type dropdown (uniquement en mode édition) */}
                                    {isEditingStructure && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1 py-1">
                                        <button type="button" onClick={() => addActivity(ci, si, "travaux")} className="flex items-center gap-1 text-[10px] font-medium text-[var(--primary-text)] hover:underline"><Plus size={10} /> Activité</button>
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

              {/* SIDEBAR : synthèse budgétaire */}
              <aside className="order-2 xl:sticky xl:top-6 xl:max-h-[calc(100vh-6rem)] flex flex-col bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] overflow-hidden">
                {/* Budget financé */}
                <div className="px-4 py-3.5 border-b border-[var(--border-subtle)]">
                  <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Budget total</div>
                  <div className="mt-1 text-[18px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                    {formatMoney(budgetTotalFCFA, 2)} FCFA
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    {!hasProjectBudget
                      ? "Financement non renseigné : total des composants"
                      : usedExchangeRates || "Montant financé du projet"}
                  </div>
                </div>

                {/* Répartition globale */}
                <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Pondération totale</span>
                    <span className={`text-lg font-bold tabular-nums ${statusColor}`}>{formatShare(totalPonderation)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${statusBar}`} style={{ width: `${Math.min(totalPonderation, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="font-semibold text-[var(--text-primary)]">{formatMoney(allocatedBudgetFCFA, 2)} FCFA</span>
                    <span className="text-[var(--text-tertiary)]">/ {formatMoney(budgetTotalFCFA, 2)} FCFA</span>
                  </div>
                  <div className={`text-[11px] font-medium flex items-start gap-1.5 ${statusColor}`}>
                    {status === "balanced" && <span>✓ Budget entièrement réparti</span>}
                    {status === "under" && (
                      <>
                        <AlertCircle size={12} className="flex-shrink-0 mt-px" />
                        <span>Reste <strong>{formatMoney(remainingBudgetFCFA, 2)} FCFA</strong> à répartir ({formatShare(100 - totalPonderation)})</span>
                      </>
                    )}
                    {status === "over" && (
                      <>
                        <AlertCircle size={12} className="flex-shrink-0 mt-px" />
                        <span>Dépassement de <strong>{formatMoney(allocatedBudgetFCFA - budgetTotalFCFA, 2)} FCFA</strong> ({formatShare(totalPonderation - 100)})</span>
                      </>
                    )}
                    {status === "undefined" && <span>Renseignez le financement pour contrôler la répartition.</span>}
                  </div>
                </div>

                {/* Par composant */}
                <div className="px-4 py-3.5 flex flex-col min-h-0 flex-1">
                  <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2.5">Répartition par composante</div>
                  <div className="overflow-y-auto min-h-0 space-y-2.5 pr-1">
                    {weightedComponents.map(({ component, index, budget, devise, percentage }) => (
                      <div key={component.id}>
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className={`truncate font-semibold ${budget > 0 ? 'text-[var(--text-primary)]' : 'text-warning'}`}>
                            <span className="text-[10px] font-bold text-primary-fg mr-1.5">C{index + 1}</span>
                            {component.name || 'Sans nom'}
                          </span>
                          <span className="font-bold tabular-nums flex-shrink-0 text-[var(--text-primary)]">{formatShare(percentage)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percentage, 100)}%` }} />
                          </div>
                          <span className={`text-[10px] tabular-nums flex-shrink-0 ${budget > 0 ? 'text-[var(--text-tertiary)]' : 'text-warning'}`}>
                            {budget > 0 ? `${formatMoney(budget, 2)} ${devise}` : 'non défini'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  className="w-full pl-10 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                />
              </div>

              <div className="flex items-center gap-2">
                {can("team:edit") && grantableRoles.includes("chef_projet") && (
                  <button
                    onClick={() => setShowChangeChef(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-sm font-semibold hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    Changer le chef de projet
                  </button>
                )}
                {can("team:add") && (
                  <button
                    onClick={openInviteModal}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-on-primary rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Plus size={16} />
                    Ajouter un membre
                  </button>
                )}
              </div>
            </div>

            {currentChefs.length > 1 && (
              <div className="flex gap-2 p-3 rounded-[var(--radius-md)] bg-warning-subtle border border-warning/20 text-xs text-warning">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  Ce projet a {currentChefs.length} chefs de projet ({currentChefs.map((c) => c.name).join(", ")}).
                  Un projet n&apos;en a qu&apos;un : désignez-le avec « Changer le chef de projet ».
                </span>
              </div>
            )}

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
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-on-primary text-xs font-bold">
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
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${rolePuce(assignment.projectRole)} border`}>
                              {isProjectRole(assignment.projectRole) ? PROJECT_ROLE_LABELS[assignment.projectRole] : "Rôle retiré"}
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
                              {can("team:edit") && canManageAssignment(assignment.projectRole) && (
                              <button
                                onClick={() => {
                                  setEditingAssignment(assignment);
                                  setShowAddModal(true);
                                }}
                                className="p-1.5 rounded-[var(--radius-sm)] hover:bg-primary-subtle text-primary-fg transition-all"
                                title="Modifier"
                              >
                                <Edit2 size={14} />
                              </button>
                              )}
                              {can("team:remove") && canManageAssignment(assignment.projectRole) && (
                              <button
                                onClick={() => setDeleteTeamConfirm({ id: assignment._id, name: `${user.firstName} ${user.lastName}` })}
                                className="p-1.5 rounded-[var(--radius-sm)] hover:bg-danger-subtle text-danger transition-all"
                                title="Retirer"
                              >
                                <Trash2 size={14} />
                              </button>
                              )}
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
                  {can("team:add") && (
                    <button
                      onClick={openInviteModal}
                      className="text-[var(--primary-text)] text-sm font-semibold hover:underline mt-2 inline-block"
                    >
                      Ajouter le premier membre
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal d'édition des informations du projet */}
      <EditProjectInfoModal
        isOpen={showEditInfoModal}
        project={project}
        onClose={() => setShowEditInfoModal(false)}
        onSaved={(saved) => {
          setProject(saved);
          // Le serveur a pu réajuster les montants des composants. Une édition
          // de structure en cours reste prioritaire : elle sera enregistrée telle quelle.
          if (!isEditingStructure) setComponents(saved.components || []);
          setShowEditInfoModal(false);
        }}
      />

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
            if (editingAssignment && editingAssignment.userId === data.userId) {
              // Modification sur place. L'ancienne méthode (supprimer puis
              // recréer) retirait le membre si la recréation était refusée.
              await teamService.update(editingAssignment._id, {
                projectRole: data.projectRole,
                level: data.level,
                entityId: data.entityId,
                entityName: data.entityName,
              });
              toast.success("Affectation modifiée");
            } else if (editingAssignment) {
              // Autre personne : l'ajouter d'abord, retirer l'ancienne ensuite.
              await addTeamAssignment({
                projectId,
                userId: data.userId,
                projectRole: data.projectRole,
                level: data.level,
                entityId: data.entityId,
                entityName: data.entityName,
              });
              await removeTeamAssignment(editingAssignment._id);
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
            await reloadTeam();

            setShowAddModal(false);
            setEditingAssignment(null);
          } catch (error) {
            console.error('Error saving team assignment:', error);
            toast.error(getErrorMessage(error));
          }
        }}
        projectId={projectId}
        project={project}
        editingAssignment={editingAssignment}
        currentChef={currentChefs[0] ?? null}
      />

      <ChangeChefModal
        isOpen={showChangeChef}
        projectId={projectId}
        currentChefs={currentChefs}
        onClose={() => setShowChangeChef(false)}
        onChanged={reloadTeam}
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
              await reloadTeam();

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
              <div className="w-10 h-10 rounded-full bg-danger-subtle flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-danger" />
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
              <div className="p-3 bg-danger-subtle rounded-[var(--radius-md)] border border-danger/20">
                <p className="text-xs text-danger leading-relaxed">
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
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] focus:outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
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
                className="px-4 py-2 bg-danger hover:bg-danger-hover text-on-danger text-sm font-semibold rounded-[var(--radius-md)] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              <div className="w-10 h-10 rounded-full bg-warning-subtle flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} className="text-warning" />
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
                className="w-full px-4 py-2 bg-success hover:bg-success-hover text-on-success text-sm font-semibold rounded-[var(--radius-md)] shadow-sm transition-colors flex items-center justify-center gap-2"
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

"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ChevronRight, ChevronDown, Save, X, Calendar, Filter, Columns3, Search, RotateCcw,
  ArrowDown, ArrowUp, CalendarClock, CornerDownRight, ZoomIn, ZoomOut, FolderPlus, IndentDecrease, IndentIncrease, ListTree, Pencil, Plus, Trash2,
} from "lucide-react";
import type { Project } from "@/lib/projectStore";
import type { Planning, Livrable } from "@/services/api/planningService";
import { planningService } from "@/services/api/planningService";
import { projectService, type Component } from "@/services/api/projectService";
import { toast } from "@/lib/toastStore";
import { calculerCalendrierEtude, toDay } from "@/lib/livrableSchedule";
import { livrablePourApi, messageApi, tachePourApi } from "@/lib/livrableApi";
import type { LigneCalendrier } from "./PlanningCalendrierForm";
import { findUnit, listUnits, type UnitLevel } from "@/lib/structureUnits";
import {
  addChild, addComponent, addSibling, canAddChild, canIndent, canMoveDown, canMoveUp, canOutdent,
  indentUnit, moveUnitDown, moveUnitUp, outdentUnit, removeUnit, renameUnit, setUnitType, wbsNumbers,
  type ActivityType,
} from "@/lib/structureOps";
import { checkStructureChange, hasPlannedDescendant } from "@/lib/structureRules";
import { useStructureEditor } from "@/hooks/useStructureEditor";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StructureEditBar, StructureRowMenu, type StructureAction } from "./StructureEditBar";
import { PROJECT_ROOT_ID, formatBudget, formatDuration, rollupStructure, type Metrics } from "@/lib/planningRollup";
import { TIME_SCALES, buildTimeline, daysBetween, dateToX, suggestScale, xToDate, type TimeScale } from "@/lib/timescale";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 44;
/** En-tête du Gantt : bandeau supérieur + graduation = hauteur de l'en-tête du tableau. */
const GANTT_TOP_HEIGHT = 18;
const GANTT_BOTTOM_HEIGHT = HEADER_HEIGHT - GANTT_TOP_HEIGHT;
const SCALE_STORAGE_KEY = "edc.planification.echelle";

const ACTIVITY_COLORS: Record<string, string> = {
  travaux: "#4472C4",
  fourniture: "#ED7D31",
  services: "#70AD47",
  etudes: "#7030A0",
  pi: "#E84C88",
};

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  travaux: "Travaux",
  fourniture: "Fourniture",
  services: "Services",
  etudes: "Études",
  pi: "Prest. intellectuelles",
};

const NEW_UNIT_NAMES: Record<UnitLevel, string> = {
  component: "Nouveau composant",
  subcomponent: "Nouveau sous-composant",
  activity: "Nouvelle activité",
};
const CHILD_LEVEL: Record<UnitLevel, UnitLevel> = { component: "subcomponent", subcomponent: "activity", activity: "activity" };

const MSP_BAR_BLUE = "#4472C4";
const MSP_SUMMARY_COLOR = "#555555";
const MSP_TODAY_COLOR = "#70AD47";
const MSP_PROJECT_COLOR = "#1a5276";

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN DEFINITIONS (configurable)
// ═══════════════════════════════════════════════════════════════════════════

type ColumnFilterType = "text" | "number" | "date" | "ref" | "level";

interface ColumnDef {
  id: string;
  label: string;
  width: string;
  align: "left" | "center" | "right";
  defaultVisible: boolean;
  filterType: ColumnFilterType;
  field: string; // maps to TaskRow field
}

const COLUMN_DEFS: ColumnDef[] = [
  { id: "numero", label: "N°", width: "60px", align: "center", defaultVisible: true, filterType: "text", field: "numero" },
  { id: "nom", label: "Nom", width: "minmax(200px, 1fr)", align: "left", defaultVisible: true, filterType: "level", field: "nom" },
  { id: "type", label: "Type", width: "110px", align: "center", defaultVisible: true, filterType: "text", field: "activityType" },
  { id: "ponderation", label: "Pond.", width: "70px", align: "center", defaultVisible: true, filterType: "number", field: "ponderation" },
  { id: "dateDebut", label: "Début", width: "90px", align: "center", defaultVisible: true, filterType: "date", field: "dateDebut" },
  { id: "dateFin", label: "Fin", width: "90px", align: "center", defaultVisible: true, filterType: "date", field: "dateFin" },
  { id: "duree", label: "Durée", width: "70px", align: "center", defaultVisible: true, filterType: "number", field: "duree" },
  { id: "avancement", label: "Avanc.", width: "90px", align: "center", defaultVisible: true, filterType: "number", field: "progress" },
  { id: "budget", label: "Budget", width: "80px", align: "right", defaultVisible: true, filterType: "number", field: "budget" },
  { id: "delai", label: "Délai", width: "70px", align: "center", defaultVisible: true, filterType: "number", field: "delai" },
  { id: "dateEcheance", label: "Échéance", width: "90px", align: "center", defaultVisible: true, filterType: "date", field: "dateEcheance" },
  { id: "predecesseur", label: "Préd.", width: "60px", align: "center", defaultVisible: true, filterType: "ref", field: "predecesseur" },
  { id: "successeur", label: "Succ.", width: "60px", align: "center", defaultVisible: true, filterType: "ref", field: "successeur" },
];

interface ColumnFilter {
  columnId: string;
  value: string; // text search or min value
  value2?: string; // max value for ranges
}

/** Get the native duration unit suffix for a task type (MS Project style: each task keeps its unit) */
const getDurationSuffix = (taskType: string): string => {
  // Livrables (Étude) and summary rows aggregate in months
  if (taskType === "livrable" || taskType === "project" || taskType === "component" || taskType === "subcomponent") return " m";
  // Activities default to months (livrables are in months)
  if (taskType === "activity") return " m";
  return " j";
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MSProjectViewV2Props {
  project: Project;
  plannings: Planning[];
  onRefresh: () => void;
  onActivityClick?: (activityPath: string) => void;
  focusedActivityPath?: string;
  /** Chef de projet ou admin : peut modifier la structure dans le tableau. */
  canEditStructure?: boolean;
  /** Structure enregistrée : le parent recharge projet et planifications. */
  onStructureSaved?: (project: Project) => void;
}

interface TaskRow {
  id: string;
  numero: string; // PRJ, numérotation WBS (1, 1.2, 1.2.3), R1, T1...
  nom: string;
  level: number;
  /** « activity » = unité fine, planifiable, quel que soit son niveau. */
  type: "project" | "component" | "subcomponent" | "activity" | "livrable";
  /** Identifiant de l'unité de structure (absent pour le projet et les livrables). */
  unitId?: string;
  activityPath?: string;
  activityType?: string;
  hasChildren: boolean;
  isExpanded: boolean;
  
  // Données de planification
  ponderation?: number;
  dateDebut?: string | Date;
  dateFin?: string | Date;
  duree?: number;
  dureeUnite?: string; // jours, semaines, mois
  delai?: number;
  delaiUnite?: string; // jours, semaines, mois
  dateEcheance?: string | Date;
  predecesseur?: string;
  successeur?: string;
  
  // Synthèse (voir lib/planningRollup.ts)
  /** Durée calculée, déjà mise en forme (unités de structure). */
  dureeLabel?: string;
  progress?: number;
  budget?: number;
  milestone?: boolean;
  /** Unités planifiables couvertes / planifiées (lignes de synthèse). */
  leaves?: number;
  plannedLeaves?: number;

  // Métadonnées
  parentId?: string;
  planning?: Planning;
  /** Livrable d'étude ou tâche d'exécution affiché sur la ligne. */
  livrableData?: LigneCalendrier;
  /** Phase de la ligne : livrable d'étude ou tâche d'exécution. */
  phase?: PhaseLignes;
}

type PhaseLignes = "etude" | "execution";
/** Champ de la planification qui porte les lignes de chaque phase. */
const CHAMP_PHASE: Record<PhaseLignes, "livrables" | "tachesExecution"> = { etude: "livrables", execution: "tachesExecution" };
/** Lignes modifiées dans le tableau, par activité et par phase. */
const cleLignes = (activityPath: string, phase: PhaseLignes) => `${activityPath}|${phase}`;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════

const formatDate = (dateStr?: string | Date): string => {
  if (!dateStr) return "—";
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
};

const parseDate = (dateStr: string | Date): Date | null => {
  if (!dateStr) return null;
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

/** Avancement : pourcentage et jauge ; sur une synthèse, unités planifiées / unités. */
function ProgressCell({ value, summary, planned, total }: { value?: number; summary: boolean; planned?: number; total?: number }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      title={summary && total ? `${planned ?? 0} unité(s) planifiée(s) sur ${total}` : undefined}
      style={{ display: "flex", alignItems: "center", gap: 5, height: ROW_HEIGHT, padding: "0 6px" }}
    >
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--msp-border)", overflow: "hidden" }}>
        {value !== undefined && <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? MSP_TODAY_COLOR : MSP_BAR_BLUE }} />}
      </div>
      <span style={{ fontSize: 10, minWidth: 30, textAlign: "right", color: value === undefined ? "var(--msp-text-muted)" : "inherit" }}>
        {value === undefined ? "—" : `${Math.round(value)} %`}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function MSProjectViewV2({
  project,
  plannings,
  onRefresh,
  onActivityClick,
  focusedActivityPath,
  canEditStructure = false,
  onStructureSaved,
}: MSProjectViewV2Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    initialExpanded.add("project-root"); // Projet expanded by default
    project.components.forEach((comp) => {
      initialExpanded.add(comp.id);
    });
    return initialExpanded;
  });

  // ── Édition de la structure ──
  // La structure affichée est le brouillon pendant l'édition, celle du projet sinon.
  const editor = useStructureEditor();
  const structure = editor.draft ?? project.components;
  const units = useMemo(() => listUnits(structure), [structure]);
  const wbs = useMemo(() => wbsNumbers(structure), [structure]);
  const plannedIds = useMemo(() => new Set(plannings.map((p) => p.activityPath)), [plannings]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; message: string } | null>(null);
  const [savingStructure, setSavingStructure] = useState(false);
  const { blockNavigation, unblockNavigation } = useNavigationGuard();
  
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedLivrables, setModifiedLivrables] = useState<Map<string, LigneCalendrier[]>>(new Map());

  /** Lignes d'une phase : celles modifiées dans le tableau, sinon celles enregistrées. */
  const lignesDe = (planning: Planning | undefined, activityPath: string, phase: PhaseLignes): LigneCalendrier[] =>
    modifiedLivrables.get(cleLignes(activityPath, phase)) ?? ((planning?.[CHAMP_PHASE[phase]] ?? []) as LigneCalendrier[]);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(COLUMN_DEFS.filter(c => c.defaultVisible).map(c => c.id))
  );
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Column filters
  const [activeFilters, setActiveFilters] = useState<Map<string, ColumnFilter>>(new Map());
  const [filterDropdown, setFilterDropdown] = useState<string | null>(null); // column id of open filter
  const [filterInputs, setFilterInputs] = useState<{ value: string; value2?: string }>({ value: "" });

  // Level filter for NOM column: controls which hierarchy depth is visible
  type LevelFilterValue = "all" | "components" | "subcomponents" | "activities" | "livrables";
  const [levelFilter, setLevelFilter] = useState<LevelFilterValue>("all");

  // Computed: visible columns and dynamic grid template
  const columnsVisible = useMemo(() => COLUMN_DEFS.filter(c => visibleColumns.has(c.id)), [visibleColumns]);
  const gridTemplate = useMemo(() => columnsVisible.map(c => c.width).join(" "), [columnsVisible]);
  
  // Échelle de temps : choix mémorisé sur ce navigateur, sinon déduite de la durée du projet
  const [chosenScale, setChosenScale] = useState<TimeScale | null>(null);
  const [ganttViewportWidth, setGanttViewportWidth] = useState(0);
  /** Date à garder au bord gauche après un changement d'échelle. */
  const scrollAnchorRef = useRef<Date | null>(null);
  const initialScrollDoneRef = useRef(false);
  
  // Refs pour synchroniser le scroll
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);
  
  // État pour le redimensionnement
  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTION DE L'ARBRE
  // ═══════════════════════════════════════════════════════════════════════════

  /** Mesures de chaque unité, livrables et tâches en cours de modification compris. */
  const metrics = useMemo(() => {
    const current = plannings.map((p) => ({
      ...p,
      livrables: (modifiedLivrables.get(cleLignes(p.activityPath, "etude")) ?? p.livrables) as Livrable[],
      tachesExecution: (modifiedLivrables.get(cleLignes(p.activityPath, "execution")) ?? p.tachesExecution) as Planning["tachesExecution"],
    }));
    return rollupStructure(structure, current);
  }, [structure, plannings, modifiedLivrables]);

  const buildTaskTree = useCallback(() => {
    const rows: TaskRow[] = [];

    const findPlanning = (path: string) => plannings.find((p) => p.activityPath === path);

    const isoDay = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined);
    const fromMetrics = (m: Metrics | undefined) => ({
      dateDebut: isoDay(m?.start),
      dateFin: isoDay(m?.finish),
      dureeLabel: formatDuration(m?.days),
      ponderation: m?.weight,
      progress: m?.progress,
      budget: m?.budget,
      milestone: m?.milestone,
      leaves: m?.leaves,
      plannedLeaves: m?.plannedLeaves,
    });

    // Arbre uniforme des unités : composant › sous-composant › activité.
    // Une unité sans enfant est planifiable, quel que soit son niveau.
    interface Node { id: string; name: string; typeActivite?: string; children: Node[] }
    const nodes: Node[] = structure.map((c) => ({
      id: c.id,
      name: c.name,
      typeActivite: c.typeActivite,
      children: (c.sousComposants ?? []).map((sc) => ({
        id: sc.id,
        name: sc.name,
        typeActivite: sc.typeActivite,
        children: (sc.activities ?? []).map((a) => ({ id: a.id, name: a.name, typeActivite: a.typeActivite, children: [] })),
      })),
    }));

    rows.push({
      id: "project-root",
      numero: "PRJ",
      nom: project.name,
      level: 0,
      type: "project",
      hasChildren: nodes.length > 0,
      isExpanded: expandedIds.has("project-root"),
      ...fromMetrics(metrics.get(PROJECT_ROOT_ID)),
    });

    /** Lignes d'une phase sous l'activité : livrables d'étude, puis tâches d'exécution. */
    const pushLivrables = (activityPath: string, phase: PhaseLignes, livrables: LigneCalendrier[], level: number) => {
      livrables.forEach((liv) => {
        rows.push({
          id: `${activityPath}.${phase}.${liv.numero}`,
          numero: liv.numero,
          nom: (phase === "etude" ? liv.intitule : liv.designation) ?? "",
          level,
          type: "livrable",
          phase,
          activityPath,
          hasChildren: false,
          isExpanded: false,
          parentId: activityPath,
          livrableData: liv,
          ponderation: liv.ponderation,
          progress:
            phase === "etude"
              ? ((liv as Livrable).statut === "valide" ? 100 : 0)
              : ((liv as { avancement?: number }).avancement ?? 0),
          milestone: !liv.dateDebut && !liv.dateFin && !!liv.dateEcheance,
          dateDebut: toDay(liv.dateDebut ?? (liv.dateFin ? undefined : liv.dateEcheance)),
          dateFin: toDay(liv.dateFin ?? liv.dateEcheance),
          duree: liv.duree,
          dureeUnite: liv.dureeUnite,
          delai: liv.delai,
          delaiUnite: liv.delaiUnite,
          dateEcheance: toDay(liv.dateEcheance ?? liv.dateFin),
          predecesseur: liv.predecesseur,
          successeur: liv.successeur,
        });
      });
    };

    const walk = (list: Node[], level: number, parentId: string) => {
      list.forEach((node) => {
        const common = {
          id: node.id,
          unitId: node.id,
          numero: wbs.get(node.id) ?? "",
          nom: node.name,
          level,
          parentId,
          isExpanded: expandedIds.has(node.id),
        };

        if (node.children.length === 0) {
          const planning = findPlanning(node.id);
          const livrables = lignesDe(planning, node.id, "etude");
          const tachesExecution = lignesDe(planning, node.id, "execution");
          rows.push({
            ...common,
            type: "activity",
            activityPath: node.id,
            activityType: node.typeActivite || "travaux",
            hasChildren: livrables.length + tachesExecution.length > 0,
            planning,
            ...fromMetrics(metrics.get(node.id)),
          });
          if (expandedIds.has(node.id)) {
            pushLivrables(node.id, "etude", livrables, level + 1);
            pushLivrables(node.id, "execution", tachesExecution, level + 1);
          }
          return;
        }

        rows.push({
          ...common,
          type: level === 1 ? "component" : "subcomponent",
          hasChildren: true,
          ...fromMetrics(metrics.get(node.id)),
        });
        if (expandedIds.has(node.id)) walk(node.children, level + 1, node.id);
      });
    };

    if (expandedIds.has("project-root")) walk(nodes, 1, "project-root");

    setTasks(rows);
  }, [project.name, structure, wbs, plannings, expandedIds, modifiedLivrables, metrics]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMELINE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Première et dernière date présentes dans les planifications. */
  const dataRange = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    const track = (value: string | Date | undefined) => {
      if (!value) return;
      const d = new Date(value);
      if (isNaN(d.getTime())) return;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    };
    plannings.forEach((p) => {
      track(p.dateDebutActualisee || p.dateDebutInitiale);
      track(p.dateFinActualisee || p.dateFinInitiale);
      p.livrables?.forEach((liv) => { track(liv.dateDebut); track(liv.dateFin || liv.dateEcheance); });
      p.tachesExecution?.forEach((tache) => { track(tache.dateDebut); track(tache.dateFin); });
      p.etapesPassation?.forEach((etape) => { track(etape.dateDebut); track(etape.dateFin); });
    });
    return { start: min as Date | null, end: max as Date | null };
  }, [plannings]);

  useEffect(() => {
    buildTaskTree();
  }, [buildTaskTree]);

  // Auto-expand focused activity and all its parents when focusedActivityPath changes
  useEffect(() => {
    if (!focusedActivityPath) return;
    
    setExpandedIds(prev => {
      const next = new Set(prev);
      // Déplier les parents de l'unité : composant, puis sous-composant
      next.add("project-root");
      findUnit(project.components, focusedActivityPath)?.ancestors.forEach((id) => next.add(id));
      // Expand the activity itself (to show its livrables)
      next.add(focusedActivityPath);
      
      return next;
    });
  }, [focusedActivityPath, plannings, project.components]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED DAYS & WEEKS
  // ═══════════════════════════════════════════════════════════════════════════

  const scale = chosenScale ?? suggestScale(dataRange.start, dataRange.end);
  const timeline = useMemo(
    () => buildTimeline(dataRange.start, dataRange.end, scale, ganttViewportWidth),
    [dataRange, scale, ganttViewportWidth],
  );
  const totalGanttWidth = timeline.width;

  useEffect(() => {
    const saved = localStorage.getItem(SCALE_STORAGE_KEY) as TimeScale | null;
    if (saved && TIME_SCALES.some((s) => s.id === saved)) setChosenScale(saved);
  }, []);

  // Largeur visible du Gantt : la période est prolongée pour la remplir.
  useEffect(() => {
    const body = rightBodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(() => setGanttViewportWidth(body.clientWidth));
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  /** Change d'échelle en gardant la même date au bord gauche. */
  const changeScale = useCallback(
    (next: TimeScale) => {
      if (next === scale) return;
      scrollAnchorRef.current = xToDate(timeline, rightBodyRef.current?.scrollLeft ?? 0);
      setChosenScale(next);
      localStorage.setItem(SCALE_STORAGE_KEY, next);
    },
    [scale, timeline],
  );

  const zoom = useCallback(
    (direction: 1 | -1) => {
      const index = TIME_SCALES.findIndex((s) => s.id === scale);
      const next = TIME_SCALES[index - direction];
      if (next) changeScale(next.id);
    },
    [scale, changeScale],
  );

  const scrollToDate = useCallback((date: Date, align: "start" | "center" = "center") => {
    const body = rightBodyRef.current;
    if (!body) return;
    const x = dateToX(timeline, date);
    body.scrollLeft = Math.max(0, align === "center" ? x - body.clientWidth / 2 : x - 40);
  }, [timeline]);

  // Après un changement d'échelle : retrouver la date ancrée. Au premier affichage :
  // se placer sur le début des travaux, ou sur aujourd'hui.
  useEffect(() => {
    const body = rightBodyRef.current;
    if (!body || ganttViewportWidth === 0) return;
    if (scrollAnchorRef.current) {
      body.scrollLeft = dateToX(timeline, scrollAnchorRef.current);
      scrollAnchorRef.current = null;
    } else if (!initialScrollDoneRef.current) {
      scrollToDate(dataRange.start ?? new Date(), dataRange.start ? "start" : "center");
      initialScrollDoneRef.current = true;
    }
    if (rightHeaderRef.current) rightHeaderRef.current.scrollLeft = body.scrollLeft;
  }, [timeline, ganttViewportWidth, dataRange.start, scrollToDate]);

  // Ctrl + molette sur le Gantt : zoom, comme dans MS Project.
  useEffect(() => {
    const body = rightBodyRef.current;
    if (!body) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1 : -1);
    };
    body.addEventListener("wheel", onWheel, { passive: false });
    return () => body.removeEventListener("wheel", onWheel);
  }, [zoom]);


  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Date T0 d'une planification : point de départ des livrables sans prédécesseur ni début saisi. */
  const t0De = (planning?: Planning) => toDay((planning?.dateDebutInitiale ?? planning?.dateT0Etude) as string | undefined);

  /**
   * Modification d'un livrable ou d'une tâche dans le tableau. Comme sur la page de l'activité,
   * la valeur saisie devient celle qui fixe le début ou l'échéance, et le
   * calendrier est recalculé par le moteur commun (lib/livrableSchedule.ts).
   */
  const handleCellChange = (task: TaskRow, field: string, value: string) => {
    if (task.type !== "livrable" || !task.activityPath || !task.phase) return;

    const activityPath = task.activityPath;
    const phase = task.phase;
    const planning = plannings.find((p) => p.activityPath === activityPath);
    const currentLivrables = lignesDe(planning, activityPath, phase);
    const index = currentLivrables.findIndex((l) => l.numero === task.numero);
    if (index === -1) return;

    const nombre = value === "" ? undefined : parseFloat(value.replace(",", "."));
    const patch: Partial<LigneCalendrier> =
      field === "ponderation" ? { ponderation: nombre ?? 0 }
      : field === "duree" ? { duree: nombre, modeFin: "duree" }
      : field === "delai" ? { delai: nombre, modeFin: "delai" }
      : field === "dateFin" || field === "dateEcheance" ? { dateFin: value || undefined, modeFin: "fin" }
      : field === "dateDebut" ? (value ? { dateDebut: value, debutFixe: true } : { dateDebut: undefined, debutFixe: false })
      : field === "predecesseur" ? { predecesseur: value }
      : {};

    const modifies = currentLivrables.map((l, i) => (i === index ? { ...l, ...patch } : l));
    const { livrables: calcules } = calculerCalendrierEtude(modifies, t0De(planning));
    setModifiedLivrables((prev) => new Map(prev).set(cleLignes(activityPath, phase), calcules));
    setHasChanges(true);
  };

  /** Problèmes des lignes modifiées, par activité et phase : l'enregistrement est bloqué tant qu'il en reste. */
  const problemesLivrables = useMemo(() => {
    const messages: string[] = [];
    for (const [cle, lignes] of modifiedLivrables.entries()) {
      const [activityPath, phase] = cle.split("|");
      const planning = plannings.find((p) => p.activityPath === activityPath);
      const { problemes } = calculerCalendrierEtude(lignes, t0De(planning));
      const libelle = `${planning?.activityName ?? activityPath} (${phase === "etude" ? "étude" : "exécution"})`;
      [...new Set(problemes.map((p) => p.message))].forEach((m) => messages.push(`${libelle} : ${m}`));
    }
    return messages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifiedLivrables, plannings]);

  const handleSave = async () => {
    if (problemesLivrables.length) {
      toast.error(problemesLivrables[0]);
      return;
    }
    try {
      // Une mise à jour par activité, avec les phases modifiées
      const parActivite = new Map<string, Record<string, unknown>>();
      for (const [cle, lignes] of modifiedLivrables.entries()) {
        const [activityPath, phase] = cle.split("|") as [string, PhaseLignes];
        const envoi = parActivite.get(activityPath) ?? {};
        envoi[CHAMP_PHASE[phase]] =
          phase === "etude" ? (lignes as Livrable[]).map(livrablePourApi) : (lignes as Planning["tachesExecution"]).map(tachePourApi);
        parActivite.set(activityPath, envoi);
      }
      for (const [activityPath, envoi] of parActivite.entries()) {
        await planningService.update(project.code, activityPath, envoi as Parameters<typeof planningService.update>[2]);
      }
      toast.success("Modifications enregistrées");
      setHasChanges(false);
      setModifiedLivrables(new Map());
      onRefresh();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error(messageApi(error, "Erreur lors de l'enregistrement"));
    }
  };

  const handleCancel = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setModifiedLivrables(new Map());
    setHasChanges(false);
    buildTaskTree();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉDITION DE LA STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedId) ?? null, [units, selectedId]);
  const rates = project.financement?.tauxChange as Record<string, number> | undefined;

  /** Déplie les parents d'une unité pour qu'elle soit visible. */
  const reveal = useCallback((components: Component[], id: string) => {
    const unit = findUnit(components, id);
    if (!unit) return;
    setExpandedIds((prev) => new Set([...prev, "project-root", ...unit.ancestors]));
  }, []);

  /**
   * Applique une nouvelle version du brouillon après vérification des règles
   * de planification. Renvoie false si elle est refusée ou sans effet.
   */
  const commit = useCallback(
    (next: Component[], focusId?: string | null) => {
      const draft = editor.draft;
      if (!draft || next === draft) return false;

      const check = checkStructureChange(project.components, next, plannedIds);
      if (check.error) {
        toast.error(check.error);
        return false;
      }
      const known = new Set(checkStructureChange(project.components, draft, plannedIds).notices);
      check.notices.filter((notice) => !known.has(notice)).forEach((notice) => toast.info(notice));

      editor.apply(next);
      if (focusId) {
        setSelectedId(focusId);
        reveal(next, focusId);
      }
      return true;
    },
    [editor, project.components, plannedIds, reveal],
  );

  const startStructureEdit = () => {
    editor.start(project.components);
    setSelectedId(null);
    setEditingCell(null);
  };

  const closeStructureEdit = () => {
    if (editor.changeCount > 0 && !confirm("Abandonner les modifications de la structure ?")) return;
    editor.stop();
    setSelectedId(null);
    setRenaming(null);
  };

  const startRename = (id: string, components: Component[] = structure) => {
    const unit = findUnit(components, id);
    if (unit) setRenaming({ id, value: unit.name });
  };

  const finishRename = (save: boolean) => {
    if (!renaming || !editor.draft) return;
    const name = renaming.value.trim();
    setRenaming(null);
    if (save && name) commit(renameUnit(editor.draft, renaming.id, name));
  };

  /** Insère une unité puis ouvre son nom à la saisie. */
  const insert = (result: { components: Component[]; id: string | null }) => {
    if (result.id && commit(result.components, result.id)) startRename(result.id, result.components);
  };

  const requestDelete = (id: string) => {
    const unit = findUnit(structure, id);
    if (!unit) return;
    if (hasPlannedDescendant(structure, id, plannedIds)) {
      toast.error(`« ${unit.name} » ou l'une de ses sous-unités est planifiée : supprimez d'abord la planification.`);
      return;
    }
    const descendants = units.filter((u) => u.ancestors.includes(id)).length;
    setPendingDelete({
      id,
      message:
        `« ${unit.name} »` +
        (descendants ? ` et ses ${descendants} sous-unité${descendants > 1 ? "s" : ""}` : "") +
        " seront retirés de la structure à l'enregistrement.",
    });
  };

  const structureActions = useMemo((): StructureAction[] => {
    if (!editor.draft) return [];
    const draft = editor.draft;
    const sel = selectedUnit;
    const none = "Sélectionnez une ligne";
    const childLevel = sel ? CHILD_LEVEL[sel.level] : "activity";
    return [
      {
        key: "add-component", label: "Composant", icon: FolderPlus, enabled: true,
        run: () => insert(addComponent(draft, NEW_UNIT_NAMES.component)),
      },
      {
        key: "add-sibling", label: "Insérer", icon: Plus, shortcut: "Inser", enabled: !!sel, hint: none,
        run: () => sel && insert(addSibling(draft, sel.id, NEW_UNIT_NAMES[sel.level], sel.typeActivite as ActivityType | undefined)),
      },
      {
        key: "add-child", label: "Décomposer", icon: CornerDownRight, shortcut: "Ctrl+Inser",
        enabled: !!sel && canAddChild(draft, sel.id),
        hint: sel ? "Trois niveaux au plus : une activité ne se décompose pas" : none,
        run: () => sel && insert(addChild(draft, sel.id, NEW_UNIT_NAMES[childLevel])),
      },
      {
        key: "outdent", label: "Hausser", icon: IndentDecrease, shortcut: "Alt+Maj+←", separator: true,
        enabled: !!sel && canOutdent(draft, sel.id), hint: sel ? "Déjà au niveau composant" : none,
        run: () => sel && commit(outdentUnit(draft, sel.id), sel.id),
      },
      {
        key: "indent", label: "Abaisser", icon: IndentIncrease, shortcut: "Alt+Maj+→",
        enabled: !!sel && canIndent(draft, sel.id),
        hint: sel ? "Il faut une unité au-dessus, et trois niveaux au plus" : none,
        run: () => sel && commit(indentUnit(draft, sel.id, rates), sel.id),
      },
      {
        key: "up", label: "Monter", icon: ArrowUp, shortcut: "Alt+Maj+↑",
        enabled: !!sel && canMoveUp(draft, sel.id), hint: sel ? "Déjà en tête" : none,
        run: () => sel && commit(moveUnitUp(draft, sel.id), sel.id),
      },
      {
        key: "down", label: "Descendre", icon: ArrowDown, shortcut: "Alt+Maj+↓",
        enabled: !!sel && canMoveDown(draft, sel.id), hint: sel ? "Déjà en dernier" : none,
        run: () => sel && commit(moveUnitDown(draft, sel.id), sel.id),
      },
      {
        key: "rename", label: "Renommer", icon: Pencil, shortcut: "F2", separator: true, enabled: !!sel, hint: none,
        run: () => sel && startRename(sel.id),
      },
      {
        key: "delete", label: "Supprimer", icon: Trash2, shortcut: "Suppr", danger: true, enabled: !!sel, hint: none,
        run: () => sel && requestDelete(sel.id),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.draft, selectedUnit, rates, plannedIds, units]);

  const saveStructure = async () => {
    const draft = editor.draft;
    if (!draft) return;
    const unnamed = listUnits(draft).find((u) => !u.name.trim());
    if (unnamed) {
      toast.error("Chaque unité doit avoir un nom.");
      setSelectedId(unnamed.id);
      return;
    }
    setSavingStructure(true);
    try {
      const saved = await projectService.update(project.code, { components: draft });
      editor.stop();
      setSelectedId(null);
      toast.success("Structure du projet enregistrée");
      onStructureSaved?.(saved);
    } catch (error) {
      // Refus du serveur (ex. 409 : unité qui porte des documents) : son message est explicite.
      const { response, message } = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(response?.data?.message || message || "Impossible d'enregistrer la structure");
    } finally {
      setSavingStructure(false);
    }
  };

  // Modifications non enregistrées : prévenir avant de quitter la page.
  const structureDirty = editor.changeCount > 0;
  useEffect(() => {
    if (!structureDirty) return;
    blockNavigation("La structure a des modifications non enregistrées. Quitter sans enregistrer ?");
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unblockNavigation();
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [structureDirty, blockNavigation, unblockNavigation]);

  // Raccourcis clavier, inspirés de MS Project
  useEffect(() => {
    if (!editor.isEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (renaming || pendingDelete || target.closest("input, select, textarea")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const run = (key: string) => {
        const action = structureActions.find((a) => a.key === key);
        if (!action?.enabled) return;
        e.preventDefault();
        action.run();
      };

      if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); editor.undo(); return; }
      if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); editor.redo(); return; }
      if (e.altKey && e.shiftKey) {
        if (e.key === "ArrowRight") return run("indent");
        if (e.key === "ArrowLeft") return run("outdent");
        if (e.key === "ArrowUp") return run("up");
        if (e.key === "ArrowDown") return run("down");
      }
      if (e.key === "Insert") return run(ctrl ? "add-child" : "add-sibling");
      if (e.key === "Delete") return run("delete");
      if (e.key === "F2") return run("rename");
      if (e.key === "Escape") setSelectedId(null);
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.altKey) {
        const visible = filteredTasks.filter((t) => t.unitId);
        const index = visible.findIndex((t) => t.unitId === selectedId);
        const nextRow = visible[e.key === "ArrowUp" ? Math.max(0, index - 1) : Math.min(visible.length - 1, index + 1)];
        if (nextRow?.unitId) { e.preventDefault(); setSelectedId(nextRow.unitId); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMN VISIBILITY & FILTERS
  // ═══════════════════════════════════════════════════════════════════════════

  const toggleColumn = (colId: string) => {
    // Prevent hiding N° and Nom
    if (colId === "numero" || colId === "nom") return;
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(new Set(COLUMN_DEFS.filter(c => c.defaultVisible).map(c => c.id)));
  };

  const handleHeaderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setFilterDropdown(null);
  };

  const applyFilter = (columnId: string) => {
    if (!filterInputs.value && !filterInputs.value2) {
      clearFilter(columnId);
      return;
    }
    setActiveFilters(prev => {
      const next = new Map(prev);
      next.set(columnId, { columnId, value: filterInputs.value, value2: filterInputs.value2 });
      return next;
    });
    setFilterDropdown(null);
    setFilterInputs({ value: "" });
  };

  const clearFilter = (columnId: string) => {
    setActiveFilters(prev => {
      const next = new Map(prev);
      next.delete(columnId);
      return next;
    });
    setFilterDropdown(null);
    setFilterInputs({ value: "" });
  };

  const clearAllFilters = () => {
    setActiveFilters(new Map());
    setFilterDropdown(null);
  };

  const openFilterDropdown = (columnId: string) => {
    const existing = activeFilters.get(columnId);
    setFilterInputs({ value: existing?.value || "", value2: existing?.value2 || "" });
    setFilterDropdown(columnId);
    setContextMenu(null);
  };

  // Filtered tasks — applies both level filter and column filters
  const filteredTasks = useMemo(() => {
    // Step 1: Apply level filter
    const allowedTypes: Set<string> = new Set(["project"]); // project root always visible
    if (levelFilter === "all") {
      allowedTypes.add("component"); allowedTypes.add("subcomponent"); allowedTypes.add("activity"); allowedTypes.add("livrable");
    } else if (levelFilter === "components") {
      allowedTypes.add("component");
    } else if (levelFilter === "subcomponents") {
      allowedTypes.add("component"); allowedTypes.add("subcomponent");
    } else if (levelFilter === "activities") {
      allowedTypes.add("component"); allowedTypes.add("subcomponent"); allowedTypes.add("activity");
    } else if (levelFilter === "livrables") {
      allowedTypes.add("component"); allowedTypes.add("subcomponent"); allowedTypes.add("activity"); allowedTypes.add("livrable");
    }

    let result = tasks.filter(task => allowedTypes.has(task.type));

    // Step 2: Apply column filters (skip level-type filters)
    if (activeFilters.size > 0) {
      result = result.filter(task => {
        if (task.type === "project" || task.type === "component" || task.type === "subcomponent") return true;
        for (const [, filter] of activeFilters) {
          const col = COLUMN_DEFS.find(c => c.id === filter.columnId);
          if (!col || col.filterType === "level") continue;
          const val = (task as any)[col.field];
          const strVal = val?.toString()?.toLowerCase() || "";
          if (col.filterType === "text") {
            if (filter.value && !strVal.includes(filter.value.toLowerCase())) return false;
          } else if (col.filterType === "number") {
            const numVal = parseFloat(strVal) || 0;
            if (filter.value && numVal < parseFloat(filter.value)) return false;
            if (filter.value2 && numVal > parseFloat(filter.value2)) return false;
          } else if (col.filterType === "date") {
            if (!val) return filter.value ? false : true;
            const dateVal = new Date(val).getTime();
            if (filter.value && dateVal < new Date(filter.value).getTime()) return false;
            if (filter.value2 && dateVal > new Date(filter.value2).getTime()) return false;
          } else if (col.filterType === "ref") {
            if (filter.value === "has" && !val) return false;
            if (filter.value === "empty" && val) return false;
          }
        }
        return true;
      });
    }

    return result;
  }, [tasks, activeFilters, levelFilter]);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => { setContextMenu(null); setRowMenu(null); };
    if (contextMenu || rowMenu) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu, rowMenu]);

  // Scroll sync
  const syncingRef = useRef(false);

  const handleLeftScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (leftBodyRef.current && rightBodyRef.current) {
      rightBodyRef.current.scrollTop = leftBodyRef.current.scrollTop;
    }
    requestAnimationFrame(() => { syncingRef.current = false; });
  };

  const handleRightScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (rightBodyRef.current && leftBodyRef.current) {
      leftBodyRef.current.scrollTop = rightBodyRef.current.scrollTop;
    }
    if (rightBodyRef.current && rightHeaderRef.current) {
      rightHeaderRef.current.scrollLeft = rightBodyRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { syncingRef.current = false; });
  };

  // Resizer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      if (pct >= 20 && pct <= 80) setLeftWidth(pct);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // ═══════════════════════════════════════════════════════════════════════════
  // BAR POSITION
  // ═══════════════════════════════════════════════════════════════════════════

  const calculateBarPosition = (dateDebut?: string | Date, dateFin?: string | Date) => {
    if (!dateDebut || !dateFin) return null;
    const debut = parseDate(dateDebut);
    const fin = parseDate(dateFin);
    if (!debut || !fin) return null;

    const days = Math.max(1, daysBetween(debut, fin));
    return {
      left: Math.max(0, dateToX(timeline, debut)),
      width: Math.max(6, days * timeline.pxPerDay),
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDU DES CELLULES
  // ═══════════════════════════════════════════════════════════════════════════

  const getIndent = (level: number) => level * 18;

  const renderCell = (task: TaskRow, field: string) => {
    const value = (task as any)[field];
    const isLivrable = task.type === "livrable";
    const isEditing = editingCell?.rowId === task.id && editingCell?.field === field;
    
    // Valeurs déduites par le calcul (en italique) : modifiables, sauf le début
    // d'un livrable qui suit son prédécesseur et les successeurs, toujours déduits.
    const liv = task.livrableData;
    const isCalculated = isLivrable && (
      field === 'dateDebut' ? !liv?.debutFixe || !!liv?.predecesseur
      : field === 'dateFin' || field === 'dateEcheance' ? liv?.modeFin !== 'fin'
      : field === 'duree' ? liv?.modeFin !== 'duree'
      : field === 'delai' ? liv?.modeFin !== 'delai'
      : field === 'successeur'
    );
    const isLocked = field === 'successeur' || (field === 'dateDebut' && !!liv?.predecesseur);

    if (isEditing && isLivrable && !isLocked) {
      if (field === 'predecesseur') {
        const activityLivrables = tasks.filter(t => t.type === "livrable" && t.activityPath === task.activityPath && t.phase === task.phase && t.numero !== task.numero);
        return (
          <select
            value={value?.toString() || ''}
            onChange={(e) => handleCellChange(task, field as any, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
            }}
            autoFocus
            className="msp-cell-input"
            style={{
              width: "100%",
              height: ROW_HEIGHT - 4,
              padding: "0 4px",
              border: `2px solid ${MSP_TODAY_COLOR}`,
              borderRadius: 0,
              outline: "none",
              fontSize: 11,
              fontFamily: "inherit",
            }}
          >
            <option value="">— Aucun —</option>
            {activityLivrables.map(l => (
              <option key={l.id} value={l.numero}>{l.numero} - {l.nom}</option>
            ))}
          </select>
        );
      }

      const inputType = (field === 'dateDebut' || field === 'dateFin' || field === 'dateEcheance') ? 'date'
        : (field === 'ponderation' || field === 'duree' || field === 'delai') ? 'number'
          : 'text';

      return (
        <input
          type={inputType}
          value={value?.toString() || ''}
          onChange={(e) => handleCellChange(task, field as any, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
          }}
          autoFocus
          className="msp-cell-input"
          style={{
            width: "100%",
            height: ROW_HEIGHT - 4,
            padding: "0 4px",
            border: `2px solid ${MSP_TODAY_COLOR}`,
            borderRadius: 0,
            outline: "none",
            fontSize: 11,
            fontFamily: "inherit",
            textAlign: inputType === "number" ? "right" : "left",
          }}
          step={inputType === 'number' ? '0.1' : undefined}
          min={inputType === 'number' ? '0' : undefined}
          max={(field === 'ponderation') ? '100' : undefined}
        />
      );
    }

    let displayValue = value?.toString() || '—';
    if (field === 'progress') {
      return <ProgressCell value={task.progress} summary={task.type !== "activity" && task.type !== "livrable"} planned={task.plannedLeaves} total={task.leaves} />;
    }
    if (field === 'budget') {
      displayValue = formatBudget(task.budget);
    } else if (field === 'duree' && task.dureeLabel !== undefined) {
      displayValue = task.dureeLabel;
    } else if (field === 'dateDebut' || field === 'dateFin' || field === 'dateEcheance') {
      displayValue = formatDate(value);
    } else if (field === 'ponderation') {
      displayValue = value !== undefined && value !== null ? `${Number(value).toLocaleString("fr-FR")} %` : '—';
    } else if (field === 'duree' || field === 'delai') {
      const unitValue = field === 'duree' ? task.dureeUnite : task.delaiUnite;
      let suffix = getDurationSuffix(task.type);
      
      // Override default suffix if unit is explicitly set
      if (unitValue === 'jours') {
        suffix = value === 1 ? ' jour' : ' jours';
      } else if (unitValue === 'semaines') {
        suffix = value === 1 ? ' semaine' : ' semaines';
      } else if (unitValue === 'mois') {
        suffix = ' mois';
      } else {
        // If no explicit unit, use the default from getDurationSuffix but expand it
        if (suffix.includes('j')) suffix = value === 1 ? ' jour' : ' jours';
        else if (suffix.includes('sem')) suffix = value === 1 ? ' semaine' : ' semaines';
        else if (suffix.includes('m')) suffix = ' mois';
      }
      
      displayValue = value !== undefined && value !== null ? `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${suffix}` : '—';
    }

    return (
      <div
        onClick={() => isLivrable && !isLocked && !editor.isEditing && setEditingCell({ rowId: task.id, field })}
        title={isLivrable && isCalculated && !isLocked ? "Valeur déduite — la saisir la rend déterminante" : undefined}
        style={{
          cursor: isLivrable && !isLocked && !editor.isEditing ? "text" : "default",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 4px",
          lineHeight: `${ROW_HEIGHT}px`,
          background: isCalculated ? "var(--msp-bg-header)" : "transparent",
          color: isCalculated ? "var(--msp-text-muted)" : "inherit",
          fontStyle: isCalculated ? "italic" : "normal",
        }}
      >
        {displayValue}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="msp-root" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", position: "relative" }}>
      {/* MS Project Scoped Styles */}
      <style>{`
        .msp-root {
          --msp-bg: var(--bg-surface);
          --msp-bg-header: var(--bg-inset);
          --msp-bg-row-even: var(--bg-surface);
          --msp-bg-row-odd: var(--bg-inset);
          --msp-border: var(--border-default);
          --msp-border-header: var(--border-strong);
          --msp-text: var(--text-primary);
          --msp-text-header: var(--text-tertiary);
          --msp-text-muted: var(--text-secondary);
          --msp-hover: var(--bg-surface-hover);
          --msp-weekend: var(--border-subtle);
          --msp-selected-bg: var(--primary-subtle);
        }

        .msp-cell-input {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .msp-row:hover {
          background: var(--msp-hover) !important;
        }

        .msp-row-selected, .msp-row-selected:hover {
          background: var(--msp-selected-bg) !important;
          box-shadow: inset 3px 0 0 var(--primary);
        }

        .msp-tool:hover:not(:disabled), .msp-menu-item:hover:not(:disabled) {
          background: var(--msp-hover) !important;
        }

        @media (max-width: 1280px) {
          .msp-tool-label { display: none; }
        }

        .msp-gantt-row:hover {
          background: var(--msp-hover) !important;
        }

        .msp-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .msp-scroll::-webkit-scrollbar-track {
          background: var(--msp-bg);
        }
        .msp-scroll::-webkit-scrollbar-thumb {
          background: var(--msp-border-header);
          border-radius: 5px;
        }
        .msp-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--msp-text-muted);
        }

        .msp-header-sync::-webkit-scrollbar {
          display: none;
        }
        .msp-header-sync {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .msp-summary-bar::before,
        .msp-summary-bar::after {
          content: '';
          position: absolute;
          bottom: -4px;
          width: 0;
          height: 0;
        }
        .msp-summary-bar::before {
          left: 0;
          border-left: 5px solid ${MSP_SUMMARY_COLOR};
          border-right: 5px solid transparent;
          border-top: 4px solid ${MSP_SUMMARY_COLOR};
          border-bottom: 4px solid transparent;
        }
        .msp-summary-bar::after {
          right: 0;
          border-right: 5px solid ${MSP_SUMMARY_COLOR};
          border-left: 5px solid transparent;
          border-top: 4px solid ${MSP_SUMMARY_COLOR};
          border-bottom: 4px solid transparent;
        }
      `}</style>

      {/* ─── Édition de la structure ──────────────── */}
      {editor.isEditing && (
        <StructureEditBar
          actions={structureActions}
          changeCount={editor.changeCount}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          saving={savingStructure}
          onUndo={editor.undo}
          onRedo={editor.redo}
          onCancel={closeStructureEdit}
          onSave={saveStructure}
        />
      )}

      {/* ─── Toolbar ──────────────────────────────── */}
      {hasChanges && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "rgba(237, 125, 49, 0.1)",
          borderBottom: "1px solid rgba(237, 125, 49, 0.3)",
          fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ED7D31" }}>
            <Calendar size={14} />
            <span style={{ fontWeight: 600 }}>Modifications non sauvegardées</span>
            {problemesLivrables.length > 0
              ? <span style={{ fontSize: 11, color: "#C0392B", fontWeight: 600 }}>• {problemesLivrables[0]}{problemesLivrables.length > 1 ? ` (+${problemesLivrables.length - 1})` : ""}</span>
              : <span style={{ fontSize: 10, opacity: 0.7 }}>• Cliquez pour éditer • Entrée pour valider</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleCancel}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                background: "#666", color: "#fff", border: "none", borderRadius: 2,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <X size={12} /> Annuler
            </button>
            <button
              onClick={handleSave}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                background: MSP_TODAY_COLOR, color: "#fff", border: "none", borderRadius: 2,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Save size={12} /> Sauvegarder
            </button>
          </div>
        </div>
      )}

      {/* ─── Column & Filter Toolbar ──────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 12px", background: "var(--msp-bg-header)",
        borderBottom: "1px solid var(--msp-border)", fontSize: 11, gap: 8, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
              background: showColumnPicker ? "var(--primary-subtle)" : "transparent",
              border: "1px solid var(--msp-border)", borderRadius: 3,
              color: "var(--msp-text)", fontSize: 10, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Columns3 size={12} /> Colonnes
          </button>

          <div role="group" aria-label="Échelle de temps" style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 6 }}>
            <button
              onClick={() => zoom(-1)}
              disabled={scale === TIME_SCALES[TIME_SCALES.length - 1].id}
              title="Dézoomer (Ctrl + molette)"
              className="msp-tool"
              style={{ display: "flex", padding: 3, background: "transparent", border: "none", borderRadius: 3, color: "var(--msp-text)", cursor: "pointer" }}
            >
              <ZoomOut size={13} />
            </button>
            <div style={{ display: "flex", border: "1px solid var(--msp-border)", borderRadius: 3, overflow: "hidden" }}>
              {TIME_SCALES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => changeScale(option.id)}
                  aria-pressed={scale === option.id}
                  style={{
                    padding: "3px 8px", border: "none", fontSize: 10, fontWeight: 600, cursor: "pointer",
                    background: scale === option.id ? "var(--primary)" : "transparent",
                    color: scale === option.id ? "#fff" : "var(--msp-text)",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => zoom(1)}
              disabled={scale === TIME_SCALES[0].id}
              title="Zoomer (Ctrl + molette)"
              className="msp-tool"
              style={{ display: "flex", padding: 3, background: "transparent", border: "none", borderRadius: 3, color: "var(--msp-text)", cursor: "pointer" }}
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => scrollToDate(new Date())}
              title="Aller à aujourd'hui"
              className="msp-tool"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px", background: "transparent", border: "none", borderRadius: 3, color: "var(--msp-text)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}
            >
              <CalendarClock size={12} /> Aujourd&apos;hui
            </button>
          </div>

          {canEditStructure && !editor.isEditing && (
            <button
              onClick={startStructureEdit}
              disabled={hasChanges}
              title={hasChanges ? "Enregistrez d'abord les modifications des livrables" : "Ajouter, déplacer, décomposer ou supprimer des unités"}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: "transparent", border: "1px solid var(--msp-border)", borderRadius: 3,
                color: "var(--msp-text)", fontSize: 10, fontWeight: 600,
                cursor: hasChanges ? "not-allowed" : "pointer", opacity: hasChanges ? 0.5 : 1,
              }}
            >
              <ListTree size={12} /> Modifier la structure
            </button>
          )}


          {levelFilter !== "all" && (
            <button
              onClick={() => setLevelFilter("all")}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: "rgba(112, 48, 160, 0.1)", border: "1px solid rgba(112, 48, 160, 0.3)",
                borderRadius: 3, color: "#7030A0", fontSize: 10, fontWeight: 600, cursor: "pointer",
              }}
            >
              <X size={10} /> Niveau : {levelFilter === "components" ? "Composantes" : levelFilter === "subcomponents" ? "Sous-composantes" : levelFilter === "activities" ? "Activités" : "Livrables"}
            </button>
          )}

          {activeFilters.size > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                background: "rgba(237, 125, 49, 0.1)", border: "1px solid rgba(237, 125, 49, 0.3)",
                borderRadius: 3, color: "#ED7D31", fontSize: 10, fontWeight: 600, cursor: "pointer",
              }}
            >
              <X size={10} /> {activeFilters.size} filtre{activeFilters.size > 1 ? "s" : ""} actif{activeFilters.size > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--msp-text-muted)" }}>
          {editor.isEditing
            ? "Clic : sélectionner • double-clic ou F2 : renommer • clic droit : actions"
            : "Clic droit sur en-tête = gérer les colonnes"}
        </span>
      </div>

      {/* Column picker dropdown */}
      {showColumnPicker && (
        <div style={{
          position: "absolute", top: 80, left: 12, zIndex: 1000,
          background: "var(--bg-surface)", border: "1px solid var(--msp-border-header)",
          borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: "6px 0",
          minWidth: 200, fontSize: 11,
        }}>
          <div style={{ padding: "4px 12px", fontSize: 10, fontWeight: 700, color: "var(--msp-text-header)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Colonnes visibles
          </div>
          {COLUMN_DEFS.map(col => {
            const isLocked = col.id === "numero" || col.id === "nom";
            const isVisible = visibleColumns.has(col.id);
            return (
              <button
                key={col.id}
                onClick={() => !isLocked && toggleColumn(col.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "5px 12px", background: "none", border: "none",
                  color: isLocked ? "var(--msp-text-muted)" : "var(--msp-text)",
                  cursor: isLocked ? "not-allowed" : "pointer", fontSize: 11, textAlign: "left",
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1.5px solid ${isVisible ? MSP_TODAY_COLOR : "var(--msp-border)"}`,
                  background: isVisible ? MSP_TODAY_COLOR : "transparent",
                  color: "#fff", fontSize: 9, fontWeight: 700,
                }}>
                  {isVisible ? "✓" : ""}
                </span>
                {col.label}
                {isLocked && <span style={{ fontSize: 9, color: "var(--msp-text-muted)", marginLeft: "auto" }}>verrouillé</span>}
              </button>
            );
          })}
          <div style={{ borderTop: "1px solid var(--msp-border)", margin: "4px 0" }} />
          <button
            onClick={() => { resetColumns(); setShowColumnPicker(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              padding: "5px 12px", background: "none", border: "none",
              color: "var(--primary-text)", cursor: "pointer", fontSize: 11,
            }}
          >
            <RotateCcw size={11} /> Réinitialiser
          </button>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div style={{
          position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
          background: "var(--bg-surface)", border: "1px solid var(--msp-border-header)",
          borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: "6px 0",
          minWidth: 180, fontSize: 11,
        }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "4px 12px", fontSize: 10, fontWeight: 700, color: "var(--msp-text-header)", textTransform: "uppercase" }}>
            Afficher / Masquer
          </div>
          {COLUMN_DEFS.map(col => {
            const isLocked = col.id === "numero" || col.id === "nom";
            const isVisible = visibleColumns.has(col.id);
            return (
              <button
                key={col.id}
                onClick={() => { if (!isLocked) toggleColumn(col.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "4px 12px", background: "none", border: "none",
                  color: isLocked ? "var(--msp-text-muted)" : "var(--msp-text)",
                  cursor: isLocked ? "not-allowed" : "pointer", fontSize: 11, textAlign: "left",
                }}
              >
                <span style={{
                  width: 12, height: 12, borderRadius: 2, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: `1.5px solid ${isVisible ? MSP_TODAY_COLOR : "var(--msp-border)"}`,
                  background: isVisible ? MSP_TODAY_COLOR : "transparent", color: "#fff", fontSize: 8,
                }}>{isVisible ? "✓" : ""}</span>
                {col.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Main Container ──────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          background: "var(--msp-bg)",
          border: "1px solid var(--msp-border-header)",
          color: "var(--msp-text)",
          fontSize: 11,
        }}
      >
        {/* ════════════ LEFT PANEL — Table ════════════ */}
        <div
          style={{
            width: `${leftWidth}%`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
            borderRight: "2px solid var(--msp-border-header)",
          }}
        >
          <div
            ref={leftBodyRef}
            className="msp-scroll"
            onScroll={handleLeftScroll}
            style={{ flex: 1, overflowY: "auto", overflowX: "auto", position: "relative" }}
          >
            <div style={{ minWidth: 800, display: "flex", flexDirection: "column" }}>
              {/* Table Header — dynamic columns */}
              <div
                onContextMenu={handleHeaderContextMenu}
                style={{
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                  background: "var(--msp-bg-header)",
                  borderBottom: "2px solid var(--msp-border-header)",
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                }}
              >
                {columnsVisible.map((col, colIdx) => {
                  const hasFilter = activeFilters.has(col.id);
                  const isFilterOpen = filterDropdown === col.id;
                  const isLast = colIdx === columnsVisible.length - 1;

                  return (
                    <div
                      key={col.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: col.id === "nom" ? "flex-start" : "center",
                        gap: 3, borderRight: isLast ? "none" : "1px solid var(--msp-border)",
                        padding: col.id === "nom" ? "0 8px" : "0 2px",
                        height: HEADER_HEIGHT, color: "var(--msp-text-header)",
                        fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.3px",
                        position: "relative",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</span>

                      {/* Expand/collapse all button on Nom column */}
                      {col.id === "nom" && (
                        <button
                          onClick={() => {
                            if (expandedIds.size <= 1) {
                              setExpandedIds(new Set(["project-root", ...units.map((u) => u.id)]));
                            } else {
                              setExpandedIds(new Set(["project-root"]));
                            }
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--msp-text-muted)", display: "flex", alignItems: "center" }}
                          title={expandedIds.size <= 1 ? "Tout développer" : "Tout replier"}
                        >
                          {expandedIds.size <= 1 ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}

                      {/* Filter icon - only on "nom" column */}
                      {col.id === "nom" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); isFilterOpen ? setFilterDropdown(null) : openFilterDropdown(col.id); }}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 1,
                            color: levelFilter !== "all" ? "#ED7D31" : "var(--msp-text-muted)",
                            display: "flex", alignItems: "center", opacity: levelFilter !== "all" ? 1 : 0.5,
                            marginLeft: "auto", flexShrink: 0,
                          }}
                          title="Filtrer par niveau"
                        >
                          <Filter size={10} />
                        </button>
                      )}

                      {/* Filter dropdown */}
                      {isFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute", top: HEADER_HEIGHT, left: 0, zIndex: 100,
                            background: "var(--bg-surface)", border: "1px solid var(--msp-border-header)",
                            borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: 8,
                            minWidth: 180, fontSize: 11,
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--msp-text-header)", marginBottom: 6, textTransform: "uppercase" }}>
                            Filtrer : {col.label}
                          </div>

                          {col.filterType === "text" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-inset)", border: "1px solid var(--msp-border)", borderRadius: 3, padding: "0 6px" }}>
                                <Search size={10} style={{ color: "var(--msp-text-muted)", flexShrink: 0 }} />
                                <input
                                  type="text" placeholder="Contient..."
                                  value={filterInputs.value}
                                  onChange={(e) => setFilterInputs({ value: e.target.value })}
                                  onKeyDown={(e) => e.key === "Enter" && applyFilter(col.id)}
                                  autoFocus
                                  style={{ width: "100%", background: "none", border: "none", outline: "none", padding: "4px 0", fontSize: 11, color: "var(--msp-text)" }}
                                />
                              </div>
                            </div>
                          )}

                          {col.filterType === "level" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {([
                                { val: "all" as LevelFilterValue, label: "🔎 Tout afficher", desc: "Tous les niveaux" },
                                { val: "components" as LevelFilterValue, label: "🟪 Composantes", desc: "Niveau 1 uniquement" },
                                { val: "subcomponents" as LevelFilterValue, label: "🟩 Sous-composantes", desc: "Jusqu'au niveau 2" },
                                { val: "activities" as LevelFilterValue, label: "🔵 Activités", desc: "Jusqu'au niveau 3" },
                                { val: "livrables" as LevelFilterValue, label: "⚪ Livrables", desc: "Tout (y compris livrables)" },
                              ]).map(opt => (
                                <button
                                  key={opt.val}
                                  onClick={() => {
                                    setLevelFilter(opt.val);
                                    // Auto-expand all parents up to the selected level
                                    if (opt.val !== "all" && opt.val !== "components") {
                                      const depth = opt.val === "subcomponents" ? 1 : opt.val === "activities" ? 2 : 3;
                                      setExpandedIds(prev => {
                                        const next = new Set(prev);
                                        next.add("project-root");
                                        units.filter((u) => u.ancestors.length < depth).forEach((u) => next.add(u.id));
                                        return next;
                                      });
                                    }
                                    setFilterDropdown(null);
                                  }}
                                  style={{
                                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                                    padding: "6px 10px",
                                    background: levelFilter === opt.val ? "var(--primary-subtle)" : "none",
                                    border: levelFilter === opt.val ? "1px solid var(--primary)" : "1px solid transparent",
                                    borderRadius: 4, cursor: "pointer",
                                    color: "var(--msp-text)", fontSize: 11, textAlign: "left",
                                    transition: "all 0.15s",
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                                  <span style={{ fontSize: 9, color: "var(--msp-text-muted)", marginTop: 1 }}>{opt.desc}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {col.filterType === "number" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input type="number" placeholder="Min" value={filterInputs.value} onChange={(e) => setFilterInputs(prev => ({ ...prev, value: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && applyFilter(col.id)} autoFocus style={{ width: "50%", background: "var(--bg-inset)", border: "1px solid var(--msp-border)", borderRadius: 3, padding: "4px 6px", fontSize: 11, color: "var(--msp-text)", outline: "none" }} />
                              <input type="number" placeholder="Max" value={filterInputs.value2 || ""} onChange={(e) => setFilterInputs(prev => ({ ...prev, value2: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && applyFilter(col.id)} style={{ width: "50%", background: "var(--bg-inset)", border: "1px solid var(--msp-border)", borderRadius: 3, padding: "4px 6px", fontSize: 11, color: "var(--msp-text)", outline: "none" }} />
                            </div>
                          )}

                          {col.filterType === "date" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <label style={{ fontSize: 10, color: "var(--msp-text-muted)" }}>Après le :</label>
                              <input type="date" value={filterInputs.value} onChange={(e) => setFilterInputs(prev => ({ ...prev, value: e.target.value }))} style={{ background: "var(--bg-inset)", border: "1px solid var(--msp-border)", borderRadius: 3, padding: "4px 6px", fontSize: 11, color: "var(--msp-text)", outline: "none" }} />
                              <label style={{ fontSize: 10, color: "var(--msp-text-muted)" }}>Avant le :</label>
                              <input type="date" value={filterInputs.value2 || ""} onChange={(e) => setFilterInputs(prev => ({ ...prev, value2: e.target.value }))} style={{ background: "var(--bg-inset)", border: "1px solid var(--msp-border)", borderRadius: 3, padding: "4px 6px", fontSize: 11, color: "var(--msp-text)", outline: "none" }} />
                            </div>
                          )}

                          {col.filterType === "ref" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {[{ val: "has", label: "A une valeur" }, { val: "empty", label: "Est vide" }].map(opt => (
                                <button key={opt.val} onClick={() => { setFilterInputs({ value: opt.val }); }} style={{
                                  padding: "4px 8px", background: filterInputs.value === opt.val ? "var(--primary-subtle)" : "none",
                                  border: "1px solid transparent", borderRadius: 3, cursor: "pointer",
                                  color: "var(--msp-text)", fontSize: 11, textAlign: "left",
                                }}>{opt.label}</button>
                              ))}
                            </div>
                          )}

                          {col.filterType !== "level" && (
                            <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => clearFilter(col.id)} style={{ padding: "3px 8px", background: "none", border: "1px solid var(--msp-border)", borderRadius: 3, color: "var(--msp-text-muted)", cursor: "pointer", fontSize: 10 }}>Effacer</button>
                              <button onClick={() => applyFilter(col.id)} style={{ padding: "3px 8px", background: MSP_TODAY_COLOR, border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Appliquer</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Table Body — dynamic columns */}
              {filteredTasks.map((task, index) => {
                const isSummary = task.type === "project" || task.type === "component" || task.type === "subcomponent";
                const isProject = task.type === "project";
                const rowBg = isProject
                  ? "linear-gradient(90deg, rgba(26,82,118,0.08), rgba(26,82,118,0.03))"
                  : index % 2 === 0 ? "var(--msp-bg-row-even)" : "var(--msp-bg-row-odd)";
                const isSelected = editor.isEditing && !!task.unitId && task.unitId === selectedId;
                const isRenaming = !!task.unitId && renaming?.id === task.unitId;

                return (
                  <div
                    key={task.id}
                    className={isSelected ? "msp-row msp-row-selected" : "msp-row"}
                    onClick={() => editor.isEditing && setSelectedId(task.unitId ?? null)}
                    onContextMenu={(e) => {
                      if (!editor.isEditing || !task.unitId) return;
                      e.preventDefault();
                      setSelectedId(task.unitId);
                      setRowMenu({ x: e.clientX, y: e.clientY });
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: gridTemplate,
                      height: ROW_HEIGHT,
                      background: rowBg,
                      borderBottom: isProject ? "2px solid var(--msp-border-header)" : "1px solid var(--msp-border)",
                      cursor: "default",
                      fontWeight: isSummary ? 700 : 400,
                    }}
                  >
                    {columnsVisible.map((col, colIdx) => {
                      const isLast = colIdx === columnsVisible.length - 1;
                      const borderStyle = isLast ? "none" : "1px solid var(--msp-border)";

                      // N° column
                      if (col.id === "numero") {
                        return (
                          <div key={col.id} style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: borderStyle, fontSize: 10, fontWeight: 600, color: isProject ? MSP_PROJECT_COLOR : "var(--msp-text-muted)" }}>
                            {task.numero}
                          </div>
                        );
                      }

                      // Nom column — special rendering with expand/collapse + icons
                      if (col.id === "nom") {
                        return (
                          <div key={col.id} style={{ display: "flex", alignItems: "center", gap: 3, borderRight: borderStyle, paddingLeft: getIndent(task.level) + 6, paddingRight: 4, overflow: "hidden" }}>
                            {task.hasChildren ? (
                              <button
                                onClick={() => toggleExpand(task.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 1, color: "var(--msp-text)", display: "flex", alignItems: "center", flexShrink: 0 }}
                              >
                                {task.isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            ) : (
                              <span style={{ width: 15, flexShrink: 0 }} />
                            )}

                            {isProject && (
                              <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: `linear-gradient(135deg, ${MSP_PROJECT_COLOR}, #2980b9)`, display: "inline-block" }} />
                            )}
                            {task.type === "component" && (
                              <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: "linear-gradient(135deg, #7030A0, #9B59B6)", display: "inline-block" }} />
                            )}
                            {task.type === "subcomponent" && (
                              <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: "linear-gradient(135deg, #70AD47, #A9D18E)", display: "inline-block" }} />
                            )}
                            {task.activityType && task.type === "activity" && (
                              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: ACTIVITY_COLORS[task.activityType] || MSP_BAR_BLUE, display: "inline-block" }} />
                            )}
                            {task.type === "livrable" && (
                              <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: "var(--msp-text-muted)", display: "inline-block" }} />
                            )}

                            {isRenaming && renaming ? (
                              <input
                                autoFocus
                                value={renaming.value}
                                onChange={(e) => setRenaming({ id: renaming.id, value: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                onBlur={() => finishRename(true)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") finishRename(true);
                                  if (e.key === "Escape") finishRename(false);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="msp-cell-input"
                                style={{ flex: 1, minWidth: 0, height: ROW_HEIGHT - 6, padding: "0 4px", border: `2px solid ${MSP_TODAY_COLOR}`, outline: "none", fontSize: 11, fontFamily: "inherit" }}
                              />
                            ) : (
                              <span
                                onClick={() => !editor.isEditing && task.activityPath && onActivityClick?.(task.activityPath)}
                                onDoubleClick={() => editor.isEditing && task.unitId && startRename(task.unitId)}
                                title={!editor.isEditing && task.activityPath ? "Ouvrir la planification" : undefined}
                                style={{
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  fontSize: isProject ? 12.5 : task.type === "component" ? 12 : 11,
                                  cursor: editor.isEditing ? "default" : task.activityPath ? "pointer" : "default",
                                  color: isProject ? MSP_PROJECT_COLOR : "inherit",
                                }}
                              >
                                {task.nom}
                              </span>
                            )}
                          </div>
                        );
                      }

                      // Type : modifiable pour une unité fine tant qu'elle n'est pas planifiée
                      if (col.id === "type") {
                        const type = task.type === "activity" ? (task.activityType as ActivityType) : undefined;
                        const locked = !!task.unitId && plannedIds.has(task.unitId);
                        return (
                          <div key={col.id} style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: borderStyle, padding: "0 4px", overflow: "hidden" }}>
                            {type && editor.isEditing && !locked ? (
                              <select
                                value={type}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => editor.draft && task.unitId && commit(setUnitType(editor.draft, task.unitId, e.target.value as ActivityType))}
                                className="msp-cell-input"
                                style={{ width: "100%", height: ROW_HEIGHT - 6, fontSize: 10.5, border: "1px solid var(--msp-border)", borderRadius: 2 }}
                              >
                                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            ) : type ? (
                              <span
                                title={editor.isEditing && locked ? "Planifiée : le type ne peut plus changer" : undefined}
                                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: ACTIVITY_COLORS[type] || MSP_BAR_BLUE }} />
                                {ACTIVITY_TYPE_LABELS[type] ?? type}
                              </span>
                            ) : null}
                          </div>
                        );
                      }

                      // All other columns — generic render
                      return (
                        <div key={col.id} style={{ borderRight: borderStyle }}>{renderCell(task, col.field)}</div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════════ DIVIDER ════════════ */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: 4,
            background: "var(--msp-border-header)",
            cursor: "col-resize",
            flexShrink: 0,
            position: "relative",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = MSP_BAR_BLUE)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--msp-border-header)")}
        />

        {/* ════════════ RIGHT PANEL — Gantt ════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Gantt Header */}
          <div
            ref={rightHeaderRef}
            className="msp-header-sync"
            style={{ overflow: "hidden", flexShrink: 0, background: "var(--msp-bg-header)", borderBottom: "2px solid var(--msp-border-header)" }}
          >
            {/* Bandeau supérieur : période large */}
            <div style={{ position: "relative", width: totalGanttWidth, height: GANTT_TOP_HEIGHT, borderBottom: "1px solid var(--msp-border)" }}>
              {timeline.top.map((cell) => (
                <div
                  key={cell.key}
                  title={cell.title}
                  style={{
                    position: "absolute", left: cell.left, width: cell.width, height: "100%",
                    borderRight: "1px solid var(--msp-border-header)",
                    display: "flex", alignItems: "center",
                    fontSize: 10, fontWeight: 600, color: "var(--msp-text-header)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {/* Collé au bord gauche : le libellé reste lisible quand la période déborde */}
                  <span style={{ position: "sticky", left: 0, padding: "0 6px", overflow: "hidden", textOverflow: "ellipsis", maxWidth: cell.width }}>
                    {cell.width >= 40 ? cell.label : ""}
                  </span>
                </div>
              ))}
            </div>

            {/* Graduation */}
            <div style={{ position: "relative", width: totalGanttWidth, height: GANTT_BOTTOM_HEIGHT }}>
              {timeline.bottom.map((cell) => (
                <div
                  key={cell.key}
                  title={cell.title}
                  style={{
                    position: "absolute", left: cell.left, width: cell.width, height: "100%",
                    borderRight: "1px solid var(--msp-border)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    fontSize: 9.5, lineHeight: "11px", fontWeight: 500, overflow: "hidden", whiteSpace: "nowrap",
                    color: cell.weekend ? "var(--msp-text-muted)" : "var(--msp-text-header)",
                    background: cell.weekend ? "var(--msp-weekend)" : "transparent",
                  }}
                >
                  <span style={{ fontWeight: cell.sub ? 400 : 600 }}>{cell.width >= 14 ? cell.label : ""}</span>
                  {cell.sub && <span style={{ fontWeight: 700 }}>{cell.sub}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Body */}
          <div
            ref={rightBodyRef}
            className="msp-scroll"
            onScroll={handleRightScroll}
            style={{ flex: 1, overflow: "auto", position: "relative" }}
          >
            <div style={{ width: totalGanttWidth, minHeight: "100%", position: "relative" }}>
              {/* Graduations et week-ends */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {timeline.bottom.map((cell) => (
                  <div
                    key={cell.key}
                    style={{
                      position: "absolute", left: cell.left, top: 0, width: cell.width, height: "100%",
                      borderRight: "1px solid var(--msp-border)",
                      background: cell.weekend ? "var(--msp-weekend)" : "transparent",
                    }}
                  />
                ))}
              </div>

              {/* Aujourd'hui */}
              {timeline.todayX !== null && (
                <div
                  title="Aujourd'hui"
                  style={{
                    position: "absolute", left: timeline.todayX - 1, top: 0, width: 2, height: "100%",
                    background: MSP_TODAY_COLOR, zIndex: 10, pointerEvents: "none",
                  }}
                />
              )}

              {/* Task bars */}
              {filteredTasks.map((task, index) => {
                const barPos = calculateBarPosition(task.dateDebut, task.dateFin);
                if (!barPos) return <div key={task.id} style={{ height: ROW_HEIGHT }} />;

                const isProject = task.type === "project";
                const isSummary = isProject || task.type === "component" || task.type === "subcomponent";
                const color = isProject ? MSP_PROJECT_COLOR : task.activityType ? ACTIVITY_COLORS[task.activityType] : MSP_BAR_BLUE;
                const progress = Math.max(0, Math.min(100, task.progress ?? 0));
                const tooltip = [
                  task.nom,
                  `${formatDate(task.dateDebut)} → ${formatDate(task.dateFin)}`,
                  task.progress !== undefined ? `Avancement : ${task.progress.toLocaleString("fr-FR")} %` : undefined,
                ].filter(Boolean).join("\n");

                if (task.milestone && !isSummary) {
                  return (
                    <div key={task.id} className="msp-gantt-row" style={{ height: ROW_HEIGHT, position: "relative", borderBottom: "1px solid var(--msp-border)" }}>
                      <div
                        title={`${task.nom}\nJalon : ${formatDate(task.dateFin)}`}
                        style={{
                          position: "absolute", left: barPos.left - 6, top: ROW_HEIGHT / 2 - 6, width: 12, height: 12,
                          background: task.type === "livrable" ? "var(--msp-text)" : color, transform: "rotate(45deg)", borderRadius: 1,
                        }}
                      />
                      <span style={{ position: "absolute", left: barPos.left + 12, top: 0, lineHeight: `${ROW_HEIGHT}px`, fontSize: 10, color: "var(--msp-text-muted)", whiteSpace: "nowrap" }}>
                        {formatDate(task.dateFin)}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.id}
                    className="msp-gantt-row"
                    style={{
                      height: ROW_HEIGHT,
                      position: "relative",
                      borderBottom: isProject ? "2px solid var(--msp-border-header)" : "1px solid var(--msp-border)",
                    }}
                  >
                    <div
                      className={isSummary ? "msp-summary-bar" : ""}
                      title={tooltip}
                      style={{
                        position: "absolute",
                        left: barPos.left,
                        top: isSummary ? ROW_HEIGHT / 2 - (isProject ? 3 : 2) : ROW_HEIGHT / 2 - 6,
                        width: barPos.width,
                        height: isSummary ? (isProject ? 6 : 4) : 12,
                        // Barre d'unité : couleur atténuée, la part réalisée en plein
                        background: isSummary
                          ? (isProject ? MSP_PROJECT_COLOR : MSP_SUMMARY_COLOR)
                          : `linear-gradient(to right, ${color} ${progress}%, color-mix(in srgb, ${color} 40%, transparent) ${progress}%)`,
                        borderRadius: isSummary ? 0 : 2,
                        boxShadow: isSummary ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      {/* Synthèse : trait d'avancement sous la barre */}
                      {isSummary && task.progress !== undefined && (
                        <div style={{ position: "absolute", left: 0, top: "100%", marginTop: 1, height: 2, width: `${progress}%`, background: MSP_TODAY_COLOR }} />
                      )}
                    </div>
                    {task.progress !== undefined && (
                      <span
                        style={{
                          position: "absolute", left: barPos.left + barPos.width + 6, top: 0, lineHeight: `${ROW_HEIGHT}px`,
                          fontSize: 10, fontWeight: isSummary ? 600 : 400, color: "var(--msp-text-muted)", whiteSpace: "nowrap", pointerEvents: "none",
                        }}
                      >
                        {Math.round(task.progress)} %
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {rowMenu && editor.isEditing && (
        <StructureRowMenu x={rowMenu.x} y={rowMenu.y} actions={structureActions} onClose={() => setRowMenu(null)} />
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Supprimer de la structure"
        message={pendingDelete?.message ?? ""}
        confirmLabel="Supprimer"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete && editor.draft && commit(removeUnit(editor.draft, pendingDelete.id))) setSelectedId(null);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

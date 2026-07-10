"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, ChevronDown, Save, X, Calendar, Filter, Columns3, Search, RotateCcw } from "lucide-react";
import type { Project } from "@/lib/projectStore";
import type { Planning, Livrable } from "@/services/api/planningService";
import { planningService } from "@/services/api/planningService";
import { toast } from "@/lib/toastStore";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DAY_WIDTH = 24;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 44;
const SUB_HEADER_HEIGHT = 22;
const FRENCH_DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

const ACTIVITY_COLORS: Record<string, string> = {
  travaux: "#4472C4",
  fourniture: "#ED7D31",
  services: "#70AD47",
  etudes: "#7030A0",
  pi: "#E84C88",
};

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
  { id: "ponderation", label: "Pond.", width: "70px", align: "center", defaultVisible: true, filterType: "number", field: "ponderation" },
  { id: "dateDebut", label: "Début", width: "90px", align: "center", defaultVisible: true, filterType: "date", field: "dateDebut" },
  { id: "dateFin", label: "Fin", width: "90px", align: "center", defaultVisible: true, filterType: "date", field: "dateFin" },
  { id: "duree", label: "Durée", width: "70px", align: "center", defaultVisible: true, filterType: "number", field: "duree" },
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
}

interface TaskRow {
  id: string;
  numero: string; // PRJ, C1, SC1.1, A1, R1, T1...
  nom: string;
  level: number;
  type: "project" | "component" | "subcomponent" | "activity" | "livrable";
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
  
  // Métadonnées
  parentId?: string;
  planning?: Planning;
  livrableData?: Livrable;
}

interface WeekGroup {
  weekStart: Date;
  days: Date[];
}

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

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const calculateMonthsDiff = (start: Date, end: Date): number => {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  return Math.max(0, months);
};

const formatWeekLabel = (date: Date) => {
  const day = date.getDate();
  const month = date.toLocaleDateString("fr-FR", { month: "short" });
  const year = date.getFullYear().toString().slice(-2);
  return `${day} ${month} '${year}`;
};

const convertDate = (d: string | Date | undefined): string | undefined => {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return d;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export function MSProjectViewV2({ project, plannings, onRefresh, onActivityClick, focusedActivityPath }: MSProjectViewV2Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    initialExpanded.add("project-root"); // Projet expanded by default
    project.components.forEach((comp) => {
      initialExpanded.add(`comp-${comp.id}`);
    });
    return initialExpanded;
  });
  
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [modifiedLivrables, setModifiedLivrables] = useState<Map<string, Livrable[]>>(new Map());

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
  
  // Timeline
  const [timelineStart, setTimelineStart] = useState<Date>(new Date());
  const [timelineEnd, setTimelineEnd] = useState<Date>(new Date());
  
  // Refs pour synchroniser le scroll
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);
  
  // État pour le redimensionnement
  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULS INTELLIGENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const recalculateLivrable = useCallback((livrable: Livrable, dateT0?: string | Date): Livrable => {
    const result = { ...livrable };

    // Convertir les dates en string si nécessaire
    const convertToString = (date: string | Date | undefined): string | undefined => {
      if (!date) return undefined;
      if (date instanceof Date) return date.toISOString().split('T')[0];
      return date;
    };

    // Calcul de la date de fin si date début + durée
    if (result.dateDebut && result.duree !== undefined && !result.dateFin) {
      const debut = parseDate(result.dateDebut);
      if (debut) {
        result.dateFin = addMonths(debut, result.duree);
      }
    }

    // Calcul de la durée si date début + date fin
    if (result.dateDebut && result.dateFin && result.duree === undefined) {
      const debut = parseDate(result.dateDebut);
      const fin = parseDate(result.dateFin);
      if (debut && fin) {
        result.duree = calculateMonthsDiff(debut, fin);
      }
    }

    // Calcul de l'échéance si T0 + délai
    if (dateT0 && result.delai !== undefined) {
      const t0 = parseDate(dateT0);
      if (t0) {
        result.dateEcheance = addMonths(t0, result.delai);
      }
    }

    return result;
  }, []);

  const recalculateAllLivrables = useCallback((livrables: Livrable[], dateT0?: string | Date): Livrable[] => {
    const result = [...livrables];
    const livrableMap = new Map<string, Livrable>();

    result.forEach(liv => {
      if (liv.numero) {
        livrableMap.set(liv.numero, liv);
      }
    });

    result.forEach((livrable, index) => {
      // Si prédécesseur défini, calculer date de début
      if (livrable.predecesseur) {
        const pred = livrableMap.get(livrable.predecesseur);
        if (pred && pred.dateFin) {
          livrable.dateDebut = pred.dateFin;
        }
      }

      // Recalculer
      result[index] = recalculateLivrable(livrable, dateT0);

      // Mettre à jour la map
      if (livrable.numero) {
        livrableMap.set(livrable.numero, result[index]);
      }

      // Synchroniser successeur
      if (livrable.predecesseur) {
        const predIndex = result.findIndex(l => l.numero === livrable.predecesseur);
        if (predIndex !== -1 && !result[predIndex].successeur) {
          result[predIndex].successeur = livrable.numero;
        }
      }
    });

    return result;
  }, [recalculateLivrable]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTION DE L'ARBRE
  // ═══════════════════════════════════════════════════════════════════════════

  const buildTaskTree = useCallback(() => {
    const rows: TaskRow[] = [];

    const findPlanning = (path: string) => plannings.find((p) => p.activityPath === path);

    const aggregateDates = (paths: string[]) => {
      let minDate: Date | undefined;
      let maxDate: Date | undefined;
      let totalDuree = 0;

      const trackD = (d: string | Date | undefined, type: 'min' | 'max') => {
        if (!d) return;
        const date = new Date(d);
        if (isNaN(date.getTime())) return;
        if (type === 'min') {
          if (!minDate || date < minDate) minDate = date;
        } else {
          if (!maxDate || date > maxDate) maxDate = date;
        }
      };

      paths.forEach((path) => {
        const planning = findPlanning(path);
        if (planning) {
          // Activity-level dates
          trackD(planning.dateDebutActualisee || planning.dateDebutInitiale, 'min');
          trackD(planning.dateFinActualisee || planning.dateFinInitiale, 'max');
          totalDuree += planning.delaiActualiseMois || planning.delaiInitialMois || 0;

          // Also aggregate from livrables
          if (planning.livrables) {
            planning.livrables.forEach((liv) => {
              trackD(liv.dateDebut, 'min');
              trackD(liv.dateFin || liv.dateEcheance, 'max');
            });
          }

          // Also aggregate from taches
          if (planning.tachesExecution) {
            planning.tachesExecution.forEach((tache) => {
              trackD(tache.dateDebut, 'min');
              trackD(tache.dateFin, 'max');
            });
          }
        }
      });

      return {
        dateDebut: minDate ? minDate.toISOString().split("T")[0] : undefined,
        dateFin: maxDate ? maxDate.toISOString().split("T")[0] : undefined,
        duree: totalDuree,
        ponderation: 100,
      };
    };

    // Construire l'arbre — Commencer par le noeud Projet
    const allLeafPaths: string[] = [];
    project.components.forEach((comp) => {
      const hasSC = comp.sousComposants && comp.sousComposants.length > 0;
      if (!hasSC) {
        allLeafPaths.push(comp.id);
      } else {
        comp.sousComposants.forEach((sc) => {
          const hasAct = sc.activities && sc.activities.length > 0;
          if (!hasAct) {
            allLeafPaths.push(`${comp.id}.${sc.id}`);
          } else {
            sc.activities.forEach((_, idx) => allLeafPaths.push(`${comp.id}.${sc.id}.A${idx + 1}`));
          }
        });
      }
    });

    // Noeud racine Projet
    rows.push({
      id: "project-root",
      numero: "PRJ",
      nom: project.name,
      level: 0,
      type: "project",
      hasChildren: project.components.length > 0,
      isExpanded: expandedIds.has("project-root"),
      ...aggregateDates(allLeafPaths),
    });

    if (!expandedIds.has("project-root")) {
      setTasks(rows);
      return;
    }

    // Construire les composantes (level 1+)
    project.components.forEach((comp, compIdx) => {
      const compId = comp.id;
      const compNodeId = `comp-${compId}`;
      const hasSC = comp.sousComposants && comp.sousComposants.length > 0;

      if (!hasSC) {
        // Composant seul = activité
        const activityPath = compId;
        const planning = findPlanning(activityPath);
        const livrables = modifiedLivrables.get(activityPath) || planning?.livrables || [];

        rows.push({
          id: activityPath,
          numero: `C${compIdx + 1}`,
          nom: comp.name,
          level: 1,
          type: "activity",
          activityPath,
          activityType: comp.typeActivite || 'travaux',
          hasChildren: livrables.length > 0,
          isExpanded: expandedIds.has(activityPath),
          planning,
          ...aggregateDates([activityPath]),
        });

        // Ajouter les livrables
        if (expandedIds.has(activityPath) && livrables.length > 0) {
          livrables.forEach((liv) => {
            const convertDate = (d: string | Date | undefined) => {
              if (!d) return undefined;
              if (d instanceof Date) return d.toISOString().split('T')[0];
              return d;
            };

            rows.push({
              id: `${activityPath}.${liv.numero}`,
              numero: liv.numero,
              nom: liv.intitule,
              level: 2,
              type: "livrable",
              activityPath,
              hasChildren: false,
              isExpanded: false,
              parentId: activityPath,
              livrableData: liv,
              ponderation: liv.ponderation,
              dateDebut: convertDate(liv.dateDebut),
              dateFin: convertDate(liv.dateFin),
              duree: liv.duree,
              dureeUnite: liv.dureeUnite,
              delai: liv.delai,
              delaiUnite: liv.delaiUnite,
              dateEcheance: convertDate(liv.dateEcheance),
              predecesseur: liv.predecesseur,
              successeur: liv.successeur,
            });
          });
        }
      } else {
        // Composant avec sous-composants
        const leafPaths: string[] = [];
        comp.sousComposants.forEach((sc) => {
          const hasAct = sc.activities && sc.activities.length > 0;
          if (!hasAct) {
            leafPaths.push(`${compId}.${sc.id}`);
          } else {
            sc.activities.forEach((_, idx) => leafPaths.push(`${compId}.${sc.id}.A${idx + 1}`));
          }
        });

        rows.push({
          id: compNodeId,
          numero: `C${compIdx + 1}`,
          nom: comp.name,
          level: 1,
          type: "component",
          activityType: comp.typeActivite,
          hasChildren: true,
          isExpanded: expandedIds.has(compNodeId),
          ...aggregateDates(leafPaths),
        });

        if (!expandedIds.has(compNodeId)) return;

        comp.sousComposants.forEach((sc, scIdx) => {
          const scNodeId = `sc-${compId}.${sc.id}`;
          const hasAct = sc.activities && sc.activities.length > 0;

          if (!hasAct) {
            // Sous-composant sans activités = activité
            const activityPath = `${compId}.${sc.id}`;
            const planning = findPlanning(activityPath);
            const livrables = modifiedLivrables.get(activityPath) || planning?.livrables || [];

            rows.push({
              id: activityPath,
              numero: `SC${compIdx + 1}.${scIdx + 1}`,
              nom: sc.name,
              level: 2,
              type: "activity",
              activityPath,
              activityType: sc.typeActivite || 'travaux',
              hasChildren: livrables.length > 0,
              isExpanded: expandedIds.has(activityPath),
              parentId: compNodeId,
              planning,
              ...aggregateDates([activityPath]),
            });

            if (expandedIds.has(activityPath) && livrables.length > 0) {
              livrables.forEach((liv) => {
                rows.push({
                  id: `${activityPath}.${liv.numero}`,
                  numero: liv.numero,
                  nom: liv.intitule,
                  level: 3,
                  type: "livrable",
                  activityPath,
                  hasChildren: false,
                  isExpanded: false,
                  parentId: activityPath,
                  livrableData: liv,
                  ponderation: liv.ponderation,
                  dateDebut: convertDate(liv.dateDebut),
                  dateFin: convertDate(liv.dateFin),
                  duree: liv.duree,
                  dureeUnite: liv.dureeUnite,
                  delai: liv.delai,
                  delaiUnite: liv.delaiUnite,
                  dateEcheance: convertDate(liv.dateEcheance),
                  predecesseur: liv.predecesseur,
                  successeur: liv.successeur,
                });
              });
            }
          } else {
            // Sous-composant avec activités
            const scLeafPaths = sc.activities.map((_, idx) => `${compId}.${sc.id}.A${idx + 1}`);

            rows.push({
              id: scNodeId,
              numero: `SC${compIdx + 1}.${scIdx + 1}`,
              nom: sc.name,
              level: 2,
              type: "subcomponent",
              hasChildren: true,
              isExpanded: expandedIds.has(scNodeId),
              parentId: compNodeId,
              ...aggregateDates(scLeafPaths),
            });

            if (!expandedIds.has(scNodeId)) return;

            sc.activities.forEach((act, actIdx) => {
              const activityPath = `${compId}.${sc.id}.A${actIdx + 1}`;
              const actName = typeof act === "string" ? act : act.name;
              const actType = typeof act === "string" ? "travaux" : act.typeActivite;
              const planning = findPlanning(activityPath);
              const livrables = modifiedLivrables.get(activityPath) || planning?.livrables || [];

              rows.push({
                id: activityPath,
                numero: `A${actIdx + 1}`,
                nom: actName,
                level: 3,
                type: "activity",
                activityPath,
                activityType: actType,
                hasChildren: livrables.length > 0,
                isExpanded: expandedIds.has(activityPath),
                parentId: scNodeId,
                planning,
                ...aggregateDates([activityPath]),
              });

              if (expandedIds.has(activityPath) && livrables.length > 0) {
                livrables.forEach((liv) => {
                  rows.push({
                    id: `${activityPath}.${liv.numero}`,
                    numero: liv.numero,
                    nom: liv.intitule,
                    level: 4,
                    type: "livrable",
                    activityPath,
                    hasChildren: false,
                    isExpanded: false,
                    parentId: activityPath,
                    livrableData: liv,
                    ponderation: liv.ponderation,
                    dateDebut: convertDate(liv.dateDebut),
                    dateFin: convertDate(liv.dateFin),
                    duree: liv.duree,
                    dureeUnite: liv.dureeUnite,
                    delai: liv.delai,
                    delaiUnite: liv.delaiUnite,
                    dateEcheance: convertDate(liv.dateEcheance),
                    predecesseur: liv.predecesseur,
                    successeur: liv.successeur,
                  });
                });
              }
            });
          }
        });
      }
    });

    setTasks(rows);
  }, [project, plannings, expandedIds, modifiedLivrables]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMELINE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  const calculateTimeline = useCallback(() => {
    let minDate = new Date();
    let maxDate = new Date();
    let hasData = false;

    const trackDate = (dateVal: string | Date | undefined, type: 'start' | 'end') => {
      if (!dateVal) return;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;
      if (type === 'start') {
        if (!hasData || d < minDate) minDate = d;
      } else {
        if (!hasData || d > maxDate) maxDate = d;
      }
      hasData = true;
    };

    plannings.forEach((p) => {
      // Activity-level dates
      trackDate(p.dateDebutActualisee || p.dateDebutInitiale, 'start');
      trackDate(p.dateFinActualisee || p.dateFinInitiale, 'end');

      // Livrable-level dates (critical for Étude planification)
      if (p.livrables) {
        p.livrables.forEach((liv) => {
          trackDate(liv.dateDebut, 'start');
          trackDate(liv.dateFin || liv.dateEcheance, 'end');
        });
      }

      // Tache-level dates (for Exécution)
      if (p.tachesExecution) {
        p.tachesExecution.forEach((tache) => {
          trackDate(tache.dateDebut, 'start');
          trackDate(tache.dateFin, 'end');
        });
      }

      // Étape passation dates
      if (p.etapesPassation) {
        p.etapesPassation.forEach((etape) => {
          trackDate(etape.dateDebut, 'start');
          trackDate(etape.dateFin, 'end');
        });
      }
    });

    if (!hasData) {
      minDate = new Date();
      maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 12);
    }

    // Extend range
    minDate = new Date(minDate);
    minDate.setDate(minDate.getDate() - 14);
    maxDate = new Date(maxDate);
    maxDate.setDate(maxDate.getDate() + 30);

    // Align to Monday
    const startDay = minDate.getDay();
    minDate.setDate(minDate.getDate() - (startDay === 0 ? 6 : startDay - 1));

    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    setTimelineStart(minDate);
    setTimelineEnd(maxDate);
  }, [plannings]);

  useEffect(() => {
    buildTaskTree();
    calculateTimeline();
  }, [buildTaskTree, calculateTimeline]);

  // Auto-expand focused activity and all its parents when focusedActivityPath changes
  useEffect(() => {
    if (!focusedActivityPath) return;
    
    setExpandedIds(prev => {
      const next = new Set(prev);
      const parts = focusedActivityPath.split('.');
      
      if (parts.length >= 1) {
        // Expand the component node
        next.add(`comp-${parts[0]}`);
      }
      if (parts.length >= 2) {
        // Expand the subcomponent node
        next.add(`sc-${parts[0]}.${parts[1]}`);
      }
      // Expand the activity itself (to show its livrables)
      next.add(focusedActivityPath);
      
      return next;
    });
  }, [focusedActivityPath, plannings]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED DAYS & WEEKS
  // ═══════════════════════════════════════════════════════════════════════════

  const { allDays, weeks, todayIndex } = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(timelineStart);
    current.setHours(0, 0, 0, 0);

    while (current <= timelineEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Group by weeks
    const weekGroups: WeekGroup[] = [];
    let currentWeek: WeekGroup | null = null;
    days.forEach((day) => {
      const dow = day.getDay();
      if (!currentWeek || dow === 1) {
        currentWeek = { weekStart: new Date(day), days: [] };
        weekGroups.push(currentWeek);
      }
      currentWeek.days.push(day);
    });

    // Today index
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tIdx = days.findIndex(
      (d) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    );

    return { allDays: days, weeks: weekGroups, todayIndex: tIdx };
  }, [timelineStart, timelineEnd]);

  const totalGanttWidth = allDays.length * DAY_WIDTH;

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

  const handleCellChange = (task: TaskRow, field: string, value: any) => {
    if (task.type !== "livrable" || !task.activityPath) return;

    const activityPath = task.activityPath;
    const planning = plannings.find(p => p.activityPath === activityPath);
    const currentLivrables = modifiedLivrables.get(activityPath) || planning?.livrables || [];
    
    const livrableIndex = currentLivrables.findIndex(l => l.numero === task.numero);
    if (livrableIndex === -1) return;

    const newLivrables = [...currentLivrables];
    const livrable = { ...newLivrables[livrableIndex] };

    // Mettre à jour le champ
    if (field === 'ponderation' || field === 'duree' || field === 'delai') {
      (livrable as any)[field] = value ? parseFloat(value) : undefined;
    } else {
      (livrable as any)[field] = value || undefined;
    }

    newLivrables[livrableIndex] = livrable;

    // Recalculer tous les livrables
    const dateT0 = planning?.dateT0Etude;
    const recalculated = recalculateAllLivrables(newLivrables, dateT0);

    setModifiedLivrables(prev => new Map(prev).set(activityPath, recalculated));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      for (const [activityPath, livrables] of modifiedLivrables.entries()) {
        await planningService.update(project.code, activityPath, { livrables });
      }

      toast.success("Modifications sauvegardées");
      setHasChanges(false);
      setModifiedLivrables(new Map());
      onRefresh();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleCancel = () => {
    if (!confirm("Annuler toutes les modifications ?")) return;
    setModifiedLivrables(new Map());
    setHasChanges(false);
    buildTaskTree();
  };

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
    const handleClick = () => { setContextMenu(null); };
    if (contextMenu) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

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
    if (!dateDebut || !dateFin || allDays.length === 0) return null;

    const debut = parseDate(dateDebut);
    const fin = parseDate(dateFin);
    if (!debut || !fin) return null;

    debut.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const startOffset = Math.floor((debut.getTime() - timelineStart.getTime()) / msPerDay);
    const duration = Math.max(1, Math.ceil((fin.getTime() - debut.getTime()) / msPerDay));

    return {
      left: Math.max(0, startOffset) * DAY_WIDTH,
      width: Math.max(DAY_WIDTH, duration * DAY_WIDTH),
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
    
    // Champs calculés
    const isCalculated = (field === 'dateFin' && task.dateDebut && task.duree) ||
                         (field === 'dateEcheance' && task.delai !== undefined);

    if (isEditing && isLivrable && !isCalculated) {
      if (field === 'predecesseur' || field === 'successeur') {
        const activityLivrables = tasks.filter(t => t.type === "livrable" && t.activityPath === task.activityPath && t.numero !== task.numero);
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

      const inputType = (field === 'dateDebut' || field === 'dateFin') ? 'date'
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
    if (field === 'dateDebut' || field === 'dateFin' || field === 'dateEcheance') {
      displayValue = formatDate(value);
    } else if (field === 'ponderation') {
      displayValue = value ? `${value}%` : '—';
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
      
      displayValue = value !== undefined && value !== null ? `${value}${suffix}` : '—';
    }

    return (
      <div
        onClick={() => isLivrable && !isCalculated && setEditingCell({ rowId: task.id, field })}
        style={{
          cursor: isLivrable && !isCalculated ? "text" : "default",
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
          --msp-selected-bg: var(--accent-subtle);
        }

        .msp-cell-input {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .msp-row:hover {
          background: var(--msp-hover) !important;
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
            <span style={{ fontSize: 10, opacity: 0.7 }}>• Cliquez pour éditer • Entrée pour valider</span>
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
              background: showColumnPicker ? "var(--accent-subtle)" : "transparent",
              border: "1px solid var(--msp-border)", borderRadius: 3,
              color: "var(--msp-text)", fontSize: 10, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Columns3 size={12} /> Colonnes
          </button>


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
          Clic droit sur en-tête = gérer les colonnes
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
              color: "var(--accent)", cursor: "pointer", fontSize: 11,
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
                              const allIds = new Set<string>();
                              allIds.add("project-root");
                              project.components.forEach((comp) => {
                                allIds.add(`comp-${comp.id}`);
                                comp.sousComposants.forEach((sc) => {
                                  allIds.add(`sc-${comp.id}.${sc.id}`);
                                  sc.activities.forEach((_, actIdx) => {
                                    allIds.add(`${comp.id}.${sc.id}.A${actIdx + 1}`);
                                  });
                                });
                              });
                              setExpandedIds(allIds);
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
                                      setExpandedIds(prev => {
                                        const next = new Set(prev);
                                        next.add("project-root");
                                        project.components.forEach(comp => {
                                          next.add(`comp-${comp.id}`);
                                          if (opt.val === "activities" || opt.val === "livrables") {
                                            comp.sousComposants.forEach(sc => {
                                              next.add(`sc-${comp.id}.${sc.id}`);
                                              if (opt.val === "livrables") {
                                                sc.activities.forEach((_, actIdx) => {
                                                  next.add(`${comp.id}.${sc.id}.A${actIdx + 1}`);
                                                });
                                              }
                                            });
                                          }
                                        });
                                        return next;
                                      });
                                    }
                                    setFilterDropdown(null);
                                  }}
                                  style={{
                                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                                    padding: "6px 10px",
                                    background: levelFilter === opt.val ? "var(--accent-subtle)" : "none",
                                    border: levelFilter === opt.val ? "1px solid var(--accent)" : "1px solid transparent",
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
                                  padding: "4px 8px", background: filterInputs.value === opt.val ? "var(--accent-subtle)" : "none",
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

                return (
                  <div
                    key={task.id}
                    className="msp-row"
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

                            <span 
                              onClick={() => task.activityPath && onActivityClick?.(task.activityPath)}
                              style={{ 
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", 
                                fontSize: isProject ? 12.5 : task.type === "component" ? 12 : 11,
                                cursor: task.activityPath ? "pointer" : "default",
                                color: isProject ? MSP_PROJECT_COLOR : "inherit",
                              }}
                            >
                              {task.nom}
                            </span>
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
            {/* Week labels */}
            <div style={{ display: "flex", width: totalGanttWidth, height: 22 }}>
              {weeks.map((week, wIdx) => (
                <div
                  key={wIdx}
                  style={{
                    width: week.days.length * DAY_WIDTH,
                    flexShrink: 0,
                    borderRight: "1px solid var(--msp-border-header)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--msp-text-header)",
                    letterSpacing: "0.3px",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {week.days.length >= 4 ? formatWeekLabel(week.weekStart) : ""}
                </div>
              ))}
            </div>

            {/* Day letters */}
            <div style={{ display: "flex", width: totalGanttWidth, height: 22 }}>
              {allDays.map((day, dIdx) => {
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return (
                  <div
                    key={dIdx}
                    style={{
                      width: DAY_WIDTH,
                      flexShrink: 0,
                      borderRight: dow === 0 ? "1px solid var(--msp-border-header)" : "1px solid var(--msp-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 500,
                      color: isWeekend ? "var(--msp-text-muted)" : "var(--msp-text-header)",
                      background: isWeekend ? "var(--msp-weekend)" : "transparent",
                    }}
                  >
                    {FRENCH_DAY_LETTERS[dow]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gantt Body */}
          <div
            ref={rightBodyRef}
            className="msp-scroll"
            onScroll={handleRightScroll}
            style={{ flex: 1, overflow: "auto", position: "relative" }}
          >
            <div style={{ width: totalGanttWidth, position: "relative" }}>
              {/* Day grid lines */}
              <div style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                backgroundImage: `repeating-linear-gradient(to right, transparent 0px, transparent ${DAY_WIDTH - 1}px, var(--msp-border) ${DAY_WIDTH - 1}px, var(--msp-border) ${DAY_WIDTH}px)`,
              }} />

              {/* Weekend shading */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {allDays.map((day, dIdx) => {
                  const dow = day.getDay();
                  if (dow !== 0 && dow !== 6) return null;
                  return (
                    <div
                      key={dIdx}
                      style={{
                        position: "absolute",
                        left: dIdx * DAY_WIDTH,
                        top: 0,
                        width: DAY_WIDTH,
                        height: "100%",
                        background: "var(--msp-weekend)",
                      }}
                    />
                  );
                })}
              </div>

              {/* Today marker */}
              {todayIndex >= 0 && (
                <div style={{
                  position: "absolute",
                  left: todayIndex * DAY_WIDTH + DAY_WIDTH / 2,
                  top: 0,
                  width: 2,
                  height: "100%",
                  background: MSP_TODAY_COLOR,
                  zIndex: 10,
                  pointerEvents: "none",
                }} />
              )}

              {/* Task bars */}
              {filteredTasks.map((task, index) => {
                const barPos = calculateBarPosition(task.dateDebut, task.dateFin);
                if (!barPos) return <div key={task.id} style={{ height: ROW_HEIGHT }} />;

                const isProject = task.type === "project";
                const isSummary = isProject || task.type === "component" || task.type === "subcomponent";
                const color = isProject ? MSP_PROJECT_COLOR : task.activityType ? ACTIVITY_COLORS[task.activityType] : MSP_BAR_BLUE;

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
                      style={{
                        position: "absolute",
                        left: barPos.left,
                        top: isSummary ? ROW_HEIGHT / 2 - (isProject ? 3 : 2) : ROW_HEIGHT / 2 - 6,
                        width: barPos.width,
                        height: isSummary ? (isProject ? 6 : 4) : 12,
                        background: isSummary ? (isProject ? MSP_PROJECT_COLOR : MSP_SUMMARY_COLOR) : color,
                        borderRadius: isSummary ? 0 : 2,
                        boxShadow: isSummary ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

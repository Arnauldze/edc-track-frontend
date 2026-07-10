"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, Plus, Trash2, Save, X, Calendar } from "lucide-react";
import type { Project } from "@/lib/projectStore";
import type { Planning } from "@/services/api/planningService";
import { planningService } from "@/services/api/planningService";
import { toast } from "@/lib/toastStore";

interface MSProjectViewProps {
  project: Project;
  plannings: Planning[];
  onActivityClick: (activityPath: string) => void;
  onRefresh: () => void;
}

interface TaskRow {
  id: string;
  level: number;
  name: string;
  type: "project" | "component" | "subcomponent" | "activity" | "subtask";
  activityPath?: string;
  activityType?: string;
  hasChildren: boolean;
  isExpanded: boolean;
  planning?: Planning;
  dateDebut?: string;
  dateFin?: string;
  duree?: number;
  responsable?: string;
  budget?: number;
  parentId?: string;
  isEditing?: boolean;
  isNew?: boolean;
  canAddSubtask?: boolean;
}

interface WeekGroup {
  weekStart: Date;
  days: Date[];
}

// ─── Constants ──────────────────────────────────────────────────────────────
const DAY_WIDTH = 24;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 44;
const SUB_HEADER_HEIGHT = 22;
const TABLE_COLUMNS = "32px 32px 1fr 60px 80px 80px 90px 42px";
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

// ─── Component ──────────────────────────────────────────────────────────────
export function MSProjectView({ project, plannings, onActivityClick, onRefresh }: MSProjectViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    project.components.forEach((comp) => {
      initialExpanded.add(`comp-${comp.id}`);
    });
    return initialExpanded;
  });
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [timelineStart, setTimelineStart] = useState<Date>(new Date());
  const [timelineEnd, setTimelineEnd] = useState<Date>(new Date());
  const [hasChanges, setHasChanges] = useState(false);
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());

  // Refs pour synchroniser le scroll
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);

  // État pour le redimensionnement
  const [leftWidth, setLeftWidth] = useState(42);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Build task tree ────────────────────────────────────────────────────
  useEffect(() => {
    buildTaskTree();
    calculateTimeline();
  }, [project, plannings, expandedIds]);

  const buildTaskTree = () => {
    const rows: TaskRow[] = [];

    /** Recherche un planning par son activityPath */
    const findPlanning = (path: string) => plannings.find((p) => p.activityPath === path);

    /** Collecte tous les leaf-paths sous un composant pour agréger les dates */
    const getLeafPathsForComponent = (comp: typeof project.components[0]): string[] => {
      const paths: string[] = [];
      const hasSC = comp.sousComposants && comp.sousComposants.length > 0;
      if (!hasSC) {
        // Composant seul = activité
        paths.push(comp.id);
      } else {
        comp.sousComposants.forEach((sc) => {
          const hasAct = sc.activities && sc.activities.length > 0;
          if (!hasAct) {
            paths.push(`${comp.id}.${sc.id}`);
          } else {
            sc.activities.forEach((_, idx) => paths.push(`${comp.id}.${sc.id}.A${idx + 1}`));
          }
        });
      }
      return paths;
    };

    /** Collecte les leaf-paths sous un sous-composant */
    const getLeafPathsForSC = (compId: string, sc: typeof project.components[0]['sousComposants'][0]): string[] => {
      const hasAct = sc.activities && sc.activities.length > 0;
      if (!hasAct) return [`${compId}.${sc.id}`];
      return sc.activities.map((_, idx) => `${compId}.${sc.id}.A${idx + 1}`);
    };

    /** Aggrège les dates de tous les leaf-paths */
    const aggregateDates = (paths: string[]) => {
      let minDate: Date | undefined;
      let maxDate: Date | undefined;
      let totalDuree = 0;

      paths.forEach((path) => {
        const planning = findPlanning(path);
        if (planning) {
          const debut = planning.dateDebutActualisee || planning.dateDebutInitiale;
          const fin = planning.dateFinActualisee || planning.dateFinInitiale;
          if (debut) {
            const d = new Date(debut);
            if (!minDate || d < minDate) minDate = d;
          }
          if (fin) {
            const f = new Date(fin);
            if (!maxDate || f > maxDate) maxDate = f;
          }
          totalDuree += planning.delaiActualiseMois || planning.delaiInitialMois || 0;
        }
      });

      return {
        dateDebut: minDate ? minDate.toISOString().split("T")[0] : undefined,
        dateFin: maxDate ? maxDate.toISOString().split("T")[0] : undefined,
        duree: totalDuree,
      };
    };

    /** Crée une ligne "activity" planifiable à partir d'un planning */
    const makeActivityRow = (
      activityPath: string,
      name: string,
      actType: string,
      level: number,
      parentId: string,
    ): TaskRow => {
      const planning = findPlanning(activityPath);
      return {
        id: activityPath,
        level,
        name,
        type: "activity",
        activityPath,
        activityType: actType,
        hasChildren: !!(planning?.tachesExecution && planning.tachesExecution.length > 0),
        isExpanded: expandedIds.has(activityPath),
        planning,
        dateDebut: planning?.dateDebutActualisee || planning?.dateDebutInitiale
          ? new Date(planning.dateDebutActualisee || planning.dateDebutInitiale!).toISOString().split("T")[0]
          : undefined,
        dateFin: planning?.dateFinActualisee || planning?.dateFinInitiale
          ? new Date(planning.dateFinActualisee || planning.dateFinInitiale!).toISOString().split("T")[0]
          : undefined,
        duree: planning?.delaiActualiseMois || planning?.delaiInitialMois,
        responsable: planning?.responsablePrincipal,
        budget: planning?.budgetActualiseTotal || planning?.budgetInitialTotal,
        parentId,
        canAddSubtask: true,
      };
    };

    /** Ajoute les sous-tâches d'un planning */
    const addSubtasks = (activityPath: string, planning: Planning | undefined, level: number) => {
      if (expandedIds.has(activityPath) && planning?.tachesExecution) {
        planning.tachesExecution.forEach((tache, tIdx) => {
          rows.push({
            id: `${activityPath}.T${tIdx}`,
            level,
            name: tache.designation,
            type: "subtask",
            hasChildren: false,
            isExpanded: false,
            parentId: activityPath,
            dateDebut: tache.dateDebut ? new Date(tache.dateDebut).toISOString().split("T")[0] : undefined,
            dateFin: tache.dateFin ? new Date(tache.dateFin).toISOString().split("T")[0] : undefined,
            duree: tache.dureeJours,
            responsable: tache.responsable,
            budget: (tache.quantite || 0) * (tache.prixUnitaire || 0),
          });
        });
      }
    };

    // ── Construire l'arbre ──
    project.components.forEach((comp) => {
      const compNodeId = `comp-${comp.id}`;
      const hasSC = comp.sousComposants && comp.sousComposants.length > 0;
      const leafPaths = getLeafPathsForComponent(comp);
      const compDates = aggregateDates(leafPaths);

      if (!hasSC) {
        // ════ CAS 1 : Composant seul = activité planifiable ════
        const activityPath = comp.id;
        const actRow = makeActivityRow(activityPath, comp.name, comp.typeActivite || 'travaux', 0, '');
        rows.push(actRow);
        addSubtasks(activityPath, actRow.planning, 1);
      } else {
        // ════ Composant avec enfants = noeud de regroupement ════
        rows.push({
          id: compNodeId,
          level: 0,
          name: comp.name,
          type: "component",
          hasChildren: true,
          isExpanded: expandedIds.has(compNodeId),
          parentId: undefined,
          dateDebut: compDates.dateDebut,
          dateFin: compDates.dateFin,
          duree: compDates.duree,
        });

        if (!expandedIds.has(compNodeId)) return;

        comp.sousComposants.forEach((sc) => {
          const scNodeId = `sc-${comp.id}.${sc.id}`;
          const hasAct = sc.activities && sc.activities.length > 0;

          if (!hasAct) {
            // ════ CAS 2 : Sous-composant sans activités = activité planifiable ════
            const activityPath = `${comp.id}.${sc.id}`;
            const actRow = makeActivityRow(activityPath, sc.name, sc.typeActivite || 'travaux', 1, compNodeId);
            rows.push(actRow);
            addSubtasks(activityPath, actRow.planning, 2);
          } else {
            // ════ Sous-composant avec activités = noeud de regroupement ════
            const scLeafPaths = getLeafPathsForSC(comp.id, sc);
            const scDates = aggregateDates(scLeafPaths);

            rows.push({
              id: scNodeId,
              level: 1,
              name: sc.name,
              type: "subcomponent",
              hasChildren: true,
              isExpanded: expandedIds.has(scNodeId),
              parentId: compNodeId,
              dateDebut: scDates.dateDebut,
              dateFin: scDates.dateFin,
              duree: scDates.duree,
            });

            if (!expandedIds.has(scNodeId)) return;

            // ════ CAS 3 : Activités explicites ════
            sc.activities.forEach((act, actIdx) => {
              const activityPath = `${comp.id}.${sc.id}.A${actIdx + 1}`;
              const actName = typeof act === "string" ? act : act.name;
              const actType = typeof act === "string" ? "travaux" : act.typeActivite;

              const actRow = makeActivityRow(activityPath, actName, actType, 2, scNodeId);
              rows.push(actRow);
              addSubtasks(activityPath, actRow.planning, 3);
            });
          }
        });
      }
    });

    setTasks(rows);
  };

  // ─── Timeline calculation ─────────────────────────────────────────────
  const calculateTimeline = () => {
    let minDate = new Date();
    let maxDate = new Date();
    let hasData = false;

    plannings.forEach((p) => {
      const debut = p.dateDebutActualisee || p.dateDebutInitiale;
      const fin = p.dateFinActualisee || p.dateFinInitiale;
      if (debut) {
        const d = new Date(debut);
        if (!hasData || d < minDate) minDate = d;
        hasData = true;
      }
      if (fin) {
        const f = new Date(fin);
        if (!hasData || f > maxDate) maxDate = f;
        hasData = true;
      }
    });

    if (!hasData) {
      minDate = new Date();
      maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 12);
    }

    // Extend range a bit
    minDate = new Date(minDate);
    minDate.setDate(minDate.getDate() - 14);
    maxDate = new Date(maxDate);
    maxDate.setDate(maxDate.getDate() + 30);

    // Align to Monday
    const startDay = minDate.getDay();
    const daysToMonday = startDay === 0 ? 1 : (startDay === 1 ? 0 : 8 - startDay);
    minDate.setDate(minDate.getDate() - (startDay === 0 ? 6 : startDay - 1));

    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    setTimelineStart(minDate);
    setTimelineEnd(maxDate);
  };

  // ─── Computed days & weeks ────────────────────────────────────────────
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

  // ─── Handlers ─────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Scroll sync: left body ↔ right body (vertical only)
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
    // Sync Gantt header horizontal scroll
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

  // ─── Cell editing ─────────────────────────────────────────────────────
  const handleCellEdit = (rowId: string, field: string, value: any) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === rowId ? { ...t, [field]: value } : t))
    );
    setHasChanges(true);
  };

  const handleAddSubtask = (parentActivityPath: string) => {
    const newTaskId = `${parentActivityPath}.T${Date.now()}`;
    const parentTask = tasks.find((t) => t.id === parentActivityPath);
    if (!parentTask) return;

    const newTask: TaskRow = {
      id: newTaskId,
      level: 3,
      name: "Nouvelle tâche",
      type: "subtask",
      hasChildren: false,
      isExpanded: false,
      parentId: parentActivityPath,
      isNew: true,
      isEditing: true,
      dateDebut: undefined,
      dateFin: undefined,
      duree: 1,
    };

    const parentIndex = tasks.findIndex((t) => t.id === parentActivityPath);
    let insertIndex = parentIndex + 1;
    for (let i = parentIndex + 1; i < tasks.length; i++) {
      if (tasks[i].parentId === parentActivityPath) {
        insertIndex = i + 1;
      } else if (tasks[i].level <= parentTask.level) {
        break;
      }
    }

    setTasks((prev) => {
      const next = [...prev];
      next.splice(insertIndex, 0, newTask);
      return next;
    });

    if (!expandedIds.has(parentActivityPath)) toggleExpand(parentActivityPath);
    setHasChanges(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!confirm("Supprimer cette tâche ?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setDeletedTaskIds((prev) => new Set(prev).add(taskId));
    setHasChanges(true);
  };

  // ─── Save ─────────────────────────────────────────────────────────────
  const handleSaveChanges = async () => {
    try {
      const modifiedActivities = new Map<string, {
        planning: Planning;
        subtasks: TaskRow[];
        activityTask?: TaskRow;
      }>();

      tasks.forEach((task) => {
        if (task.type === "activity" && task.activityPath) {
          const planning = plannings.find((p) => p.activityPath === task.activityPath);
          if (!planning) return;
          if (!modifiedActivities.has(task.activityPath)) {
            modifiedActivities.set(task.activityPath, { planning, subtasks: [], activityTask: task });
          } else {
            modifiedActivities.get(task.activityPath)!.activityTask = task;
          }
        } else if (task.type === "subtask" && task.parentId) {
          const planning = plannings.find((p) => p.activityPath === task.parentId);
          if (!planning) return;
          if (!modifiedActivities.has(task.parentId)) {
            modifiedActivities.set(task.parentId, { planning, subtasks: [] });
          }
          modifiedActivities.get(task.parentId)!.subtasks.push(task);
        }
      });

      for (const [activityPath, { planning, subtasks, activityTask }] of modifiedActivities.entries()) {
        const updateData: any = {};
        if (activityTask) {
          if (activityTask.dateDebut !== (planning.dateDebutActualisee || planning.dateDebutInitiale)?.toString().split("T")[0]) {
            updateData.dateDebutActualisee = activityTask.dateDebut ? new Date(activityTask.dateDebut) : undefined;
          }
          if (activityTask.dateFin !== (planning.dateFinActualisee || planning.dateFinInitiale)?.toString().split("T")[0]) {
            updateData.dateFinActualisee = activityTask.dateFin ? new Date(activityTask.dateFin) : undefined;
          }
          if (activityTask.duree !== (planning.delaiActualiseMois || planning.delaiInitialMois)) {
            updateData.delaiActualiseMois = activityTask.duree;
          }
          if (activityTask.responsable !== planning.responsablePrincipal) {
            updateData.responsablePrincipal = activityTask.responsable;
          }
          if (activityTask.budget !== (planning.budgetActualiseTotal || planning.budgetInitialTotal)) {
            updateData.budgetActualiseTotal = activityTask.budget;
          }
        }

        if (subtasks.length > 0 || (planning.tachesExecution && planning.tachesExecution.length > 0)) {
          const tachesExecution = subtasks.map((st, idx) => {
            const match = st.id.match(/\.T(\d+)$/);
            const num = match ? parseInt(match[1]) + 1 : idx + 1;
            return {
              numero: `T${num}`,
              designation: st.name,
              dateDebut: st.dateDebut ? new Date(st.dateDebut) : undefined,
              dateFin: st.dateFin ? new Date(st.dateFin) : undefined,
              dureeJours: st.duree,
              responsable: st.responsable,
              quantite: 1,
              prixUnitaire: st.budget || 0,
            };
          });
          updateData.tachesExecution = tachesExecution;
        }

        if (Object.keys(updateData).length > 0) {
          await planningService.update(project.code, activityPath, updateData);
        }
      }

      for (const planning of plannings) {
        if (planning.tachesExecution && planning.tachesExecution.length > 0) {
          const hasRemaining = tasks.some(
            (t) => t.type === "subtask" && t.parentId === planning.activityPath
          );
          if (!hasRemaining && !modifiedActivities.has(planning.activityPath)) {
            await planningService.update(project.code, planning.activityPath, { tachesExecution: [] });
          }
        }
      }

      toast.success("Modifications sauvegardées");
      setHasChanges(false);
      setDeletedTaskIds(new Set());
      onRefresh();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  // ─── Bar position (pixel-based) ──────────────────────────────────────
  const calculateBarPosition = (dateDebut?: string, dateFin?: string) => {
    if (!dateDebut || !dateFin || allDays.length === 0) return null;

    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
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

  // ─── Helpers ──────────────────────────────────────────────────────────
  const getIndent = (level: number) => level * 18;

  const formatDate = (val?: string) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
  };

  const formatDuration = (val?: number, type?: string) => {
    if (!val) return "—";
    if (type === "subtask") return `${val} j`;
    return `${val} mois`;
  };

  const formatWeekLabel = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString("fr-FR", { month: "short" });
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} '${year}`;
  };

  // ─── Editable cell ───────────────────────────────────────────────────
  const renderCell = (task: TaskRow, field: string, value: any) => {
    const isEditing = editingCell?.rowId === task.id && editingCell?.field === field;
    const canEdit = task.type === "activity" || task.type === "subtask";

    if (isEditing) {
      const inputType = field === "dateDebut" || field === "dateFin" ? "date"
        : field === "duree" || field === "budget" ? "number"
          : "text";

      return (
        <input
          type={inputType}
          value={value || ""}
          onChange={(e) => {
            const v = inputType === "number" ? (parseFloat(e.target.value) || 0) : e.target.value;
            handleCellEdit(task.id, field, v);
          }}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
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
        />
      );
    }

    let display = "—";
    if (field === "dateDebut" || field === "dateFin") display = formatDate(value);
    else if (field === "duree") display = formatDuration(value, task.type);
    else if (field === "budget") display = value ? new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(value) : "—";
    else if (field === "responsable") display = value || "—";

    return (
      <div
        onClick={() => canEdit && setEditingCell({ rowId: task.id, field })}
        style={{
          cursor: canEdit ? "text" : "default",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: "0 4px",
          lineHeight: `${ROW_HEIGHT}px`,
        }}
      >
        {display}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="msp-root" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
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

        /* Custom scrollbar - thin, MS Project-like */
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

        /* Hide scrollbar on header sync container */
        .msp-header-sync::-webkit-scrollbar {
          display: none;
        }
        .msp-header-sync {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Summary bar bracket ends */
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

      {/* ─── Toolbar (save changes) ──────────────────────────────── */}
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
              onClick={() => {
                if (confirm("Annuler toutes les modifications ?")) {
                  buildTaskTree();
                  setHasChanges(false);
                  setDeletedTaskIds(new Set());
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                background: "#666", color: "#fff", border: "none", borderRadius: 2,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <X size={12} /> Annuler
            </button>
            <button
              onClick={handleSaveChanges}
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
          {/* Table Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: TABLE_COLUMNS,
            minWidth: 520,
            background: "var(--msp-bg-header)",
            borderBottom: "2px solid var(--msp-border-header)",
            flexShrink: 0,
          }}>
            {/* Info */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid var(--msp-border)",
              padding: "0 2px", height: HEADER_HEIGHT,
              color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
            }}>
              <span style={{ fontSize: 14, opacity: 0.5 }}>ℹ</span>
            </div>
            {/* Task Mode */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid var(--msp-border)",
              padding: "0 2px", height: HEADER_HEIGHT,
              color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
            }}>
              <span style={{ fontSize: 12, opacity: 0.5 }}>📌</span>
            </div>
            {/* Task Name */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              borderRight: "1px solid var(--msp-border)",
              padding: "0 8px", height: HEADER_HEIGHT,
              color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              <span>Nom de la tâche</span>
              <button
                onClick={() => {
                  if (expandedIds.size === 0) {
                    const allIds = new Set<string>();
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
                    setExpandedIds(new Set());
                  }
                }}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  color: "var(--msp-text-muted)", display: "flex", alignItems: "center",
                }}
                title={expandedIds.size === 0 ? "Tout développer" : "Tout replier"}
              >
                {expandedIds.size === 0 ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            {/* Duration */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid var(--msp-border)",
              height: HEADER_HEIGHT, color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
              textTransform: "uppercase",
            }}>
              Durée
            </div>
            {/* Start */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid var(--msp-border)",
              height: HEADER_HEIGHT, color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
              textTransform: "uppercase",
            }}>
              Début
            </div>
            {/* Finish */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid var(--msp-border)",
              height: HEADER_HEIGHT, color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
              textTransform: "uppercase",
            }}>
              Fin
            </div>
            {/* Resource */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid var(--msp-border)",
              height: HEADER_HEIGHT, color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
              textTransform: "uppercase",
            }}>
              Resp.
            </div>
            {/* Actions */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: HEADER_HEIGHT, color: "var(--msp-text-header)", fontWeight: 700, fontSize: 10,
            }}>
              ⚡
            </div>
          </div>

          {/* Table Body */}
          <div
            ref={leftBodyRef}
            className="msp-scroll"
            onScroll={handleLeftScroll}
            style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}
          >
            <div style={{ minWidth: 520 }}>
              {tasks.map((task, index) => {
                const isComponent = task.type === "component";
                const isSubcomponent = task.type === "subcomponent";
                const isSummary = isComponent || isSubcomponent;
                const rowBg = index % 2 === 0 ? "var(--msp-bg-row-even)" : "var(--msp-bg-row-odd)";

                return (
                  <div
                    key={task.id}
                    className="msp-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: TABLE_COLUMNS,
                      height: ROW_HEIGHT,
                      background: rowBg,
                      borderBottom: "1px solid var(--msp-border)",
                      cursor: "default",
                      fontWeight: isSummary ? 700 : 400,
                    }}
                  >
                    {/* Info (É/P/E) */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
                      borderRight: "1px solid var(--msp-border)",
                      color: "var(--msp-text-muted)", fontSize: 10,
                    }}>
                      {(task.type === "activity" || task.type === "subtask") && task.planning && (
                        <>
                          <span style={{
                            width: 8, height: 8, borderRadius: 1, fontSize: 6, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: task.planning.hasEtudePrealable ? "#7030A020" : "transparent",
                            color: task.planning.hasEtudePrealable ? "#7030A0" : "transparent",
                            border: task.planning.hasEtudePrealable ? `1px solid #7030A0` : "none",
                          }} title="Étude Préalable">É</span>
                          <span style={{
                            width: 8, height: 8, borderRadius: 1, fontSize: 6, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: task.planning.hasPassation ? "#ED7D3120" : "transparent",
                            color: task.planning.hasPassation ? "#ED7D31" : "transparent",
                            border: task.planning.hasPassation ? `1px solid #ED7D31` : "none",
                          }} title="Passation">P</span>
                          <span style={{
                            width: 8, height: 8, borderRadius: 1, fontSize: 6, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: task.planning.hasExecution ? "#70AD4720" : "transparent",
                            color: task.planning.hasExecution ? "#70AD47" : "transparent",
                            border: task.planning.hasExecution ? `1px solid #70AD47` : "none",
                          }} title="Exécution">E</span>
                        </>
                      )}
                    </div>

                    {/* Task Mode (Pin/Auto) */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRight: "1px solid var(--msp-border)",
                      color: "var(--msp-text-muted)", fontSize: 10,
                    }}>
                      {isSummary ? (
                        <span title="Planifié automatiquement" style={{ opacity: 0.6 }}>⚙️</span>
                      ) : (
                        <span title="Planifié manuellement" style={{ opacity: 0.6 }}>📌</span>
                      )}
                    </div>

                    {/* Task Name */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 3,
                      borderRight: "1px solid var(--msp-border)",
                      paddingLeft: getIndent(task.level) + 6,
                      paddingRight: 4,
                      overflow: "hidden",
                    }}>
                      {/* Expand/collapse chevron */}
                      {task.hasChildren ? (
                        <button
                          onClick={() => toggleExpand(task.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 1,
                            color: "var(--msp-text)", display: "flex", alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          {task.isExpanded
                            ? <ChevronDown size={13} />
                            : <ChevronRight size={13} />}
                        </button>
                      ) : (
                        <span style={{ width: 15, flexShrink: 0 }} />
                      )}

                      {/* Type indicator */}
                      {isComponent && (
                        <span style={{
                          width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                          background: "linear-gradient(135deg, #7030A0, #9B59B6)",
                          display: "inline-block",
                        }} />
                      )}
                      {isSubcomponent && (
                        <span style={{
                          width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                          background: "linear-gradient(135deg, #70AD47, #A9D18E)",
                          display: "inline-block",
                        }} />
                      )}
                      {task.activityType && (
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                          background: ACTIVITY_COLORS[task.activityType] || MSP_BAR_BLUE,
                          display: "inline-block",
                        }} />
                      )}
                      {task.type === "subtask" && (
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                          background: "var(--msp-text-muted)",
                          display: "inline-block",
                        }} />
                      )}

                      {/* Task name text */}
                      <span
                        onClick={() => task.activityPath && onActivityClick(task.activityPath)}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: task.activityPath ? "pointer" : "default",
                          color: isSummary ? "var(--msp-text)" : "var(--msp-text)",
                          fontSize: isComponent ? 12 : 11,
                        }}
                      >
                        {task.name}
                      </span>
                    </div>

                    {/* Duration */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRight: "1px solid var(--msp-border)",
                      color: isSummary ? "var(--msp-text)" : "var(--msp-text-muted)",
                    }}>
                      {renderCell(task, "duree", task.duree)}
                    </div>

                    {/* Start */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRight: "1px solid var(--msp-border)",
                      color: "var(--msp-text-muted)",
                    }}>
                      {renderCell(task, "dateDebut", task.dateDebut)}
                    </div>

                    {/* Finish */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRight: "1px solid var(--msp-border)",
                      color: "var(--msp-text-muted)",
                    }}>
                      {renderCell(task, "dateFin", task.dateFin)}
                    </div>

                    {/* Resource */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRight: "1px solid var(--msp-border)",
                      color: "var(--msp-text-muted)",
                    }}>
                      {renderCell(task, "responsable", task.responsable)}
                    </div>

                    {/* Actions */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
                    }}>
                      {task.canAddSubtask && (
                        <button
                          onClick={() => handleAddSubtask(task.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: MSP_TODAY_COLOR, padding: 2, display: "flex",
                            alignItems: "center", borderRadius: 2,
                          }}
                          title="Ajouter une sous-tâche"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                      {task.type === "subtask" && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "#e74c3c", padding: 2, display: "flex",
                            alignItems: "center", borderRadius: 2,
                          }}
                          title="Supprimer"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
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

          {/* Gantt Header — Two levels: week dates + day letters */}
          <div
            ref={rightHeaderRef}
            className="msp-header-sync"
            style={{
              overflow: "hidden",
              flexShrink: 0,
              background: "var(--msp-bg-header)",
              borderBottom: "2px solid var(--msp-border-header)",
            }}
          >
            {/* Top level: Week labels */}
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

            {/* Bottom level: Day letters */}
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

              {/* Day grid lines (via repeating background) */}
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

              {/* Week separator lines (stronger) */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {weeks.map((week, wIdx) => {
                  if (wIdx === 0) return null;
                  const daysBefore = weeks.slice(0, wIdx).reduce((sum, w) => sum + w.days.length, 0);
                  return (
                    <div
                      key={wIdx}
                      style={{
                        position: "absolute",
                        left: daysBefore * DAY_WIDTH,
                        top: 0,
                        width: 1,
                        height: "100%",
                        background: "var(--msp-border-header)",
                      }}
                    />
                  );
                })}
              </div>

              {/* Task Bars */}
              <div style={{ position: "relative" }}>
                {tasks.map((task, index) => {
                  const bar = calculateBarPosition(task.dateDebut, task.dateFin);
                  const isComponent = task.type === "component";
                  const isSubcomponent = task.type === "subcomponent";
                  const isSummary = isComponent || isSubcomponent;
                  const rowBg = index % 2 === 0 ? "var(--msp-bg-row-even)" : "var(--msp-bg-row-odd)";

                  // Bar colors
                  let barColor = MSP_BAR_BLUE;
                  if (task.activityType && ACTIVITY_COLORS[task.activityType]) {
                    barColor = ACTIVITY_COLORS[task.activityType];
                  }

                  return (
                    <div
                      key={task.id}
                      className="msp-gantt-row"
                      style={{
                        height: ROW_HEIGHT,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        borderBottom: "1px solid var(--msp-border)",
                        background: rowBg,
                      }}
                    >
                      {bar && isSummary && (
                        /* Summary bar — thin with bracket ends */
                        <div
                          className="msp-summary-bar"
                          style={{
                            position: "absolute",
                            left: bar.left,
                            width: bar.width,
                            height: 7,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: MSP_SUMMARY_COLOR,
                            zIndex: 5,
                          }}
                        />
                      )}

                      {bar && !isSummary && (
                        /* Regular task bar */
                        <div
                          onClick={() => task.activityPath && onActivityClick(task.activityPath)}
                          style={{
                            position: "absolute",
                            left: bar.left,
                            width: bar.width,
                            height: task.type === "subtask" ? 12 : 16,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: barColor,
                            borderRadius: 2,
                            cursor: task.activityPath ? "pointer" : "default",
                            zIndex: 5,
                            display: "flex",
                            alignItems: "center",
                            paddingLeft: 4,
                            overflow: "hidden",
                          }}
                        >
                          <span style={{
                            color: "#ffffff",
                            fontSize: 9,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          }}>
                            {bar.width > 80 ? task.name : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

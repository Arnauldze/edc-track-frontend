"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Briefcase, ChevronDown, ChevronLeft, ChevronUp, FileText, Hammer, Save, Settings, Trash2, User } from "lucide-react";
import { getProjectById, getLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type CreatePlanningDto, type Livrable, type Planning, type UpdatePlanningDto } from "@/services/api/planningService";
import { toast } from "@/lib/toastStore";
import { PlanningFormEtude, nouveauLivrable } from "@/components/planning/PlanningFormEtude";
import { PlanningFormPassation } from "@/components/planning/PlanningFormPassation";
import { PlanningFormExecution } from "@/components/planning/PlanningFormExecution";
import { BudgetMultiDevise } from "@/components/planning/BudgetMultiDevise";
import { usePermissions } from "@/hooks/usePermissions";
import { findUnit, listUnits } from "@/lib/structureUnits";
import { wbsNumbers } from "@/lib/structureOps";
import { calculerCalendrierEtude, toDay } from "@/lib/livrableSchedule";
import { toFCFA } from "@/lib/componentBudget";
import { DEFAULT_EXCHANGE_RATES, formatCurrency } from "@/lib/helpers/currencyHelpers";

type ActivityType = "travaux" | "fourniture" | "services" | "etudes" | "pi";

const ACTIVITY_TYPES: Record<ActivityType, { label: string; icon: typeof Hammer; gradient: string }> = {
  travaux: { label: "Travaux", icon: Hammer, gradient: "from-blue-500 to-blue-600" },
  fourniture: { label: "Fourniture", icon: Briefcase, gradient: "from-amber-500 to-amber-600" },
  services: { label: "Services", icon: User, gradient: "from-green-500 to-green-600" },
  etudes: { label: "Études", icon: FileText, gradient: "from-purple-500 to-purple-600" },
  pi: { label: "Prestations intellectuelles", icon: FileText, gradient: "from-rose-500 to-rose-600" },
};

/** Champs d'un livrable acceptés par l'API (les champs inconnus sont refusés). */
function livrablePourApi(l: Livrable): Livrable {
  return {
    numero: l.numero,
    intitule: l.intitule,
    ponderation: l.ponderation || 0,
    predecesseur: l.predecesseur || undefined,
    debutFixe: !!l.debutFixe,
    dateDebut: l.debutFixe ? toDay(l.dateDebut) : undefined,
    modeFin: l.modeFin,
    duree: l.modeFin === "duree" ? l.duree : undefined,
    dureeUnite: l.dureeUnite,
    delai: l.modeFin === "delai" ? l.delai : undefined,
    delaiUnite: l.delaiUnite,
    dateFin: l.modeFin === "fin" ? toDay(l.dateFin) : undefined,
    description: l.description || undefined,
    statut: l.statut,
  };
}

/** Message d'erreur de l'API : texte, ou liste de messages de validation. */
function messageApi(error: unknown, parDefaut: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(" • ");
  return message || parDefaut;
}

export default function ActivityPlanningPage() {
  const params = useParams();
  const router = useRouter();
  const projectCode = typeof params.projectCode === "string" ? params.projectCode : "";
  const activityPath = typeof params.activityPath === "string" ? params.activityPath : "";

  const { can, loading: permissionsLoading } = usePermissions(projectCode);
  const readOnly = permissionsLoading || !can("planning:edit");

  const [project, setProject] = useState<Project | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const [activityName, setActivityName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("travaux");

  const [hasEtudePrealable, setHasEtudePrealable] = useState(false);
  const [hasPassation, setHasPassation] = useState(false);
  const [hasExecution, setHasExecution] = useState(false);

  // Informations communes à l'activité
  const [budgetInitial, setBudgetInitial] = useState<Array<{ devise: string; montant: number; pourcentage?: number }>>([
    { devise: "FCFA", montant: 0, pourcentage: 100 },
  ]);
  const [dateT0, setDateT0] = useState("");
  const [responsablePrincipal, setResponsablePrincipal] = useState("");

  // Phases
  const [livrables, setLivrables] = useState<Livrable[]>([nouveauLivrable("R1")]);
  const [passationData, setPassationData] = useState<any>(null);
  const [executionData, setExecutionData] = useState<any>(null);

  const isEditMode = planning !== null;

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, activityPath]);

  async function loadData() {
    setLoading(true);
    try {
      const proj = await getProjectById(projectCode);
      if (!proj) {
        toast.error("Projet introuvable");
        router.push("/planification");
        return;
      }
      setProject(proj);

      const leaf = getLeafActivities(proj).find((l) => l.path === activityPath);
      if (leaf) {
        setActivityName(leaf.name);
        setActivityType(leaf.type as ActivityType);
      }

      try {
        const existing = await planningService.getOne(projectCode, activityPath);
        setPlanning(existing);
        setShowConfig(false);
        populateFormFromPlanning(existing);
      } catch {
        // 404 : pas encore de planification, mode création
        setPlanning(null);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  function populateFormFromPlanning(p: Planning) {
    setHasEtudePrealable(!!p.hasEtudePrealable);
    setHasPassation(!!p.hasPassation);
    setHasExecution(!!p.hasExecution);
    setBudgetInitial(p.budgetInitial?.length ? p.budgetInitial : [{ devise: "FCFA", montant: 0, pourcentage: 100 }]);
    setDateT0(toDay(p.dateDebutInitiale as unknown as string) ?? "");
    setResponsablePrincipal(p.responsablePrincipal || "");
    if (p.livrables?.length) setLivrables(p.livrables);
    if (p.hasPassation) setPassationData({ typePassation: p.typePassation || "", etapesPassation: p.etapesPassation || [] });
    if (p.tachesExecution?.length) setExecutionData({ tachesExecution: p.tachesExecution });
  }

  // ── Informations dérivées ──
  const rates = (project?.financement?.tauxChange as Record<string, number> | undefined) ?? DEFAULT_EXCHANGE_RATES;
  const budgetTotalFCFA = useMemo(
    () => budgetInitial.reduce((sum, b) => sum + toFCFA(b.montant, b.devise, rates), 0),
    [budgetInitial, rates],
  );
  const unit = useMemo(() => (project ? findUnit(project.components, activityPath) : undefined), [project, activityPath]);
  const numero = useMemo(() => (project ? wbsNumbers(project.components).get(activityPath) : undefined), [project, activityPath]);
  const chemin = useMemo(() => {
    if (!project || !unit) return [];
    const units = listUnits(project.components);
    return unit.ancestors.map((id) => units.find((u) => u.id === id)?.name).filter(Boolean) as string[];
  }, [project, unit]);

  async function handleSave() {
    if (!hasEtudePrealable && !hasPassation && !hasExecution) {
      toast.error("Sélectionnez au moins une phase à planifier");
      return;
    }
    if (budgetInitial.every((b) => !b.montant)) {
      toast.error("Veuillez saisir un budget");
      return;
    }

    if (hasEtudePrealable) {
      const problemes = [...new Set(calculerCalendrierEtude(livrables, dateT0).problemes.map((p) => p.message))];
      if (problemes.length) {
        toast.error(`Étude : ${problemes[0]}${problemes.length > 1 ? ` (+${problemes.length - 1} autre${problemes.length > 2 ? "s" : ""})` : ""}`);
        return;
      }
    }

    setSaving(true);
    try {
      const cleanDates = (arr: any[]) =>
        arr.map((item) => ({
          ...item,
          dateDebut: item.dateDebut || undefined,
          dateFin: item.dateFin || undefined,
          dateEcheance: item.dateEcheance || undefined,
        }));

      const data = {
        activityName,
        activityType,
        hasEtudePrealable,
        hasPassation,
        hasExecution,
        budgetInitial,
        budgetInitialTotal: Math.round(budgetTotalFCFA),
        dateDebutInitiale: dateT0 || undefined,
        responsablePrincipal: responsablePrincipal || undefined,
        // Une phase désactivée n'emporte pas ses données
        livrables: hasEtudePrealable ? livrables.map(livrablePourApi) : [],
        ...(hasPassation && passationData
          ? { typePassation: passationData.typePassation, etapesPassation: cleanDates(passationData.etapesPassation || []) }
          : {}),
        ...(hasExecution && executionData ? { tachesExecution: cleanDates(executionData.tachesExecution || []) } : {}),
      };

      if (isEditMode) {
        await planningService.update(projectCode, activityPath, data as unknown as UpdatePlanningDto);
        toast.success("Planification mise à jour");
      } else {
        await planningService.create({ ...data, projectCode, activityPath } as unknown as CreatePlanningDto);
        toast.success("Planification créée");
      }
      router.push(`/planification/${projectCode}?activity=${encodeURIComponent(activityPath)}&t=${Date.now()}`);
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error(messageApi(error, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette planification ?")) return;
    try {
      await planningService.delete(projectCode, activityPath);
      toast.success("Planification supprimée");
      router.push(`/planification/${projectCode}`);
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error(messageApi(error, "Erreur lors de la suppression"));
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
        <Link href="/planification" className="text-[var(--accent)] text-sm mt-2 inline-block">Retour</Link>
      </div>
    );
  }

  const typeInfo = ACTIVITY_TYPES[activityType] ?? ACTIVITY_TYPES.travaux;
  const ActivityIcon = typeInfo.icon;
  const inputClass =
    "w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-sm)] text-[12px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:text-[var(--text-secondary)]";

  const phases = [
    { key: "etude", label: "Étude préalable", active: hasEtudePrealable, toggle: setHasEtudePrealable, on: "border-blue-500 bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", track: "bg-blue-500" },
    { key: "passation", label: "Passation", active: hasPassation, toggle: setHasPassation, on: "border-green-500 bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", track: "bg-green-500" },
    { key: "execution", label: "Exécution", active: hasExecution, toggle: setHasExecution, on: "border-purple-500 bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", track: "bg-purple-500" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* EN-TÊTE */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-5 pb-4 flex-shrink-0">
        <Link href={`/planification/${projectCode}`} className="inline-flex items-center gap-1.5 mb-3 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent)]">
          <ChevronLeft size={14} /> Retour au projet
        </Link>

        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br ${typeInfo.gradient} flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0`}>
              <ActivityIcon size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                {numero && (
                  <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">{numero}</span>
                )}
                <span className="truncate">{activityName}</span>
              </h1>
              <div className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 truncate">
                {[project.name, ...chemin].join(" › ")} • {typeInfo.label}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/planification/${projectCode}`} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-inset)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-sm font-semibold hover:bg-[var(--bg-surface-hover)]">
              <BarChart3 size={16} /> Voir le Gantt
            </Link>
            {!readOnly && isEditMode && (
              <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 rounded-[var(--radius-md)] text-sm font-semibold hover:bg-red-500/20">
                <Trash2 size={16} /> Supprimer
              </button>
            )}
            {!readOnly && (
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-[var(--radius-md)] text-sm font-semibold hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <Save size={16} /> {saving ? "Enregistrement..." : isEditMode ? "Mettre à jour" : "Créer"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div className={`flex-1 overflow-y-auto ${hasPassation ? "px-3" : "px-8"} py-6`}>
        <div className={`${hasPassation ? "max-w-full px-2" : "max-w-6xl"} mx-auto space-y-6`}>
          {/* Informations générales de l'activité */}
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] shadow-sm">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between p-4 bg-[var(--bg-inset)] hover:bg-[var(--bg-surface-hover)] rounded-t-[var(--radius-lg)]"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <Settings size={18} className="text-[var(--accent)]" />
                <span className="font-bold text-[14px] text-[var(--text-primary)]">Informations générales</span>
                {!showConfig && (
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    T0 : {dateT0 ? new Date(`${dateT0}T00:00:00`).toLocaleDateString("fr-FR") : "non définie"} • Budget : {budgetTotalFCFA ? formatCurrency(budgetTotalFCFA, "FCFA") : "—"}
                  </span>
                )}
                {!showConfig && phases.filter((p) => p.active).map((p) => (
                  <span key={p.key} className={`text-[10px] px-2 py-0.5 rounded font-medium bg-[var(--bg-surface)] ${p.text}`}>{p.label}</span>
                ))}
              </div>
              {showConfig ? <ChevronUp size={18} className="text-[var(--text-secondary)]" /> : <ChevronDown size={18} className="text-[var(--text-secondary)]" />}
            </button>

            {showConfig && (
              <div className="p-5 border-t border-[var(--border-subtle)] space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-2">Budget de l&apos;activité</label>
                    <fieldset disabled={readOnly} className="disabled:opacity-80">
                      <BudgetMultiDevise budgets={budgetInitial} onChange={setBudgetInitial} />
                    </fieldset>
                    {budgetInitial.some((b) => b.devise !== "FCFA" && b.montant) && (
                      <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
                        Total converti : <strong>{formatCurrency(budgetTotalFCFA, "FCFA")}</strong> (taux du financement du projet)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-2">Date T0</label>
                    <input type="date" value={dateT0} onChange={(e) => setDateT0(e.target.value)} disabled={readOnly} className={inputClass} />
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Démarrage de l&apos;activité ; les délais des phases se comptent depuis T0.</p>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-2">Responsable</label>
                    <input type="text" value={responsablePrincipal} onChange={(e) => setResponsablePrincipal(e.target.value)} disabled={readOnly} placeholder="Nom du responsable" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Phases à planifier</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {phases.map((phase) => (
                      <button
                        key={phase.key}
                        type="button"
                        disabled={readOnly}
                        onClick={() => phase.toggle(!phase.active)}
                        className={`p-4 rounded-[var(--radius-md)] border-2 text-left transition-all disabled:cursor-not-allowed ${phase.active ? phase.on : "border-[var(--border-default)] bg-[var(--bg-surface)] opacity-60"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[13px] font-bold ${phase.active ? phase.text : "text-[var(--text-secondary)]"}`}>{phase.label}</span>
                          <div className={`w-10 h-5 rounded-full transition-colors ${phase.active ? phase.track : "bg-gray-300"}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mt-0.5 ${phase.active ? "translate-x-5" : "translate-x-0.5"}`} />
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                          {phase.active ? "Activée" : "Désactivée"}
                          {isEditMode && !phase.active && phase.key === "etude" && planning?.livrables?.length ? " — ses livrables seront retirés à l'enregistrement" : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasEtudePrealable && (
            <PlanningFormEtude livrables={livrables} onChange={setLivrables} dateT0={dateT0} readOnly={readOnly} />
          )}

          {hasPassation && (
            <>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-300 dark:border-green-700 rounded-[var(--radius-lg)] p-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shadow-md">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-green-800 dark:text-green-300 mb-1">Plan de Passation des Marchés (PPM)</h3>
                    <p className="text-[11px] text-green-700 dark:text-green-400">Renommer : <strong>Planification de la passation</strong></p>
                  </div>
                </div>
                <Link href={`/planification/${projectCode}/ppm`} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-[var(--radius-md)] text-[13px] font-bold shadow-md">
                  <FileText size={16} /> Portail vers le PPM
                </Link>
              </div>
              <PlanningFormPassation data={passationData} onChange={setPassationData} projectId={projectCode} />
            </>
          )}

          {hasExecution && (
            <PlanningFormExecution data={executionData} onChange={setExecutionData} dateT0={dateT0} projectId={projectCode} />
          )}
        </div>
      </div>
    </div>
  );
}

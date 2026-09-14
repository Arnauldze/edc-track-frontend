"use client";

// ══════════════════════════════════════════════════════════════
// PLANIFICATION D'UNE ACTIVITÉ
//
// Trois niveaux :
//   1. l'activité : identité et données communes (T0, budget, responsable) ;
//   2. ses phases : étude, passation, exécution — état, dates, frise ;
//   3. la phase ouverte : son tableau de planification.
// Les phases ont des dates indépendantes. Un seul enregistrement couvre
// l'activité entière.
// ══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Briefcase, ChevronLeft, FileText, Hammer, Plus, Save, Trash2, User, X } from "lucide-react";
import { getProjectById, getLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type CreatePlanningDto, type Livrable, type Planning, type TacheExecution, type UpdatePlanningDto } from "@/services/api/planningService";
import { toast } from "@/lib/toastStore";
import { PlanningFormEtude, nouveauLivrable } from "@/components/planning/PlanningFormEtude";
import { PlanningFormPassation } from "@/components/planning/PlanningFormPassation";
import { PlanningFormExecution, nouvelleTache } from "@/components/planning/PlanningFormExecution";
import { ActivityGeneralStrip } from "@/components/planning/ActivityGeneralStrip";
import { ActivityPhaseBar, type PhaseSummary } from "@/components/planning/ActivityPhaseBar";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import { findUnit, listUnits } from "@/lib/structureUnits";
import { wbsNumbers } from "@/lib/structureOps";
import { calculerCalendrierEtude, toDay } from "@/lib/livrableSchedule";
import { PHASE_LABELS, PHASE_ORDER, periodeDesLignes, type PhaseKey } from "@/lib/phaseTimeline";
import { toFCFA } from "@/lib/componentBudget";
import { livrablePourApi, messageApi, tachePourApi } from "@/lib/livrableApi";
import { DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";

type ActivityType = "travaux" | "fourniture" | "services" | "etudes" | "pi";
type Budget = { devise: string; montant: number; pourcentage?: number };

const ACTIVITY_TYPES: Record<ActivityType, { label: string; icon: typeof Hammer; gradient: string }> = {
  travaux: { label: "Travaux", icon: Hammer, gradient: "from-blue-500 to-blue-600" },
  fourniture: { label: "Fourniture", icon: Briefcase, gradient: "from-amber-500 to-amber-600" },
  services: { label: "Services", icon: User, gradient: "from-green-500 to-green-600" },
  etudes: { label: "Études", icon: FileText, gradient: "from-purple-500 to-purple-600" },
  pi: { label: "Prestations intellectuelles", icon: FileText, gradient: "from-rose-500 to-rose-600" },
};

const BUDGET_VIDE: Budget[] = [{ devise: "FCFA", montant: 0, pourcentage: 100 }];

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export default function ActivityPlanningPage() {
  const params = useParams();
  const router = useRouter();
  const projectCode = typeof params.projectCode === "string" ? params.projectCode : "";
  const activityPath = typeof params.activityPath === "string" ? params.activityPath : "";

  const { can, loading: permissionsLoading } = usePermissions(projectCode);
  const readOnly = permissionsLoading || !can("planning:edit");
  const { blockNavigation, unblockNavigation } = useNavigationGuard();

  const [project, setProject] = useState<Project | null>(null);
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<PhaseKey>("etude");

  const [activityName, setActivityName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("travaux");

  // Phases prévues
  const [hasEtudePrealable, setHasEtudePrealable] = useState(false);
  const [hasPassation, setHasPassation] = useState(false);
  const [hasExecution, setHasExecution] = useState(false);

  // Données communes à l'activité
  const [budgetInitial, setBudgetInitial] = useState<Budget[]>(BUDGET_VIDE);
  const [dateT0, setDateT0] = useState("");
  const [responsablePrincipal, setResponsablePrincipal] = useState("");

  // Données des phases
  const [livrables, setLivrables] = useState<Livrable[]>([nouveauLivrable("R1")]);
  const [passationData, setPassationData] = useState<any>(null);
  const [taches, setTaches] = useState<TacheExecution[]>([nouvelleTache("T1")]);

  const isEditMode = planning !== null;
  const actives: Record<PhaseKey, boolean> = { etude: hasEtudePrealable, passation: hasPassation, execution: hasExecution };
  const setActive: Record<PhaseKey, (v: boolean) => void> = {
    etude: setHasEtudePrealable,
    passation: setHasPassation,
    execution: setHasExecution,
  };

  /** @param ouvrirPremierePhase au chargement, ouvrir la première phase prévue ; après un enregistrement, garder la phase ouverte. */
  function populateFormFromPlanning(p: Planning, ouvrirPremierePhase = true) {
    setHasEtudePrealable(!!p.hasEtudePrealable);
    setHasPassation(!!p.hasPassation);
    setHasExecution(!!p.hasExecution);
    setBudgetInitial(p.budgetInitial?.length ? p.budgetInitial : BUDGET_VIDE);
    setDateT0(toDay(p.dateDebutInitiale as unknown as string) ?? "");
    setResponsablePrincipal(p.responsablePrincipal || "");
    setLivrables(p.livrables?.length ? p.livrables : [nouveauLivrable("R1")]);
    setPassationData(p.hasPassation ? { typePassation: p.typePassation || "", etapesPassation: p.etapesPassation || [] } : null);
    setTaches(p.tachesExecution?.length ? p.tachesExecution : [nouvelleTache("T1")]);
    const premiere = PHASE_ORDER.find((k) => ({ etude: p.hasEtudePrealable, passation: p.hasPassation, execution: p.hasExecution })[k]);
    if (premiere && ouvrirPremierePhase) setSelected(premiere);
  }

  // ── Modifications non enregistrées ──
  // Chaque partie est comparée à son état au dernier chargement ou enregistrement.
  const sections = useMemo(
    () => ({
      general: JSON.stringify({ budgetInitial, dateT0, responsablePrincipal }),
      etude: JSON.stringify(hasEtudePrealable ? livrables.map(livrablePourApi) : null),
      passation: JSON.stringify(hasPassation ? passationData : null),
      execution: JSON.stringify(hasExecution ? taches.map(tachePourApi) : null),
    }),
    [budgetInitial, dateT0, responsablePrincipal, hasEtudePrealable, livrables, hasPassation, passationData, hasExecution, taches],
  );
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const [reference, setReference] = useState<typeof sections | null>(null);

  /** Prend l'état courant comme référence, une fois les formulaires montés et synchronisés. */
  const figerReference = useCallback(() => {
    setTimeout(() => setReference(sectionsRef.current), 200);
  }, []);

  const modifiees = {
    general: !!reference && reference.general !== sections.general,
    etude: !!reference && reference.etude !== sections.etude,
    passation: !!reference && reference.passation !== sections.passation,
    execution: !!reference && reference.execution !== sections.execution,
  };
  const dirty = !isEditMode || Object.values(modifiees).some(Boolean);
  const aDesModifications = !!reference && Object.values(modifiees).some(Boolean);

  useEffect(() => {
    if (!aDesModifications || readOnly) return;
    blockNavigation("La planification a des modifications non enregistrées. Quitter sans enregistrer ?");
    const avantDeQuitter = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avantDeQuitter);
    return () => {
      unblockNavigation();
      window.removeEventListener("beforeunload", avantDeQuitter);
    };
  }, [aDesModifications, readOnly, blockNavigation, unblockNavigation]);

  // ── Chargement ──
  async function chargerPlanification(): Promise<Planning | null> {
    try {
      return await planningService.getOne(projectCode, activityPath);
    } catch {
      return null; // 404 : pas encore de planification
    }
  }

  useEffect(() => {
    (async () => {
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
        const existante = await chargerPlanification();
        setPlanning(existante);
        if (existante) populateFormFromPlanning(existante);
      } catch (error) {
        console.error("Erreur chargement:", error);
        toast.error("Erreur lors du chargement");
      } finally {
        setLoading(false);
        figerReference();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, activityPath]);

  // ── Informations dérivées ──
  const rates = (project?.financement?.tauxChange as Record<string, number> | undefined) ?? DEFAULT_EXCHANGE_RATES;
  const budgetTotalFCFA = useMemo(() => budgetInitial.reduce((sum, b) => sum + toFCFA(b.montant, b.devise, rates), 0), [budgetInitial, rates]);
  const unit = useMemo(() => (project ? findUnit(project.components, activityPath) : undefined), [project, activityPath]);
  const numero = useMemo(() => (project ? wbsNumbers(project.components).get(activityPath) : undefined), [project, activityPath]);
  const chemin = useMemo(() => {
    if (!project || !unit) return [];
    const units = listUnits(project.components);
    return unit.ancestors.map((id) => units.find((u) => u.id === id)?.name).filter(Boolean) as string[];
  }, [project, unit]);

  const calendrierEtude = useMemo(() => calculerCalendrierEtude(livrables, dateT0), [livrables, dateT0]);
  const problemesEtude = useMemo(() => [...new Set(calendrierEtude.problemes.map((p) => p.message))], [calendrierEtude]);
  const calendrierExecution = useMemo(() => calculerCalendrierEtude(taches, dateT0), [taches, dateT0]);
  const problemesExecution = useMemo(() => [...new Set(calendrierExecution.problemes.map((p) => p.message))], [calendrierExecution]);

  const phases: PhaseSummary[] = useMemo(() => {
    const lignesPassation: object[] = passationData?.lignesPassation ?? passationData?.etapesPassation ?? [];

    const livrablesNommes = livrables.filter((l) => l.intitule?.trim()).length;
    const marches = lignesPassation.filter((l) => Object.values(l).some((v) => typeof v === "string" && v.trim() && v !== "1")).length;
    const tachesNommees = taches.filter((t) => t.designation?.trim()).length;

    const resume = (key: PhaseKey, contenu: number, mot: string, periode = periodeDesLignes(lignesPassation)) => {
      const base = { key, active: actives[key], periode, dirty: modifiees[key] };
      if (!actives[key]) return { ...base, tone: "off" as const, status: "Non prévue" };
      if (contenu === 0) return { ...base, tone: "todo" as const, status: "À planifier" };
      return { ...base, tone: "ok" as const, status: pluriel(contenu, mot) };
    };

    const etude = resume("etude", livrablesNommes, "livrable", { debut: calendrierEtude.debut, fin: calendrierEtude.fin });
    return [
      hasEtudePrealable && problemesEtude.length
        ? { ...etude, tone: "warn" as const, status: `${pluriel(problemesEtude.length, "problème")} à corriger` }
        : etude,
      resume("passation", marches, "marché"),
      (() => {
        const execution = resume("execution", tachesNommees, "tâche", { debut: calendrierExecution.debut, fin: calendrierExecution.fin });
        return hasExecution && problemesExecution.length
          ? { ...execution, tone: "warn" as const, status: `${pluriel(problemesExecution.length, "problème")} à corriger` }
          : execution;
      })(),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livrables, calendrierEtude, problemesEtude, passationData, taches, calendrierExecution, problemesExecution, hasEtudePrealable, hasPassation, hasExecution, sections, reference]);

  // ── Phases ──
  const retirerPhase = (key: PhaseKey) => {
    const contenu = phases.find((p) => p.key === key)?.tone !== "todo";
    if (contenu && !confirm(`Retirer la phase « ${PHASE_LABELS[key]} » ? Ses données ne seront plus enregistrées.`)) return;
    setActive[key](false);
  };

  // ── Enregistrement ──
  async function handleSave() {
    if (!hasEtudePrealable && !hasPassation && !hasExecution) {
      toast.error("Planifiez au moins une phase");
      return;
    }
    if (budgetInitial.every((b) => !b.montant)) {
      toast.error("Renseignez le budget de l'activité");
      return;
    }
    if (hasEtudePrealable && problemesEtude.length) {
      setSelected("etude");
      toast.error(`Étude : ${problemesEtude[0]}${problemesEtude.length > 1 ? ` (+${problemesEtude.length - 1})` : ""}`);
      return;
    }
    if (hasExecution && problemesExecution.length) {
      setSelected("execution");
      toast.error(`Exécution : ${problemesExecution[0]}${problemesExecution.length > 1 ? ` (+${problemesExecution.length - 1})` : ""}`);
      return;
    }

    setSaving(true);
    try {
      const cleanDates = (arr: any[]) =>
        arr.map((item) => ({ ...item, dateDebut: item.dateDebut || undefined, dateFin: item.dateFin || undefined, dateEcheance: item.dateEcheance || undefined }));

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
        // Une phase retirée n'emporte pas ses données
        livrables: hasEtudePrealable ? livrables.map(livrablePourApi) : [],
        ...(hasPassation && passationData
          ? { typePassation: passationData.typePassation, etapesPassation: cleanDates(passationData.etapesPassation || []) }
          : {}),
        // Une phase retirée n'emporte pas ses tâches
        tachesExecution: hasExecution ? taches.map(tachePourApi) : [],
      };

      if (isEditMode) {
        await planningService.update(projectCode, activityPath, data as unknown as UpdatePlanningDto);
      } else {
        await planningService.create({ ...data, projectCode, activityPath } as unknown as CreatePlanningDto);
      }
      toast.success(isEditMode ? "Planification enregistrée" : "Planification créée");

      // On reste sur la page, avec la version calculée par le serveur.
      const enregistree = await chargerPlanification();
      setPlanning(enregistree);
      if (enregistree) populateFormFromPlanning(enregistree, false);
      figerReference();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error(messageApi(error, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer toute la planification de cette activité ?")) return;
    try {
      await planningService.delete(projectCode, activityPath);
      unblockNavigation();
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
  const phaseOuverte = phases.find((p) => p.key === selected)!;

  return (
    <div className="flex flex-col h-full">
      {/* ── 1. L'activité ── */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-5 pb-3 flex-shrink-0">
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
                {numero && <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">{numero}</span>}
                <span className="truncate">{activityName}</span>
              </h1>
              <div className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 truncate">
                {[project.name, ...chemin].join(" › ")} • {typeInfo.label}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/planification/${projectCode}?activity=${encodeURIComponent(activityPath)}`} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-inset)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-sm font-semibold hover:bg-[var(--bg-surface-hover)]">
              <BarChart3 size={16} /> Voir le Gantt
            </Link>
            {!readOnly && isEditMode && (
              <button onClick={handleDelete} title="Supprimer toute la planification" className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-600 rounded-[var(--radius-md)] text-sm font-semibold hover:bg-red-500/20">
                <Trash2 size={16} />
              </button>
            )}
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="relative flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-[var(--radius-md)] text-sm font-semibold hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} /> {saving ? "Enregistrement..." : "Enregistrer"}
                {aDesModifications && !saving && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-[var(--bg-surface)]" title="Modifications non enregistrées" />}
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 -ml-2.5 flex items-center gap-2">
          <ActivityGeneralStrip
            dateT0={dateT0}
            onDateT0={setDateT0}
            budgets={budgetInitial}
            onBudgets={setBudgetInitial}
            budgetTotalFCFA={budgetTotalFCFA}
            responsable={responsablePrincipal}
            onResponsable={setResponsablePrincipal}
            readOnly={readOnly}
          />
          {modifiees.general && <span className="w-2 h-2 rounded-full bg-amber-500" title="Modifications non enregistrées" />}
          {readOnly && !permissionsLoading && <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">Consultation : seul le chef de projet modifie la planification.</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">
        {/* ── 2. Ses phases ── */}
        <ActivityPhaseBar phases={phases} selected={selected} onSelect={setSelected} dateT0={dateT0 || undefined} />

        {/* ── 3. La phase ouverte ── */}
        {!phaseOuverte.active && (
          <div className="flex flex-col items-center justify-center gap-3 py-14 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--border-default)] text-center">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">La phase « {PHASE_LABELS[selected]} » n&apos;est pas prévue pour cette activité.</p>
            {!readOnly && (
              <button onClick={() => setActive[selected](true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90">
                <Plus size={16} /> Planifier cette phase
              </button>
            )}
          </div>
        )}

        {phaseOuverte.active && !readOnly && (
          <div className={`flex justify-end -mb-3 ${selected === "passation" ? "" : "max-w-6xl"}`}>
            <button onClick={() => retirerPhase(selected)} className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-500/10 rounded-[var(--radius-md)]">
              <X size={13} /> Retirer cette phase
            </button>
          </div>
        )}

        {/* Les phases prévues restent montées : leur saisie est conservée d'un onglet à l'autre. */}
        {hasEtudePrealable && (
          <div hidden={selected !== "etude"} className="max-w-6xl">
            <PlanningFormEtude livrables={livrables} onChange={setLivrables} dateT0={dateT0} readOnly={readOnly} />
          </div>
        )}

        {hasPassation && (
          <div hidden={selected !== "passation"} className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-300 dark:border-green-700 rounded-[var(--radius-lg)] p-4 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-green-800 dark:text-green-300">Plan de Passation des Marchés (PPM)</h3>
                <p className="text-[11px] text-green-700 dark:text-green-400">Planification de la passation de cette activité.</p>
              </div>
              <Link href={`/planification/${projectCode}/ppm`} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-[var(--radius-md)] text-[12px] font-bold">
                <FileText size={14} /> Portail vers le PPM
              </Link>
            </div>
            <PlanningFormPassation data={passationData} onChange={setPassationData} projectId={projectCode} />
          </div>
        )}

        {hasExecution && (
          <div hidden={selected !== "execution"} className="max-w-6xl">
            <PlanningFormExecution taches={taches} onChange={setTaches} dateT0={dateT0} readOnly={readOnly} />
          </div>
        )}
      </div>
    </div>
  );
}

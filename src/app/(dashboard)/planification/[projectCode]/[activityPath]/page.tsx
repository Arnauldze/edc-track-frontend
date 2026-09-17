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
import { BarChart3, ChevronLeft, Plus, Save, Trash2, X } from "lucide-react";
import { getProjectById, getLeafActivities, type Project } from "@/lib/projectStore";
import { planningService, type CreatePlanningDto, type LignePassation, type Livrable, type Planning, type TacheExecution, type UpdatePlanningDto } from "@/services/api/planningService";
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
import { lignePassationDepuisApi, lignePassationPourApi, lignePassationRenseignee } from "@/lib/passationApi";
import { DEFAULT_EXCHANGE_RATES } from "@/lib/helpers/currencyHelpers";
import { typeActivite, voile, type ActivityType } from "@/lib/activityTypes";
import { Button, buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/LoadingSpinner";

type Budget = { devise: string; montant: number; pourcentage?: number };

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
  const [passationData, setPassationData] = useState<{ typePassation?: string; lignesPassation: LignePassation[] } | null>(null);
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
    setPassationData(
      p.hasPassation
        ? { typePassation: p.typePassation, lignesPassation: (p.lignesPassation ?? []).map(lignePassationDepuisApi) }
        : null,
    );
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
    const lignesPassation = passationData?.lignesPassation ?? [];

    const livrablesNommes = livrables.filter((l) => l.intitule?.trim()).length;
    const marches = lignesPassation.filter(lignePassationRenseignee).length;
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
        // Une phase retirée n’emporte pas ses marchés
        lignesPassation: hasPassation
          ? (passationData?.lignesPassation ?? []).filter(lignePassationRenseignee).map(lignePassationPourApi)
          : [],
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
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-6 text-primary" />
          <p className="text-sm text-fg-muted">Chargement de l&apos;activité…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-fg-muted">Projet introuvable</p>
        <Link href="/planification" className="mt-2 inline-block text-sm font-semibold text-primary-fg hover:underline">
          Retour à la planification
        </Link>
      </div>
    );
  }

  const typeInfo = typeActivite(activityType);
  const ActivityIcon = typeInfo.icon;
  const phaseOuverte = phases.find((p) => p.key === selected)!;

  return (
    <div className="flex flex-col h-full">
      {/* ── 1. L'activité ── */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-line bg-surface px-8 pt-3.5 pb-3">
        <Link
          href={`/planification/${projectCode}`}
          className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-fg-muted hover:text-primary-fg"
        >
          <ChevronLeft size={14} /> Retour au projet
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: voile(typeInfo.couleur), color: typeInfo.couleur }}
            >
              <ActivityIcon size={20} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.75">
              <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-fg">
                {numero && (
                  <span className="rounded border border-line bg-inset px-1.5 py-px font-mono text-[11px] font-medium text-fg-muted">
                    {numero}
                  </span>
                )}
                <span className="truncate">{activityName}</span>
              </h1>
              <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-fg-muted">
                <span className="truncate">{[project.name, ...chemin].join(" › ")}</span>
                <span className="text-fg-subtle">·</span>
                <span aria-hidden className="size-1.75 shrink-0 rounded-xs" style={{ background: typeInfo.couleur }} />
                <span className="whitespace-nowrap">{typeInfo.label}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/planification/${projectCode}?activity=${encodeURIComponent(activityPath)}`}
              className={buttonClasses({ variant: "secondary" })}
            >
              <BarChart3 /> Voir le Gantt
            </Link>
            {!readOnly && isEditMode && (
              <Button variant="danger" size="icon" onClick={handleDelete} title="Supprimer toute la planification" aria-label="Supprimer toute la planification">
                <Trash2 />
              </Button>
            )}
            {!readOnly && (
              <div className="relative flex">
                <Button onClick={handleSave} disabled={!dirty} loading={saving}>
                  <Save /> {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
                {aDesModifications && !saving && (
                  <span
                    className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-surface bg-accent"
                    title="Modifications non enregistrées"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="-ml-2.5 flex items-center gap-2">
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
          {modifiees.general && <span className="size-2 rounded-full bg-accent" title="Modifications non enregistrées" />}
          {readOnly && !permissionsLoading && (
            <span className="ml-auto text-[11px] text-fg-subtle">Consultation : seul le chef de projet modifie la planification.</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">
        {/* ── 2. Ses phases ── */}
        <ActivityPhaseBar phases={phases} selected={selected} onSelect={setSelected} dateT0={dateT0 || undefined} />

        {/* ── 3. La phase ouverte ── */}
        {!phaseOuverte.active && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line py-14 text-center">
            <p className="text-sm font-semibold text-fg">La phase « {PHASE_LABELS[selected]} » n&apos;est pas prévue pour cette activité.</p>
            {!readOnly && (
              <Button variant="accent" onClick={() => setActive[selected](true)}>
                <Plus /> Planifier cette phase
              </Button>
            )}
          </div>
        )}

        {phaseOuverte.active && !readOnly && (
          <div className={`-mb-3 flex justify-end ${selected === "passation" ? "" : "max-w-6xl"}`}>
            <Button variant="ghost" size="sm" onClick={() => retirerPhase(selected)} className="hover:bg-danger-subtle hover:text-danger">
              <X /> Retirer cette phase
            </Button>
          </div>
        )}

        {/* Les phases prévues restent montées : leur saisie est conservée d'un onglet à l'autre. */}
        {hasEtudePrealable && (
          <div hidden={selected !== "etude"} className="max-w-6xl">
            <PlanningFormEtude livrables={livrables} onChange={setLivrables} dateT0={dateT0} readOnly={readOnly} />
          </div>
        )}

        {hasPassation && (
          <div hidden={selected !== "passation"}>
            <PlanningFormPassation data={passationData} onChange={setPassationData} readOnly={readOnly} />
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

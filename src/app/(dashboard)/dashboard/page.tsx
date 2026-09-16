"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Clock,
  FolderOpen,
  Info,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { usePlanningsByProject } from "@/hooks/usePlannings";
import { useAlerts } from "@/hooks/useAlerts";
import { useHydrated } from "@/hooks/useClientState";
import {
  avancementMoyen,
  delaiLisible,
  prochainesEcheances,
  syntheseProjet,
  LIBELLES_STATUT,
  type Echeance,
  type StatutProjet,
  type SyntheseProjet,
} from "@/lib/dashboard";
import type { Alert, AlertSeverity } from "@/services/api/alertService";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ══════════════════════════════════════════════════════════════
// TABLEAU DE BORD
// Chiffres clés, projets, alertes non lues et prochaines échéances.
// Tout est déduit des projets et de leurs planifications : aucune donnée
// n'est propre à cet écran.
// ══════════════════════════════════════════════════════════════

const COLONNES = "minmax(0, 1fr) 104px 74px 128px 124px";

const TONS_STATUT: Record<StatutProjet, BadgeTone> = {
  termine: "success",
  en_cours: "primary",
  planifie: "success",
  a_planifier: "neutral",
};

const TONS_ALERTE: Record<AlertSeverity, { icone: LucideIcon; classe: string }> = {
  critical: { icone: AlertTriangle, classe: "bg-danger-subtle text-danger" },
  error: { icone: AlertTriangle, classe: "bg-danger-subtle text-danger" },
  warning: { icone: Clock, classe: "bg-warning-subtle text-warning" },
  info: { icone: Info, classe: "bg-primary-subtle text-primary-fg" },
};

const ICONES_ALERTE: Partial<Record<Alert["type"], LucideIcon>> = {
  deadline_approaching: Clock,
  team_change: UserPlus,
};

const dateLongue = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const moisEtAnnee = (date?: Date) => (date ? date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—");
const pourcentage = (valeur?: number) => (valeur === undefined ? "—" : `${Math.round(valeur)} %`);

function depuis(iso: string, aujourdhui: Date): string {
  const minutes = Math.round((aujourdhui.getTime() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 60 * 24) return `il y a ${Math.round(minutes / 60)} h`;
  const jours = Math.round(minutes / (60 * 24));
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ── Chiffre clé ──
function Indicateur({
  icone: Icone,
  libelle,
  valeur,
  detail,
  enCours,
  children,
}: {
  icone: LucideIcon;
  libelle: string;
  valeur: ReactNode;
  detail: ReactNode;
  enCours: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2.5 p-4.5">
      <div className="flex items-center gap-2">
        <Icone aria-hidden className="size-4 text-fg-subtle" strokeWidth={1.8} />
        <span className="text-[12.5px] font-medium text-fg-muted">{libelle}</span>
      </div>
      {enCours ? (
        <>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3.5 w-36" />
        </>
      ) : (
        <>
          <span className="text-[30px] font-bold leading-none tracking-tight">{valeur}</span>
          {children}
          <span className="text-xs text-fg-subtle">{detail}</span>
        </>
      )}
    </Card>
  );
}

// ── Ligne de projet ──
function LigneProjet({ synthese, dernier }: { synthese: SyntheseProjet; dernier: boolean }) {
  return (
    <Link
      href={`/planification/${encodeURIComponent(synthese.code)}`}
      style={{ gridTemplateColumns: COLONNES }}
      className={cn("grid items-center gap-4 px-4.5 py-3 transition-colors hover:bg-hover", !dernier && "border-b border-line")}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-[13px] font-semibold text-fg">{synthese.nom}</span>
        <span className="font-mono text-[11px] text-fg-subtle">{synthese.code}</span>
      </span>
      <span>
        <Badge tone={TONS_STATUT[synthese.statut]} dot>
          {LIBELLES_STATUT[synthese.statut]}
        </Badge>
      </span>
      <span className="text-[13px]">
        {synthese.unitesPlanifiees}/{synthese.unites}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full border border-line bg-inset">
          <span className="block h-full bg-primary" style={{ width: `${Math.round(synthese.avancement ?? 0)}%` }} />
        </span>
        <span className="w-9 text-right text-xs font-semibold">{pourcentage(synthese.avancement)}</span>
      </span>
      <span className="text-xs text-fg-muted">
        {synthese.debut ? `${moisEtAnnee(synthese.debut)} → ${moisEtAnnee(synthese.fin)}` : "Non planifié"}
      </span>
    </Link>
  );
}

// ── Échéance ──
function CarteEcheance({ echeance, aujourdhui, dernier }: { echeance: Echeance; aujourdhui: Date; dernier: boolean }) {
  const jours = (echeance.date.getTime() - aujourdhui.getTime()) / 86_400_000;
  const delai = delaiLisible(echeance.date, aujourdhui);
  return (
    <Link
      href={echeance.href}
      className={cn("flex min-w-0 items-center gap-3 px-4.5 py-3.5 transition-colors hover:bg-hover", !dernier && "border-r border-line")}
    >
      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-inset leading-tight">
        <span className="text-base font-bold">{echeance.date.toLocaleDateString("fr-FR", { day: "2-digit" })}</span>
        <span className="text-[10.5px] text-fg-subtle">{echeance.date.toLocaleDateString("fr-FR", { month: "short" })}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-semibold text-fg">{echeance.titre}</span>
        <span className="truncate text-xs text-fg-muted">
          {echeance.nature} · {echeance.contexte}
        </span>
        <span className="mt-1">
          {jours <= 7 ? (
            <Badge tone="warning">{delai}</Badge>
          ) : (
            <span className="text-xs text-fg-subtle">{delai}</span>
          )}
        </span>
      </span>
    </Link>
  );
}

// ── Alerte ──
function LigneAlerte({ alerte, aujourdhui, dernier }: { alerte: Alert; aujourdhui: Date; dernier: boolean }) {
  const ton = TONS_ALERTE[alerte.severity] ?? TONS_ALERTE.info;
  const Icone = ICONES_ALERTE[alerte.type] ?? ton.icone;
  return (
    <div className={cn("flex items-start gap-3 px-4.5 py-3", !dernier && "border-b border-line")}>
      <span className={cn("flex size-7.5 shrink-0 items-center justify-center rounded-md", ton.classe)}>
        <Icone aria-hidden className="size-4" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-fg">{alerte.title}</span>
        {alerte.message && <span className="text-[12.5px] text-fg-muted">{alerte.message}</span>}
        <span className="text-[11.5px] text-fg-subtle">
          {[alerte.projectId, depuis(alerte.createdAt, aujourdhui)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
    </div>
  );
}

function Vide({ children }: { children: ReactNode }) {
  return <p className="px-4.5 py-8 text-center text-[13px] text-fg-muted">{children}</p>;
}

export default function DashboardPage() {
  const hydrate = useHydrated();
  const aujourdhui = useMemo(() => new Date(), []);

  const { data: projects = [], isLoading: projetsEnCours, isError: projetsEnErreur } = useProjects();
  const codes = useMemo(() => projects.map((project) => project.code), [projects]);
  const { data: planningsParProjet, isLoading: planificationsEnCours } = usePlanningsByProject(codes);
  const { data: alertes = [], isLoading: alertesEnCours } = useAlerts();

  const enCours = projetsEnCours || planificationsEnCours;

  const syntheses = useMemo(
    () => projects.map((project) => syntheseProjet(project, planningsParProjet.get(project.code) ?? [])),
    [projects, planningsParProjet],
  );

  const echeances = useMemo(
    () =>
      prochainesEcheances(
        projects.map((project) => ({ project, plannings: planningsParProjet.get(project.code) ?? [] })),
        aujourdhui,
      ),
    [projects, planningsParProjet, aujourdhui],
  );

  const nonLues = alertes.filter((alerte) => !alerte.isRead);
  const unites = syntheses.reduce((somme, s) => somme + s.unites, 0);
  const unitesPlanifiees = syntheses.reduce((somme, s) => somme + s.unitesPlanifiees, 0);
  const avancement = avancementMoyen(syntheses);
  const parStatut = (statut: StatutProjet) => syntheses.filter((s) => s.statut === statut).length;

  if (projetsEnErreur) {
    return (
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <AlertTriangle aria-hidden className="size-6 text-danger" />
          <p className="text-sm font-semibold text-fg">Les projets n&apos;ont pas pu être chargés.</p>
          <p className="text-[13px] text-fg-muted">Vérifiez votre connexion, puis rechargez la page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-[var(--page-px)] py-[var(--page-py)]">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold tracking-tight text-fg">Tableau de bord</h1>
          <p className="text-[13px] text-fg-muted">Vue d&apos;ensemble des projets et des activités</p>
        </div>
        {hydrate && <span className="text-[12.5px] text-fg-subtle">Au {dateLongue(aujourdhui)}</span>}
      </div>

      {/* ── Chiffres clés ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Indicateur
          icone={FolderOpen}
          libelle="Projets"
          valeur={projects.length}
          enCours={enCours}
          detail={
            [
              parStatut("en_cours") && `${parStatut("en_cours")} en cours`,
              parStatut("planifie") && `${parStatut("planifie")} planifié${parStatut("planifie") > 1 ? "s" : ""}`,
              parStatut("a_planifier") && `${parStatut("a_planifier")} à planifier`,
            ]
              .filter(Boolean)
              .join(" · ") || "Aucun projet"
          }
        />
        <Indicateur
          icone={TrendingUp}
          libelle="Avancement moyen"
          valeur={pourcentage(avancement)}
          enCours={enCours}
          detail="Pondéré par les activités planifiées"
        >
          <span className="h-1.5 overflow-hidden rounded-full border border-line bg-inset">
            <span className="block h-full bg-primary" style={{ width: `${Math.round(avancement ?? 0)}%` }} />
          </span>
        </Indicateur>
        <Indicateur
          icone={CalendarDays}
          libelle="Activités planifiées"
          valeur={`${unitesPlanifiees} / ${unites}`}
          enCours={enCours}
          detail={
            unites - unitesPlanifiees > 0
              ? `${unites - unitesPlanifiees} activité${unites - unitesPlanifiees > 1 ? "s" : ""} à planifier`
              : "Toutes les activités sont planifiées"
          }
        />
        <Indicateur
          icone={Bell}
          libelle="Alertes non lues"
          valeur={nonLues.length}
          enCours={alertesEnCours}
          detail={
            nonLues.some((alerte) => alerte.severity === "error" || alerte.severity === "critical")
              ? "Dont au moins une urgente"
              : "Rien d'urgent"
          }
        />
      </div>

      {/* ── Projets et alertes ── */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Projets"
            actions={
              <Link href="/planification" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-fg hover:underline">
                Voir la planification
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            }
          />
          <div
            style={{ gridTemplateColumns: COLONNES }}
            className="grid gap-4 border-b border-line bg-inset px-4.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-fg-subtle"
          >
            <span>Projet</span>
            <span>Statut</span>
            <span>Planifiées</span>
            <span>Avancement</span>
            <span>Période</span>
          </div>
          {enCours ? (
            <div className="flex flex-col gap-3 p-4.5">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : syntheses.length === 0 ? (
            <Vide>Aucun projet pour le moment.</Vide>
          ) : (
            syntheses.map((synthese, index) => (
              <LigneProjet key={synthese.code} synthese={synthese} dernier={index === syntheses.length - 1} />
            ))
          )}
        </Card>

        <Card>
          <CardHeader
            title="Alertes non lues"
            actions={
              <Link href="/alerts" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-fg hover:underline">
                Toutes
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            }
          />
          {alertesEnCours ? (
            <div className="flex flex-col gap-3 p-4.5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : nonLues.length === 0 ? (
            <Vide>Aucune alerte non lue.</Vide>
          ) : (
            nonLues
              .slice(0, 3)
              .map((alerte, index) => (
                <LigneAlerte
                  key={alerte._id}
                  alerte={alerte}
                  aujourdhui={aujourdhui}
                  dernier={index === Math.min(nonLues.length, 3) - 1}
                />
              ))
          )}
        </Card>
      </div>

      {/* ── Prochaines échéances ── */}
      <Card>
        <CardHeader
          title="Prochaines échéances"
          actions={<span className="text-xs text-fg-subtle">Livrables, tâches et fins de passation à venir</span>}
        />
        {enCours ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-3 px-4.5 py-3.5">
                <Skeleton className="size-11 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : echeances.length === 0 ? (
          <Vide>Aucune échéance à venir dans les planifications enregistrées.</Vide>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {echeances.map((echeance, index) => (
              <CarteEcheance
                key={echeance.id}
                echeance={echeance}
                aujourdhui={aujourdhui}
                dernier={index === echeances.length - 1}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

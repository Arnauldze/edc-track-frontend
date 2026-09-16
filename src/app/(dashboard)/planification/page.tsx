"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Search } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { usePlanningsByProject } from "@/hooks/usePlannings";
import { LIBELLES_STATUT, syntheseProjet, type StatutProjet, type SyntheseProjet } from "@/lib/dashboard";
import type { Project } from "@/services/api/projectService";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// ══════════════════════════════════════════════════════════════
// PLANIFICATION — liste des projets
// Une carte par projet : structure, activités planifiées, avancement et
// période. Les synthèses viennent du même moteur que le tableau de bord.
// ══════════════════════════════════════════════════════════════

const TONS_STATUT: Record<StatutProjet, BadgeTone> = {
  termine: "success",
  en_cours: "primary",
  planifie: "success",
  a_planifier: "neutral",
};

const moisEtAnnee = (date?: Date | string) => {
  if (!date) return undefined;
  const valeur = date instanceof Date ? date : new Date(date);
  return isNaN(valeur.getTime()) ? undefined : valeur.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
};

function Chiffre({ valeur, libelle, title }: { valeur: string | number; libelle: string; title?: string }) {
  return (
    <span title={title} className="flex flex-col gap-0.5 rounded-md bg-inset px-2.5 py-2">
      <span className="text-base font-bold text-fg">{valeur}</span>
      <span className="text-[10.5px] font-medium text-fg-subtle">{libelle}</span>
    </span>
  );
}

function CarteProjet({ project, synthese }: { project: Project; synthese: SyntheseProjet }) {
  const sousComposants = (project.components ?? []).reduce((somme, composant) => somme + (composant.sousComposants?.length ?? 0), 0);
  const debut = moisEtAnnee(synthese.debut ?? project.dateDebut);
  const fin = moisEtAnnee(synthese.fin ?? project.dateFin);
  const avancement = Math.round(synthese.avancement ?? 0);

  return (
    <Card className="flex flex-col transition-colors hover:border-line-strong">
      <div className="flex flex-1 flex-col gap-3.5 p-4.5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-semibold leading-snug text-fg">{project.name}</span>
            <span className="self-start rounded-sm border border-line bg-inset px-1.5 py-px font-mono text-[11px] text-fg-muted">
              {project.code}
            </span>
          </span>
          <Badge tone={TONS_STATUT[synthese.statut]} dot>
            {LIBELLES_STATUT[synthese.statut]}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Chiffre valeur={project.components?.length ?? 0} libelle="Composants" />
          <Chiffre valeur={sousComposants} libelle="Sous-comp." />
          <Chiffre
            valeur={`${synthese.unitesPlanifiees}/${synthese.unites}`}
            libelle="Planifiées"
            title="Activités planifiées sur le nombre d'activités du projet"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between text-xs">
            <span className="text-fg-muted">Avancement</span>
            <span className="font-semibold text-fg">{synthese.avancement === undefined ? "—" : `${avancement} %`}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full border border-line bg-inset">
            <span className="block h-full bg-primary" style={{ width: `${avancement}%` }} />
          </span>
          <span className="text-xs text-fg-subtle">{debut ? `${debut} → ${fin ?? "—"}` : "Non planifié"}</span>
        </div>
      </div>

      <Link
        href={`/planification/${encodeURIComponent(project.code)}`}
        className="flex h-11 items-center justify-center gap-1.5 border-t border-line bg-inset text-[12.5px] font-semibold text-primary-fg transition-colors hover:bg-hover"
      >
        Ouvrir la planification
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </Card>
  );
}

function CarteChargement() {
  return (
    <Card className="flex flex-col gap-3.5 p-4.5">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-1/3" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <Skeleton className="h-1.5 rounded-full" />
      <Skeleton className="h-3 w-2/5" />
    </Card>
  );
}

export default function PlanificationPage() {
  const [recherche, setRecherche] = useState("");
  const { data: projects = [], isLoading: projetsEnCours, isError } = useProjects();
  const codes = useMemo(() => projects.map((project) => project.code), [projects]);
  const { data: planningsParProjet, isLoading: planificationsEnCours } = usePlanningsByProject(codes);

  const enCours = projetsEnCours || planificationsEnCours;

  const cartes = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return projects
      .filter((project) => !terme || `${project.name} ${project.code}`.toLowerCase().includes(terme))
      .map((project) => ({ project, synthese: syntheseProjet(project, planningsParProjet.get(project.code) ?? []) }));
  }, [projects, planningsParProjet, recherche]);

  return (
    <div className="flex flex-col gap-5 px-(--page-px) py-(--page-py)">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold tracking-tight text-fg">Planification</h1>
          <p className="text-[13px] text-fg-muted">Planification et ordonnancement des activités des projets</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-fg-subtle">
            {enCours ? "Chargement…" : `${projects.length} projet${projects.length > 1 ? "s" : ""}`}
          </span>
          <div className="w-64">
            <label htmlFor="recherche-projet" className="sr-only">
              Rechercher un projet
            </label>
            <Input
              id="recherche-projet"
              type="search"
              placeholder="Rechercher un projet…"
              leftIcon={Search}
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
            />
          </div>
        </div>
      </div>

      {isError ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <AlertTriangle aria-hidden className="size-6 text-danger" />
          <p className="text-sm font-semibold text-fg">Les projets n&apos;ont pas pu être chargés.</p>
          <p className="text-[13px] text-fg-muted">Vérifiez votre connexion, puis rechargez la page.</p>
        </Card>
      ) : enCours ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CarteChargement />
          <CarteChargement />
          <CarteChargement />
        </div>
      ) : cartes.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CalendarDays aria-hidden className="size-6 text-fg-subtle" />
          <p className="text-sm font-semibold text-fg">
            {recherche.trim() ? "Aucun projet ne correspond à cette recherche." : "Aucun projet pour le moment."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cartes.map(({ project, synthese }) => (
            <CarteProjet key={project.code} project={project} synthese={synthese} />
          ))}
        </div>
      )}
    </div>
  );
}

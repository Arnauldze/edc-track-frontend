"use client";

// ══════════════════════════════════════════════════════════════
// PLAN DE PASSATION DES MARCHÉS (PPM) DU PROJET
//
// Document officiel, au format du modèle EDC : un marché par ligne, les
// étapes en colonnes. Il n'est pas saisi ici : chaque ligne reprend la
// passation d'une activité (lib/passationEtapes.ts). Une étape du modèle
// retirée du marché est « N/A » ; une étape ajoutée à la main est citée dans
// la colonne « Hors modèle ».
// ══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { getProjectById, type Project } from "@/lib/projectStore";
import { planningService, type Planning } from "@/services/api/planningService";
import { MODELE_PPM, lignePPM, type LignePPM } from "@/lib/passationEtapes";
import { toDay } from "@/lib/livrableSchedule";
import { wbsNumbers } from "@/lib/structureOps";
import { typeActivite } from "@/lib/activityTypes";
import { toast } from "@/lib/toastStore";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/LoadingSpinner";

interface Colonne {
  label: string;
  largeur: number;
  /** Texte de la cellule, aussi utilisé pour l'export. */
  valeur: (ligne: LignePPM) => string;
  alignement?: "droite" | "centre";
}

interface Groupe {
  label: string;
  couleur: string;
  colonnes: Colonne[];
}

const dateCourte = (jour?: string) =>
  jour ? new Date(`${jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

const nombre = (valeur?: number) => (valeur === undefined ? "" : Math.round(valeur).toLocaleString("fr-FR"));

/** Étape du modèle : sa date (ou son choix), vide si elle n'est pas encore renseignée, « N/A » si elle a été retirée. */
const celluleEtape = (cle: string) => (ligne: LignePPM) => {
  const etape = ligne.etapes[cle];
  if (!etape) return "N/A";
  return etape.choix ?? dateCourte(toDay(etape.date));
};

const GROUPES: Groupe[] = [
  {
    label: "Identification",
    couleur: "var(--text-secondary)",
    colonnes: [
      { label: "Type d'AO", largeur: 88, valeur: (l) => l.typeAO ?? "", alignement: "centre" },
      { label: "Prestation", largeur: 120, valeur: (l) => typeActivite(l.activityType).court },
      { label: "Montant (FCFA)", largeur: 130, valeur: (l) => nombre(l.montant), alignement: "droite" },
      { label: "Financement", largeur: 120, valeur: (l) => l.sourceFinancement ?? "" },
      { label: "Imputation", largeur: 120, valeur: (l) => l.imputationBudgetaire ?? "" },
    ],
  },
  ...MODELE_PPM.map((groupe) => ({
    label: groupe.label,
    couleur: groupe.couleur,
    colonnes: groupe.etapes.map((etape) => ({ label: etape.designation, largeur: 96, valeur: celluleEtape(etape.cle), alignement: "centre" as const })),
  })),
  {
    label: "Synthèse et exécution",
    couleur: "var(--text-secondary)",
    colonnes: [
      { label: "Délai passation (j)", largeur: 104, valeur: (l) => nombre(l.delaiPassation), alignement: "droite" },
      { label: "OS démarrage", largeur: 96, valeur: (l) => dateCourte(toDay(l.synthese.osDeDemarrage)), alignement: "centre" },
      { label: "Délai exéc. (j)", largeur: 96, valeur: (l) => nombre(l.synthese.delaiGlobalExecution), alignement: "droite" },
      { label: "Réception prov.", largeur: 104, valeur: (l) => dateCourte(toDay(l.synthese.dateReceptionProvisoire)), alignement: "centre" },
      { label: "Garantie (j)", largeur: 88, valeur: (l) => nombre(l.synthese.periodeGarantie), alignement: "droite" },
      { label: "Réception déf.", largeur: 104, valeur: (l) => dateCourte(toDay(l.synthese.dateReceptionDefinitive)), alignement: "centre" },
      {
        label: "Hors modèle",
        largeur: 200,
        valeur: (l) => l.horsModele.map((e) => (e.date ? `${e.designation} (${dateCourte(toDay(e.date))})` : e.designation)).join(" ; "),
      },
    ],
  },
];

const COLONNES = GROUPES.flatMap((g) => g.colonnes);
const largeurGroupe = (g: Groupe) => g.colonnes.reduce((s, c) => s + c.largeur, 0);

export default function PPMPage() {
  const params = useParams();
  const projectCode = typeof params.projectCode === "string" ? params.projectCode : "";

  const [project, setProject] = useState<Project | null>(null);
  const [plannings, setPlannings] = useState<Planning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [proj, plans] = await Promise.all([getProjectById(projectCode), planningService.getByProject(projectCode)]);
        setProject(proj ?? null);
        setPlannings(plans);
      } catch (error) {
        console.error("Erreur chargement PPM:", error);
        toast.error("Erreur lors du chargement du PPM");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectCode]);

  // Un marché par activité dont la passation est prévue, dans l'ordre de la structure.
  const numeros = useMemo(() => (project ? wbsNumbers(project.components) : new Map<string, string>()), [project]);
  const lignes = useMemo(() => {
    const ordre = (path: string) => (numeros.get(path) ?? "~").split(".").map((n) => n.padStart(4, "0")).join(".");
    return plannings
      .filter((p) => p.hasPassation)
      .sort((a, b) => ordre(a.activityPath).localeCompare(ordre(b.activityPath)))
      .map(lignePPM);
  }, [plannings, numeros]);

  const exporter = () => {
    const entete = ["N°", "Marché", "Responsable", ...COLONNES.map((c) => c.label)];
    const corps = lignes.map((l) => [numeros.get(l.activityPath) ?? "", l.designation, l.responsable ?? "", ...COLONNES.map((c) => c.valeur(l))]);
    const feuille = XLSX.utils.aoa_to_sheet([entete, ...corps]);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "PPM");
    XLSX.writeFile(classeur, `PPM_${projectCode}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6 text-primary-fg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary-fg">
            <FileSpreadsheet size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-fg">Plan de passation des marchés</h1>
            <p className="truncate text-[12.5px] text-fg-muted">
              {project?.name ?? projectCode} · {lignes.length} marché{lignes.length > 1 ? "s" : ""} · repris de la passation de chaque activité
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/planification/${projectCode}`} className="inline-flex h-8.5 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-fg-muted hover:bg-hover hover:text-fg">
            <ArrowLeft size={15} /> Planification du projet
          </Link>
          <Button variant="secondary" onClick={exporter} disabled={!lignes.length}>
            <Download /> Exporter en Excel
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {lignes.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-line py-14 text-center">
            <p className="text-sm font-semibold text-fg">Aucune activité de ce projet n&apos;a de passation prévue.</p>
            <p className="mt-1 text-[12px] text-fg-muted">Planifiez la phase « Passation » d&apos;une activité : son marché apparaîtra ici.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="flex">
              {/* Colonne du marché, figée */}
              <div className="w-72 shrink-0 border-r border-line-strong">
                <div className="h-7.5 border-b border-line bg-inset" />
                <div className="flex h-8.5 items-center gap-2.5 border-b border-line bg-inset px-3 text-[11px] font-semibold text-fg-subtle">
                  <span className="w-10">N°</span>
                  <span>Marché</span>
                </div>
                {lignes.map((l) => (
                  <Link
                    key={l.activityPath}
                    href={`/planification/${projectCode}/${encodeURIComponent(l.activityPath)}`}
                    title="Ouvrir la planification de l'activité"
                    className="flex h-11 items-center gap-2.5 border-b border-line px-3 hover:bg-hover"
                  >
                    <span className="w-10 shrink-0 font-mono text-[11px] text-fg-muted">{numeros.get(l.activityPath) ?? ""}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-fg">{l.designation}</span>
                      {l.responsable && <span className="block truncate text-[11px] text-fg-muted">{l.responsable}</span>}
                    </span>
                  </Link>
                ))}
              </div>

              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="w-max">
                  <div className="flex">
                    {GROUPES.map((g) => (
                      <div
                        key={g.label}
                        className="flex h-7.5 shrink-0 items-center border-r border-line bg-inset px-2.5 text-[11px] font-bold tracking-wide uppercase"
                        style={{ width: largeurGroupe(g), borderTop: `2px solid ${g.couleur}`, color: g.couleur }}
                      >
                        {g.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex border-y border-line bg-inset">
                    {COLONNES.map((c, i) => (
                      <div
                        key={i}
                        title={c.label}
                        className="flex h-8.5 shrink-0 items-center truncate border-r border-line px-2 text-[11px] font-semibold text-fg-subtle"
                        style={{ width: c.largeur }}
                      >
                        {c.label}
                      </div>
                    ))}
                  </div>
                  {lignes.map((l) => (
                    <div key={l.activityPath} className="flex h-11 border-b border-line">
                      {COLONNES.map((c, i) => {
                        const texte = c.valeur(l);
                        const discret = texte === "N/A";
                        return (
                          <div
                            key={i}
                            title={texte}
                            className={`flex shrink-0 items-center truncate border-r border-line px-2 text-[12px] ${
                              c.alignement === "droite" ? "justify-end" : c.alignement === "centre" ? "justify-center" : ""
                            } ${discret ? "italic text-fg-subtle" : "text-fg"}`}
                            style={{ width: c.largeur }}
                          >
                            {texte}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 text-[11.5px] text-fg-subtle">
          Lecture seule : chaque ligne se modifie dans la planification de la passation de l&apos;activité (cliquez sur le marché).{" "}
          <em>N/A</em> : étape du modèle retirée de ce marché. Le montant et la prestation sont le budget et le type de l&apos;activité.
          Non obj. BF : non-objection du bailleur de fonds.
        </p>
      </div>
    </div>
  );
}

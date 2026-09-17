"use client";

// ══════════════════════════════════════════════════════════════
// PLAN DE PASSATION DES MARCHÉS (PPM)
// Tableau fidèle au modèle EDC : un marché par ligne, les étapes en colonnes,
// regroupées par phase du processus. La colonne du marché reste visible
// pendant le défilement horizontal.
// La ligne est saisie en texte ; lib/passationApi.ts la convertit pour l'API.
// ══════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState , type ReactNode } from "react";
import { Briefcase, ChevronLeft, ChevronRight, Plus, Trash2, Upload } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { voile } from "@/lib/activityTypes";
import { lignePassationRenseignee } from "@/lib/passationApi";
import type { LignePassation } from "@/services/api/planningService";

const EMPTY_LIGNE: LignePassation = {
  numero: "", designation: "", typeAO: "", typePrestation: "",
  montantPrevisionnel: "", sourceFinancement: "", imputationBudgetaire: "",
  saisineCIPM: "", examenDAOCIPM: "", nonObjectionBF1: "", lancementAO: "",
  depouillementOffres: "", rapportAnalyseSCA: "", examenRapportCIPM: "", nonObjectionBF2: "",
  ouvertureOF: "", rapportAnalyseOF: "", propositionAttributionCIPM: "", nonObjectionBF3: "",
  publicationResultats: "", souscriptionMarche: "", saisineCIPM2: "", examenMarcheCIPM: "",
  visaCA: "", nonObjectionBF4: "", signatureMarche: "", notificationMarche: "",
  enregistrementMarche: "", delaiGlobalPassation: "", osDeDemarrage: "",
  delaiGlobalExecution: "", dateReceptionProvisoire: "", periodeGarantie: "", dateReceptionDefinitive: "",
};

interface ColDef {
  key: keyof LignePassation;
  label: string;
  type: "text" | "date" | "number" | "select";
  width?: number;
  options?: string[];
  /** Colonne déduite des autres : affichée, jamais saisie. */
  calculee?: boolean;
}

interface ColGroup {
  label: string;
  /** Rôle de couleur du design system, jamais une teinte en dur. */
  couleur: string;
  cols: ColDef[];
}

const LARGEUR = 118;

const COL_GROUPS: ColGroup[] = [
  {
    label: "Identification",
    couleur: "var(--text-secondary)",
    cols: [
      { key: "typeAO", label: "Type d'AO", type: "select", options: ["DC", "AONO", "AONR", "AOIO", "AMI", "Gré à gré"] },
      { key: "typePrestation", label: "Prestation", type: "select", options: ["Travaux", "Fourniture", "SPI", "Services"] },
      { key: "montantPrevisionnel", label: "Montant prév.", type: "number", width: 134 },
      { key: "sourceFinancement", label: "Financement", type: "text", width: 134 },
      { key: "imputationBudgetaire", label: "Imputation", type: "text", width: 134 },
    ],
  },
  {
    label: "Processus de sélection",
    couleur: "var(--primary-text)",
    cols: [
      { key: "saisineCIPM", label: "Saisine CIPM", type: "date" },
      { key: "examenDAOCIPM", label: "Examen DAO CIPM", type: "date" },
      { key: "nonObjectionBF1", label: "Non obj. BF", type: "date" },
      { key: "lancementAO", label: "Lancement AO", type: "date" },
      { key: "depouillementOffres", label: "Dépouillement", type: "date" },
      { key: "rapportAnalyseSCA", label: "Rapport SCA", type: "date" },
      { key: "examenRapportCIPM", label: "Examen rapp. CIPM", type: "date" },
      { key: "nonObjectionBF2", label: "Non obj. BF", type: "date" },
    ],
  },
  {
    label: "Offres financières",
    couleur: "var(--accent-text)",
    cols: [
      { key: "ouvertureOF", label: "Ouverture OF", type: "date" },
      { key: "rapportAnalyseOF", label: "Rapport OF", type: "date" },
      { key: "propositionAttributionCIPM", label: "Proposition CIPM", type: "date" },
      { key: "nonObjectionBF3", label: "Non obj. BF", type: "date" },
      { key: "publicationResultats", label: "Publication rés.", type: "date" },
    ],
  },
  {
    label: "Contractualisation",
    couleur: "var(--success)",
    cols: [
      { key: "souscriptionMarche", label: "Souscription", type: "date" },
      { key: "saisineCIPM2", label: "Saisine CIPM", type: "date" },
      { key: "examenMarcheCIPM", label: "Examen marché CIPM", type: "date" },
      { key: "visaCA", label: "VISA CA", type: "select", options: ["OUI", "NON", "N/A"], width: 96 },
      { key: "nonObjectionBF4", label: "Non obj. BF", type: "date" },
      { key: "signatureMarche", label: "Signature", type: "date" },
      { key: "notificationMarche", label: "Notification", type: "date" },
      { key: "enregistrementMarche", label: "Enregistrement", type: "date" },
    ],
  },
  {
    label: "Synthèse et exécution",
    couleur: "var(--text-secondary)",
    cols: [
      { key: "delaiGlobalPassation", label: "Délai passation (j)", type: "number", calculee: true },
      { key: "osDeDemarrage", label: "OS démarrage", type: "date" },
      { key: "delaiGlobalExecution", label: "Délai exéc. (j)", type: "number" },
      { key: "dateReceptionProvisoire", label: "Réception prov.", type: "date" },
      { key: "periodeGarantie", label: "Garantie (j)", type: "number" },
      { key: "dateReceptionDefinitive", label: "Réception déf.", type: "date" },
    ],
  },
];

const ALL_COLS = COL_GROUPS.flatMap((g) => g.cols);
const largeurDe = (col: ColDef) => col.width ?? LARGEUR;
const largeurGroupe = (groupe: ColGroup) => groupe.cols.reduce((somme, col) => somme + largeurDe(col), 0);

const JOUR = 86_400_000;
const LIGNE_PAR_DEFAUT: LignePassation[] = [{ ...EMPTY_LIGNE, numero: "1" }];

const enJours = (debut?: string, fin?: string) => {
  if (!debut || !fin) return undefined;
  const ecart = Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`);
  return Number.isFinite(ecart) ? Math.round(ecart / JOUR) : undefined;
};

const dateCourte = (jour?: string) =>
  jour ? new Date(`${jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

/** Plus petite (ou plus grande) valeur non vide d'un champ, sur toutes les lignes. */
const borne = (lignes: LignePassation[], champ: keyof LignePassation, sens: "min" | "max") => {
  const valeurs = lignes.map((l) => l[champ]).filter((v): v is string => !!v?.trim()).sort();
  return sens === "min" ? valeurs[0] : valeurs[valeurs.length - 1];
};

interface PassationData {
  typePassation?: string;
  lignesPassation: LignePassation[];
}

interface Props {
  data: PassationData | null;
  onChange: (data: PassationData) => void;
  readOnly?: boolean;
  /** Action placée dans l'en-tête de la carte (retirer la phase…). */
  action?: ReactNode;
}

export function PlanningFormPassation({ data, onChange, readOnly = false, action }: Props) {
  const [importOuvert, setImportOuvert] = useState(false);
  const [groupeVise, setGroupeVise] = useState(COL_GROUPS[0].label);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Le tableau lit ses lignes du parent : après un enregistrement, il affiche
  // la version calculée par le serveur. Une ligne d'appel reste offerte tant
  // qu'aucun marché n'est saisi.
  const lignes = data?.lignesPassation?.length ? data.lignesPassation : LIGNE_PAR_DEFAUT;

  const publier = useCallback(
    (suivantes: LignePassation[]) => onChange({ typePassation: data?.typePassation, lignesPassation: suivantes }),
    [onChange, data?.typePassation],
  );

  /** Délai entre la saisine CIPM et l'enregistrement du marché, en jours. */
  const avecDelai = (ligne: LignePassation): LignePassation => {
    const delai = enJours(ligne.saisineCIPM, ligne.enregistrementMarche);
    return { ...ligne, delaiGlobalPassation: delai === undefined ? "" : String(delai) };
  };

  const ajouterLigne = () => publier([...lignes, { ...EMPTY_LIGNE, numero: String(lignes.length + 1) }]);

  const retirerLigne = (index: number) => {
    const restantes = lignes.filter((_, i) => i !== index);
    publier(restantes.length ? restantes : []);
  };

  const modifierLigne = (index: number, champ: keyof LignePassation, valeur: string) =>
    publier(lignes.map((ligne, i) => (i === index ? avecDelai({ ...ligne, [champ]: valeur }) : ligne)));

  const importer = (rows: Record<string, string>[]) =>
    publier(
      rows.map((row, i) =>
        avecDelai({
          ...EMPTY_LIGNE,
          ...row,
          numero: row.numero || String(i + 1),
          designation: row.designation || row.nom || "",
        }),
      ),
    );

  /** Amène le groupe de colonnes demandé au bord gauche de la zone défilante. */
  const allerAuGroupe = (label: string) => {
    setGroupeVise(label);
    const avant = COL_GROUPS.slice(0, COL_GROUPS.findIndex((g) => g.label === label));
    scrollRef.current?.scrollTo({ left: avant.reduce((somme, g) => somme + largeurGroupe(g), 0), behavior: "smooth" });
  };

  // ── Synthèse de la phase ──
  const synthese = useMemo(() => {
    const saisies = lignes.filter(lignePassationRenseignee);
    const debut = borne(saisies, "saisineCIPM", "min");
    const fin = borne(saisies, "enregistrementMarche", "max");
    const os = borne(saisies, "osDeDemarrage", "min");
    const executions = saisies
      .map((l) => Number(l.delaiGlobalExecution))
      .filter((n) => Number.isFinite(n) && n > 0);
    return {
      marches: saisies.length,
      delaiPassation: enJours(debut, fin),
      periode: debut && fin ? `${dateCourte(debut)} → ${dateCourte(fin)}` : "De la saisine CIPM à l'enregistrement",
      os,
      apresEnregistrement: enJours(fin, os),
      delaiExecution: executions.length ? Math.max(...executions) : undefined,
      finExecution: borne(saisies, "dateReceptionProvisoire", "max"),
    };
  }, [lignes]);

  const chiffres = [
    {
      label: "Délai de passation",
      valeur: synthese.delaiPassation === undefined ? "—" : `${synthese.delaiPassation} jours`,
      detail: synthese.periode,
    },
    {
      label: "Ordre de service",
      valeur: dateCourte(synthese.os),
      detail:
        synthese.apresEnregistrement === undefined
          ? "Démarrage de l'exécution"
          : `Démarrage de l'exécution, ${synthese.apresEnregistrement} j après l'enregistrement`,
    },
    {
      label: "Délai d'exécution",
      valeur: synthese.delaiExecution === undefined ? "—" : `${synthese.delaiExecution} jours`,
      detail: synthese.finExecution ? `Jusqu'au ${dateCourte(synthese.finExecution)}` : "Le plus long des marchés",
    },
    {
      label: "Marchés",
      valeur: synthese.marches === 0 ? "Aucun" : String(synthese.marches),
      detail: synthese.marches === 0 ? "Saisissez le premier marché" : `${ALL_COLS.length + 2} colonnes du modèle EDC`,
    },
  ];

  // ── Cellules ──
  // Pas de largeur ici : chaque appel pose la sienne (une cellule occupe toute
  // sa colonne, le numéro est étroit, la désignation prend la place restante).
  const CELLULE =
    "h-full min-w-0 rounded-none border-0 bg-transparent px-2 text-[12.5px] text-fg tabular-nums " +
    "focus:relative focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary " +
    "disabled:cursor-not-allowed disabled:text-fg-subtle";

  const cellule = (ligne: LignePassation, col: ColDef, index: number) => {
    const commun = {
      value: ligne[col.key],
      disabled: readOnly || col.calculee,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => modifierLigne(index, col.key, e.target.value),
      "aria-label": `${col.label}, marché ${ligne.numero || index + 1}`,
    };

    if (col.type === "select" && col.options) {
      return (
        <select {...commun} className={`${CELLULE} w-full appearance-none`}>
          <option value="">—</option>
          {col.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        {...commun}
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
        min={col.type === "number" ? 0 : undefined}
        className={`${CELLULE} w-full ${col.calculee ? "italic" : ""}`}
      />
    );
  };

  return (
    <>
      <FileImportModal isOpen={importOuvert} onClose={() => setImportOuvert(false)} onImport={importer} importType="passation" />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-md"
              style={{ background: voile("var(--phase-passation)"), color: "var(--phase-passation)" }}
            >
              <Briefcase size={17} />
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[15px] font-semibold text-fg">Plan de passation des marchés</h2>
              <p className="text-[12.5px] text-fg-muted">
                Conforme au modèle PPM EDC · {synthese.marches === 0 ? "aucun marché saisi" : `${synthese.marches} marché${synthese.marches > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button variant="secondary" size="sm" onClick={() => setImportOuvert(true)}>
                <Upload /> Importer depuis Excel
              </Button>
            )}
            {action}
          </div>
        </div>

        {/* Synthèse de la phase */}
        <div className="flex flex-wrap border-b border-line">
          {chiffres.map((chiffre) => (
            <div key={chiffre.label} className="flex min-w-50 flex-1 flex-col gap-0.5 border-r border-line px-4 py-2 last:border-r-0">
              <span className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{chiffre.label}</span>
              <span className="text-[15px] font-bold text-fg">{chiffre.valeur}</span>
              <span className="text-xs text-fg-muted">{chiffre.detail}</span>
            </div>
          ))}
        </div>

        {/* Groupes de colonnes et défilement */}
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-2">
          <div className="inline-flex gap-0.5 rounded-md border border-line bg-inset p-0.75">
            {COL_GROUPS.map((groupe) => (
              <button
                key={groupe.label}
                type="button"
                onClick={() => allerAuGroupe(groupe.label)}
                aria-pressed={groupeVise === groupe.label}
                className={`inline-flex h-7 items-center gap-1.75 rounded px-3 text-[12.5px] transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus ${
                  groupeVise === groupe.label ? "bg-surface font-semibold text-fg shadow-sm" : "font-medium text-fg-muted hover:text-fg"
                }`}
              >
                <span aria-hidden className="size-1.75 rounded-xs" style={{ background: groupe.couleur }} />
                {groupe.label}
                <span className="text-[11px] text-fg-subtle">{groupe.cols.length}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-fg-subtle">{ALL_COLS.length + 2} colonnes</span>
            <Button variant="secondary" size="icon-sm" onClick={() => scrollRef.current?.scrollBy({ left: -3 * LARGEUR, behavior: "smooth" })} aria-label="Défiler vers la gauche">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon-sm" onClick={() => scrollRef.current?.scrollBy({ left: 3 * LARGEUR, behavior: "smooth" })} aria-label="Défiler vers la droite">
              <ChevronRight />
            </Button>
          </div>
        </div>

        {/* Tableau : colonne du marché figée, étapes défilantes */}
        <div className="flex border-t border-line">
          <div className="w-64 shrink-0 border-r border-line-strong">
            <div className="h-7.5 border-b border-line bg-inset" />
            <div className="flex h-8.5 items-center gap-2.5 border-b border-line bg-inset px-2.5 text-[11px] font-semibold text-fg-subtle">
              <span className="w-7">N°</span>
              <span>Marché</span>
            </div>
            {lignes.map((ligne, index) => (
              <div key={index} className="flex h-10.5 items-center gap-1 border-b border-line pl-2.5">
                <input
                  value={ligne.numero}
                  disabled={readOnly}
                  onChange={(e) => modifierLigne(index, "numero", e.target.value)}
                  aria-label={`Numéro du marché ${index + 1}`}
                  className={`${CELLULE} w-7 shrink-0 px-0 font-mono text-[11.5px] text-fg-muted`}
                />
                <input
                  value={ligne.designation}
                  disabled={readOnly}
                  onChange={(e) => modifierLigne(index, "designation", e.target.value)}
                  placeholder="Objet du marché"
                  aria-label={`Désignation du marché ${index + 1}`}
                  className={`${CELLULE} flex-1 font-medium placeholder:text-fg-subtle`}
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => retirerLigne(index)}
                    title={`Supprimer le marché ${ligne.numero || index + 1}`}
                    aria-label={`Supprimer le marché ${ligne.numero || index + 1}`}
                    className="mr-1 flex size-6 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-danger-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
            <div className="w-max">
              <div className="flex">
                {COL_GROUPS.map((groupe) => (
                  <div
                    key={groupe.label}
                    className="flex h-7.5 shrink-0 items-center border-r border-line bg-inset px-2.5 text-[11px] font-bold tracking-wide uppercase"
                    style={{ width: largeurGroupe(groupe), borderTop: `2px solid ${groupe.couleur}`, color: groupe.couleur }}
                  >
                    {groupe.label}
                  </div>
                ))}
              </div>
              <div className="flex border-y border-line bg-inset">
                {ALL_COLS.map((col) => (
                  <div
                    key={col.key}
                    title={col.label}
                    className="flex h-8.5 shrink-0 items-center truncate border-r border-line px-2 text-[11px] font-semibold text-fg-subtle"
                    style={{ width: largeurDe(col) }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
              {lignes.map((ligne, index) => (
                <div key={index} className="flex h-10.5 border-b border-line">
                  {ALL_COLS.map((col) => (
                    <div key={col.key} className="shrink-0 border-r border-line" style={{ width: largeurDe(col) }}>
                      {cellule(ligne, col, index)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={ajouterLigne} className="text-primary-fg hover:text-primary-fg">
              <Plus /> Ajouter un marché
            </Button>
          )}
          <span className="text-xs text-fg-subtle">
            Une étape sans objet reste vide : elle ne sera pas enregistrée. Le délai de passation se déduit de la saisine CIPM
            et de l&apos;enregistrement. Non obj. BF : non-objection du bailleur de fonds.
          </span>
        </div>
      </Card>
    </>
  );
}

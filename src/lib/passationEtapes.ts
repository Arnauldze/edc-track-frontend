// ══════════════════════════════════════════════════════════════
// ÉTAPES DU MARCHÉ ET PPM CONSOLIDÉ
//
// Une activité = un marché. Le tableau de passation garde la forme du PPM
// d'EDC : les étapes en colonnes, regroupées par phase du processus, puis la
// synthèse et l'exécution. Les colonnes datées sont des données (clé,
// libellé, groupe) pour qu'on puisse en ajouter, en insérer ou en supprimer ;
// une nouvelle passation part des colonnes du modèle.
//
// Le PPM du projet réunit une ligne par activité. Une étape du modèle retirée
// y est « N/A » ; une étape ajoutée à la main n'a pas de colonne, elle est
// citée à part.
// ══════════════════════════════════════════════════════════════

import type { ColonnePassation, LignePassationApi, Planning, SynthesePassation } from "@/services/api/planningService";
import { ecart, toDay } from "./livrableSchedule";

export const TYPES_AO = ["DC", "AONO", "AONR", "AOIO", "AMI", "Gré à gré"] as const;

export type GroupePassation = ColonnePassation["groupe"];

export interface GroupeModele {
  id: GroupePassation;
  label: string;
  /** Rôle de couleur du design system, jamais une teinte en dur. */
  couleur: string;
  /** Colonnes du modèle EDC : la clé est aussi le code de l'étape. */
  etapes: { cle: string; designation: string; choix?: boolean }[];
}

export const MODELE_PPM: GroupeModele[] = [
  {
    id: "selection",
    label: "Processus de sélection",
    couleur: "var(--primary-text)",
    etapes: [
      { cle: "saisineCIPM", designation: "Saisine CIPM" },
      { cle: "examenDAOCIPM", designation: "Examen DAO CIPM" },
      { cle: "nonObjectionBF1", designation: "Non obj. BF" },
      { cle: "lancementAO", designation: "Lancement AO" },
      { cle: "depouillementOffres", designation: "Dépouillement" },
      { cle: "rapportAnalyseSCA", designation: "Rapport SCA" },
      { cle: "examenRapportCIPM", designation: "Examen rapp. CIPM" },
      { cle: "nonObjectionBF2", designation: "Non obj. BF" },
    ],
  },
  {
    id: "offres",
    label: "Offres financières",
    couleur: "var(--accent-text)",
    etapes: [
      { cle: "ouvertureOF", designation: "Ouverture OF" },
      { cle: "rapportAnalyseOF", designation: "Rapport OF" },
      { cle: "propositionAttributionCIPM", designation: "Proposition CIPM" },
      { cle: "nonObjectionBF3", designation: "Non obj. BF" },
      { cle: "publicationResultats", designation: "Publication rés." },
    ],
  },
  {
    id: "contractualisation",
    label: "Contractualisation",
    couleur: "var(--success)",
    etapes: [
      { cle: "souscriptionMarche", designation: "Souscription" },
      { cle: "saisineCIPM2", designation: "Saisine CIPM" },
      { cle: "examenMarcheCIPM", designation: "Examen marché CIPM" },
      { cle: "visaCA", designation: "VISA CA", choix: true },
      { cle: "nonObjectionBF4", designation: "Non obj. BF" },
      { cle: "signatureMarche", designation: "Signature" },
      { cle: "notificationMarche", designation: "Notification" },
      { cle: "enregistrementMarche", designation: "Enregistrement" },
    ],
  },
];

export const ETAPES_MODELE = MODELE_PPM.flatMap((g) => g.etapes.map((e) => ({ ...e, groupe: g.id })));
const CLES_MODELE = new Set(ETAPES_MODELE.map((e) => e.cle));

export const estDuModele = (cle: string) => CLES_MODELE.has(cle);
/** Étape à réponse fermée (OUI / NON / N/A) plutôt qu'à date. */
export const estAChoix = (cle: string) => ETAPES_MODELE.some((e) => e.cle === cle && e.choix);

/** Colonnes d'une nouvelle passation : celles du modèle, sans date. */
export const colonnesModele = (): ColonnePassation[] =>
  ETAPES_MODELE.map(({ cle, designation, groupe }) => ({ cle, designation, groupe }));

/** Clé d'une étape ajoutée à la main : ne change plus, même si on la renomme. */
export const nouvelleCle = () => `perso-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Délai de passation en jours : de la première à la dernière étape datée,
 * comme l'ancien tableau le comptait de la saisine CIPM à l'enregistrement.
 */
export function delaiPassation(colonnes: ColonnePassation[]): number | undefined {
  const dates = colonnes.map((c) => toDay(c.date)).filter((d): d is string => !!d).sort();
  return dates.length > 1 ? ecart(dates[0], dates[dates.length - 1], "jours") : undefined;
}

/**
 * Passation saisie dans l'ancien tableau (un marché par ligne, champs figés) :
 * sa première ligne devient le marché de l'activité, sans rien perdre.
 */
export function depuisAncienneLigne(ligne: LignePassationApi | undefined) {
  const brut = (ligne ?? {}) as Record<string, unknown>;
  const colonnes = colonnesModele().map((c) =>
    estAChoix(c.cle)
      ? { ...c, choix: (brut[c.cle] as ColonnePassation["choix"]) || undefined }
      : { ...c, date: toDay(brut[c.cle] as string | undefined) },
  );
  const nombre = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    typeAO: (brut.typeAO as string) || "",
    sourceFinancement: (brut.sourceFinancement as string) || "",
    imputationBudgetaire: (brut.imputationBudgetaire as string) || "",
    colonnes,
    synthese: {
      osDeDemarrage: toDay(brut.osDeDemarrage as string | undefined),
      delaiGlobalExecution: nombre(brut.delaiGlobalExecution),
      dateReceptionProvisoire: toDay(brut.dateReceptionProvisoire as string | undefined),
      periodeGarantie: nombre(brut.periodeGarantie),
      dateReceptionDefinitive: toDay(brut.dateReceptionDefinitive as string | undefined),
    } satisfies SynthesePassation,
  };
}

// ── PPM consolidé ──

export interface LignePPM {
  activityPath: string;
  designation: string;
  typeAO?: string;
  activityType: Planning["activityType"];
  montant?: number;
  sourceFinancement?: string;
  imputationBudgetaire?: string;
  responsable?: string;
  /** Colonnes du modèle présentes dans le marché, par clé. Absente = étape retirée (N/A). */
  etapes: Record<string, ColonnePassation>;
  /** Étapes ajoutées à la main, avec leur date. */
  horsModele: ColonnePassation[];
  delaiPassation?: number;
  synthese: SynthesePassation;
}

export function lignePPM(planning: Planning): LignePPM {
  const colonnes = planning.colonnesPassation?.length
    ? planning.colonnesPassation
    : depuisAncienneLigne(planning.lignesPassation?.[0]).colonnes;
  const ancienne = planning.colonnesPassation?.length ? undefined : depuisAncienneLigne(planning.lignesPassation?.[0]);

  return {
    activityPath: planning.activityPath,
    designation: planning.activityName,
    typeAO: planning.typeAO ?? (ancienne?.typeAO || undefined),
    activityType: planning.activityType,
    montant: planning.budgetActualiseTotal ?? planning.budgetInitialTotal,
    sourceFinancement: planning.sourceFinancement ?? (ancienne?.sourceFinancement || undefined),
    imputationBudgetaire: planning.imputationBudgetaire ?? (ancienne?.imputationBudgetaire || undefined),
    responsable: planning.responsablePassation,
    etapes: Object.fromEntries(colonnes.filter((c) => estDuModele(c.cle)).map((c) => [c.cle, c])),
    horsModele: colonnes.filter((c) => !estDuModele(c.cle)),
    delaiPassation: delaiPassation(colonnes),
    synthese: planning.synthesePassation ?? ancienne?.synthese ?? {},
  };
}

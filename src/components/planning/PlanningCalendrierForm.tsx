"use client";

// ══════════════════════════════════════════════════════════════
// TABLEAU DE PLANIFICATION D'UNE PHASE — livrables d'étude, tâches d'exécution
//
// Composant contrôlé : la page détient les lignes. Les dates, durées, délais
// et successeurs sont calculés par lib/livrableSchedule.ts, le même moteur que
// le serveur. Pour chaque ligne, l'échéance est fixée par la durée, le délai
// depuis T0 ou une date : les deux autres valeurs sont déduites (en italique)
// et restent modifiables — les modifier change la saisie qui fixe l'échéance.
//
// Étude et exécution suivent les mêmes règles ; l'exécution ajoute l'unité,
// la quantité et le prix unitaire de chaque tâche.
// ══════════════════════════════════════════════════════════════

import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Info, ListPlus, Plus, Scale, Trash2, Upload } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import {
  CALENDRIER_PAR_DEFAUT,
  LIBELLE_REGIME,
  calculerCalendrierEtude,
  type Calendrier,
  type RegimeCalendrier,
  deplacerLigne,
  ecart,
  insererApresLigne,
  nouvelIdentifiant,
  reetiqueterLiaisons,
  renumeroterLignes,
  supprimerLigne,
  toDay,
  EXEMPLES_LIAISON,
  type ChampLivrable,
  type LivrableCalcule,
  type ModeFin,
  type Unite,
} from "@/lib/livrableSchedule";

const ABREGE_UNITE: Record<Unite, string> = { jours: "j", semaines: "sem", mois: "mois" };

/** D'où vient le début d'une ligne, pour l'infobulle du champ verrouillé. */
function origineDebut(l: LivrableCalcule): string {
  if (!l.liaison) return l.debutFixe ? "Date de début saisie (videz pour suivre T0)" : "Démarre à T0";
  const { numero, type, decalage, unite } = l.liaison;
  const ancre = type === "DD" ? `Début de ${numero}` : `Fin de ${numero}`;
  return decalage ? `${ancre} ${decalage < 0 ? "−" : "+"} ${Math.abs(decalage)} ${ABREGE_UNITE[unite]}` : ancre;
}

/** Champs communs aux livrables et aux tâches, plus ceux propres à chaque phase. */
export interface LigneCalendrier {
  /** Identifiant interne stable, jamais affiché (cf. lib/livrableSchedule.ts). */
  id?: string;
  numero: string;
  ponderation?: number;
  predecesseur?: string;
  dateDebut?: string | Date;
  debutFixe?: boolean;
  dateFin?: string | Date;
  dateEcheance?: string | Date;
  modeFin?: ModeFin;
  duree?: number;
  dureeUnite?: Unite;
  delai?: number;
  delaiUnite?: Unite;
  successeur?: string;
  description?: string;
  // Étude
  intitule?: string;
  // Exécution
  designation?: string;
  unite?: string;
  quantite?: number;
  prixUnitaire?: number;
}

export interface PhaseCalendrier {
  titre: string;
  description: string;
  icone: ReactNode;
  /** Préfixe des numéros : R pour les livrables, T pour les tâches. */
  prefixe: string;
  /** Champ du nom de la ligne. */
  champNom: "intitule" | "designation";
  libelleNom: string;
  placeholderNom: string;
  /** « livrable » ou « tâche », pour les textes. */
  mot: string;
  importType: "etude" | "execution";
  /**
   * Type de planification proposé par défaut. Décision de l'équipe : les
   * études se planifient au délai depuis T0, les travaux au début + durée.
   */
  modeDefaut: ModeFin;
  /** Colonnes unité, quantité, prix unitaire et montant. */
  quantites?: boolean;
}

interface Props<T extends LigneCalendrier> {
  phase: PhaseCalendrier;
  lignes: T[];
  onChange: (lignes: T[]) => void;
  /** Date T0 de l'activité (AAAA-MM-JJ). */
  dateT0: string;
  /** Jours travaillés de l'activité : ils décident des durées et des échéances. */
  calendrierTravail?: Calendrier;
  readOnly: boolean;
  /**
   * Le contrôle d'enregistrement a été demandé : les champs obligatoires
   * restés vides passent en rouge. Faux tant qu'on saisit, pour ne pas
   * souligner en rouge une ligne qu'on vient tout juste d'ajouter.
   */
  controleDemande?: boolean;
  /** Action placée dans l'en-tête de la carte (retirer la phase…). */
  action?: ReactNode;
}

/** Les trois types de planification, tels que l'équipe les nomme. */
const TYPES_PLANIFICATION: { value: ModeFin; label: string; aide: string }[] = [
  { value: "delai", label: "Suivant délai (T0 + x)", aide: "L'échéance se compte depuis T0 ; durée et dates en sont déduites." },
  { value: "fin", label: "Début et fin", aide: "On saisit la date de fin ; la durée en est déduite." },
  { value: "duree", label: "Début et durée", aide: "On saisit la durée ; l'échéance en est déduite." },
];

const UNITES: { value: Unite; label: string }[] = [
  { value: "jours", label: "jours" },
  { value: "semaines", label: "sem." },
  { value: "mois", label: "mois" },
];

/** Rappel du régime, affiché à côté du titre de la phase. */
const RESUME_REGIME: Record<RegimeCalendrier, string | null> = {
  calendaire: null,
  "lun-ven": "jours ouvrés, lun.–ven.",
  "lun-sam": "jours ouvrés, lun.–sam.",
};

// Classes complètes (Tailwind ne détecte pas les classes composées à l'exécution)
const GRID = "grid-cols-[56px_minmax(180px,1fr)_68px_84px_132px_128px_128px_132px_72px_100px]";
const GRID_QUANTITES = "grid-cols-[56px_minmax(180px,1fr)_68px_64px_76px_104px_112px_84px_132px_128px_128px_132px_72px_100px]";

/** Nouvelle ligne : durée d'un mois, sans prédécesseur. */
export function nouvelleLigne<T extends LigneCalendrier>(phase: Pick<PhaseCalendrier, "champNom">, numero: string): T {
  return {
    id: nouvelIdentifiant(),
    numero,
    [phase.champNom]: "",
    ponderation: 0,
    duree: 1,
    dureeUnite: "mois",
    delaiUnite: "mois",
    modeFin: "duree",
    debutFixe: false,
  } as unknown as T;
}

const prochainNumero = (lignes: LigneCalendrier[], prefixe: string) => {
  const motif = new RegExp(`^${prefixe}(\\d+)$`);
  const max = lignes.reduce((m, l) => Math.max(m, Number(motif.exec(l.numero ?? "")?.[1] ?? 0)), 0);
  return `${prefixe}${max + 1}`;
};

const formatQuantite = (value: number | undefined) =>
  value === undefined ? "" : value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

const parseQuantite = (raw: string): number | undefined => {
  const value = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return isFinite(value) && value >= 0 ? value : undefined;
};

const formatJour = (day?: string) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const formatMontant = (value: number) => Math.round(value).toLocaleString("fr-FR");

export function PlanningCalendrierForm<T extends LigneCalendrier>({
  phase,
  lignes,
  onChange,
  dateT0,
  calendrierTravail = CALENDRIER_PAR_DEFAUT,
  readOnly,
  controleDemande = false,
  action,
}: Props<T>) {
  const [showImportModal, setShowImportModal] = useState(false);
  const calendrier = useMemo(
    () => calculerCalendrierEtude(lignes, dateT0, calendrierTravail),
    [lignes, dateT0, calendrierTravail],
  );

  const problemeDe = (index: number, champ: ChampLivrable) =>
    calendrier.problemes.find((p) => p.index === index && p.champ === champ)?.message;
  // Un message par problème : une boucle est signalée sur chacune de ses lignes
  const problemesLignes = [...new Set(calendrier.problemes.filter((p) => p.champ !== "ponderation").map((p) => p.message))];
  const pondValide = Math.abs(calendrier.totalPonderation - 100) <= 0.01;
  const montantTotal = phase.quantites ? lignes.reduce((sum, l) => sum + (l.quantite ?? 0) * (l.prixUnitaire ?? 0), 0) : 0;

  // ── Modifications ──
  const modifier = (index: number, patch: Partial<T>) => onChange(lignes.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  /**
   * Renommer une ligne suit ses liaisons : « T3FD+2sem » devient
   * « T9FD+2sem », et non une liaison vers une ligne disparue.
   */
  const renommer = (index: number, numero: string) => {
    const ancien = lignes[index].numero;
    const renommees = lignes.map((l, i) => (i === index ? { ...l, numero } : l));
    onChange(ancien && ancien !== numero ? reetiqueterLiaisons(renommees, new Map([[ancien, numero]])) : renommees);
  };

  const fixerFin = (index: number, mode: ModeFin, patch: Partial<T>) => modifier(index, { ...patch, modeFin: mode });

  /**
   * Type commun à tout le tableau, ou « mixte » pour une planification
   * ancienne dont les lignes ne suivent pas toutes la même règle.
   */
  const typeTableau: ModeFin | "mixte" | undefined = useMemo(() => {
    const modes = new Set(calendrier.livrables.map((l) => l.modeFin));
    if (modes.size === 0) return phase.modeDefaut;
    return modes.size === 1 ? [...modes][0] : "mixte";
  }, [calendrier.livrables, phase.modeDefaut]);

  /** Colonne verrouillée : elle est déduite dans le type choisi. */
  const verrouille = (mode: ModeFin) => typeTableau !== "mixte" && typeTableau !== mode;

  const aideColonne = (mode: ModeFin, modeLigne: ModeFin, determinante: string, deduite: string) =>
    modeLigne === mode ? determinante : verrouille(mode) ? "Déduite du type de planification choisi" : deduite;

  /**
   * Bascule tout le tableau. Les dates ne bougent pas : la valeur déduite que
   * le moteur vient de calculer devient la valeur saisie. Sans cela, changer
   * de type effacerait la planification.
   */
  const appliquerType = (mode: ModeFin) => {
    onChange(
      lignes.map((ligne, index) => {
        const calcule = calendrier.livrables[index];
        if (!calcule) return ligne;
        if (mode === "duree") return { ...ligne, modeFin: mode, duree: calcule.duree ?? ligne.duree };
        if (mode === "delai") return { ...ligne, modeFin: mode, delai: calcule.delai ?? ligne.delai };
        return { ...ligne, modeFin: mode, dateFin: calcule.dateFin ?? ligne.dateFin };
      }),
    );
  };

  /**
   * Le serveur refuse une ligne sans intitulé (@IsNotEmpty) : autant le dire
   * sur la case, au moment du contrôle, plutôt que par une erreur 400.
   */
  const nomManquant = (index: number) =>
    controleDemande && !String(lignes[index]?.[phase.champNom] ?? "").trim();

  const nomsManquants = controleDemande ? lignes.filter((_, i) => nomManquant(i)).length : 0;

  /** Ligne neuve au type du tableau : sinon celui-ci deviendrait « mixte ». */
  const nouvelleLigneDuTableau = () =>
    ({
      ...nouvelleLigne<T>(phase, prochainNumero(lignes, phase.prefixe)),
      modeFin: typeTableau && typeTableau !== "mixte" ? typeTableau : phase.modeDefaut,
    }) as T;

  const ajouter = () => onChange(renumeroterLignes([...lignes, nouvelleLigneDuTableau()], phase.prefixe));

  // ── Opérations de structure ──
  // Renumérotation positionnelle et liaisons automatiques : les règles sont
  // dans le moteur partagé (lib/livrableSchedule.ts), où elles sont testées.

  const insererApres = (index: number) =>
    onChange(insererApresLigne(lignes, index, nouvelleLigneDuTableau(), phase.prefixe));

  const supprimer = (index: number) => onChange(supprimerLigne(lignes, index, phase.prefixe));

  const deplacer = (index: number, direction: -1 | 1) =>
    onChange(deplacerLigne(lignes, index, direction, phase.prefixe));

  /** Répartit 100 % à parts égales, l'arrondi sur la dernière ligne. */
  const equilibrer = () => {
    if (lignes.length === 0) return;
    const part = Math.floor((100 / lignes.length) * 100) / 100;
    onChange(lignes.map((l, i) => ({ ...l, ponderation: i === lignes.length - 1 ? Math.round((100 - part * (lignes.length - 1)) * 100) / 100 : part })));
  };

  const importer = (importees: Record<string, unknown>[]) => {
    const texte = (v: unknown) => (v === undefined || v === null ? "" : String(v));
    onChange(
      importees.map((row) => {
        const duree = parseQuantite(texte(row.duree));
        const delai = parseQuantite(texte(row.delai));
        const debut = toDay(texte(row.dateDebut));
        return {
          ...nouvelleLigne<T>(phase, texte(row.numero)),
          [phase.champNom]: texte(row[phase.champNom]),
          ponderation: Number(row.ponderation) || 0,
          predecesseur: texte(row.predecesseur),
          description: row.description ? texte(row.description) : undefined,
          duree,
          delai,
          dateDebut: debut,
          debutFixe: !!debut,
          dateFin: toDay(texte(row.dateFin)),
          // Priorité de l'import : durée, sinon délai, sinon date de fin
          modeFin: duree ? "duree" : delai ? "delai" : "fin",
          ...(phase.quantites
            ? { unite: texte(row.unite) || undefined, quantite: parseQuantite(texte(row.quantite)), prixUnitaire: parseQuantite(texte(row.prixUnitaire)) }
            : {}),
        } as T;
      }),
    );
  };

  // ── Styles ──
  const grille = phase.quantites ? GRID_QUANTITES : GRID;
  const listeNumeros = `numeros-${phase.champNom}`;
  const largeurMin = phase.quantites ? "min-w-[1424px]" : "min-w-[1084px]";
  const cellule = "px-1.5 py-1.5 flex items-center gap-1 border-r border-b border-line min-w-0";
  const champ = (options: { deduit?: boolean; erreur?: string }) =>
    [
      "w-full min-w-0 px-1.5 py-1 rounded text-[11px] border focus:outline-none focus:border-primary disabled:cursor-not-allowed",
      options.erreur ? "border-danger bg-danger-subtle" : "border-transparent hover:border-line",
      options.deduit ? "italic text-fg-subtle bg-inset" : "bg-transparent text-fg",
    ].join(" ");
  const selectUnite = "shrink-0 w-[52px] px-0.5 py-1 bg-transparent text-[10px] rounded border border-line-subtle focus:outline-none disabled:opacity-60";

  const dureePhase = calendrier.debut && calendrier.fin ? ecart(calendrier.debut, calendrier.fin, "mois") : undefined;
  const entetes = [
    "N°",
    phase.libelleNom,
    "Pond. %",
    ...(phase.quantites ? ["Unité", "Qté", "P.U. (FCFA)", "Montant"] : []),
    "Préd.",
    "Début",
    "Durée",
    "Délai (T0 +)",
    "Échéance",
    "Succ.",
    "",
  ];
  const motPluriel = `${phase.mot}s`;
  const nombre = lignes.filter((l) => String(l[phase.champNom] ?? "").trim()).length;

  return (
    <>
      <FileImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={importer} importType={phase.importType} />

      <section className="bg-surface rounded-lg border border-line overflow-hidden">
        <header className="px-4 py-2.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              {phase.icone} {phase.titre}
              {RESUME_REGIME[calendrierTravail.regime] && (
                <span
                  className="rounded border border-line bg-inset px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted"
                  title="Les durées en jours et en semaines ne comptent que les jours travaillés."
                >
                  {RESUME_REGIME[calendrierTravail.regime]}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-fg-muted mt-0.5">{phase.description}</p>
          </div>

          {/* Synthèse de la phase */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[9px] uppercase tracking-wider font-bold text-fg-subtle">Type de planification</span>
              <select
                value={typeTableau === "mixte" ? "" : (typeTableau ?? phase.modeDefaut)}
                onChange={(e) => appliquerType(e.target.value as ModeFin)}
                disabled={readOnly}
                title={
                  typeTableau === "mixte"
                    ? "Cette planification mélange les règles ; choisir un type les aligne sans déplacer les dates."
                    : TYPES_PLANIFICATION.find((t) => t.value === typeTableau)?.aide
                }
                className="px-2 py-1 rounded-md border border-line bg-surface text-[11px] font-semibold text-fg focus:outline-none focus:border-primary disabled:opacity-60"
              >
                {typeTableau === "mixte" && <option value="">Mixte</option>}
                {TYPES_PLANIFICATION.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          <dl className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              { label: `${motPluriel[0].toUpperCase()}${motPluriel.slice(1)}`, value: String(nombre) },
              { label: "T0", value: dateT0 ? formatJour(dateT0) : "Non définie", alert: !dateT0 },
              { label: "Début", value: formatJour(calendrier.debut) },
              { label: "Fin", value: formatJour(calendrier.fin) },
              { label: "Durée", value: dureePhase === undefined ? "—" : `${formatQuantite(dureePhase)} mois` },
              ...(phase.quantites ? [{ label: "Montant", value: montantTotal ? `${formatMontant(montantTotal)} FCFA` : "—" }] : []),
            ].map((item) => (
              <div
                key={item.label}
                className={`px-2 py-1 rounded-md border ${"alert" in item && item.alert ? "border-warning/30 bg-warning-subtle text-warning" : "border-line bg-inset"}`}
              >
                <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">{item.label}</dt>
                <dd className="font-semibold">{item.value}</dd>
              </div>
            ))}
            <div className={`px-2 py-1 rounded-md border ${pondValide ? "border-success/30 bg-success-subtle text-success" : "border-warning/30 bg-warning-subtle text-warning"}`}>
              <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">Pondération</dt>
              <dd className="font-semibold">{formatQuantite(calendrier.totalPonderation)} % {pondValide ? "✓" : "/ 100 %"}</dd>
            </div>
          </dl>
          {action}
          </div>
        </header>

        <div className="p-3 space-y-3">
          {readOnly && (
            <div className="flex gap-2 px-3 py-2 rounded-md border border-warning/20 bg-warning-subtle text-[11px] text-warning">
              <AlertCircle size={15} className="shrink-0 mt-px" />
              <span><strong>Consultation :</strong> seul le chef de projet peut modifier la planification.</span>
            </div>
          )}

          {!dateT0 && (
            <div className="flex gap-2 px-3 py-2 rounded-md border border-primary/20 bg-primary-subtle text-[11px] text-primary-fg">
              <Info size={15} className="shrink-0 mt-px" />
              <span>Renseignez la <strong>date T0</strong> de l&apos;activité : les {motPluriel} sans prédécesseur ni date de début démarrent à T0, et les délais se comptent depuis T0.</span>
            </div>
          )}

          {/* Tableau */}
          <div className="border border-line rounded-md overflow-x-auto">
            <div className={largeurMin}>
              <div className={`grid ${grille} bg-inset text-[10px] font-bold text-fg-subtle uppercase tracking-wider`}>
                {entetes.map((label, i) => (
                  <div key={i} className={`px-2 py-2 border-r border-b border-line ${i === 1 ? "" : "text-center"}`}>
                    {label}
                  </div>
                ))}
              </div>

              <datalist id={listeNumeros}>
                {lignes.map((ligne) => ligne.numero).filter(Boolean).map((numero) => (
                  <option key={numero} value={numero} />
                ))}
              </datalist>

              {calendrier.livrables.map((l, index) => {
                const saisi = lignes[index];
                return (
                  <div key={index} className={`grid ${grille} text-[12px] hover:bg-hover`}>
                    <div className={cellule}>
                      <input
                        value={saisi.numero}
                        onChange={(e) => renommer(index, e.target.value)}
                        disabled={readOnly}
                        title={problemeDe(index, "numero")}
                        className={`${champ({ erreur: problemeDe(index, "numero") })} text-center font-bold`}
                      />
                    </div>
                    <div className={cellule}>
                      <input
                        value={saisi[phase.champNom] ?? ""}
                        onChange={(e) => modifier(index, { [phase.champNom]: e.target.value } as Partial<T>)}
                        disabled={readOnly}
                        placeholder={phase.placeholderNom}
                        title={nomManquant(index) ? `${phase.libelleNom} : à renseigner` : undefined}
                        className={champ({ erreur: nomManquant(index) ? phase.libelleNom : undefined })}
                      />
                    </div>
                    <div className={cellule}>
                      <input
                        inputMode="decimal"
                        value={saisi.ponderation ? formatQuantite(saisi.ponderation) : ""}
                        onChange={(e) => modifier(index, { ponderation: parseQuantite(e.target.value) ?? 0 } as Partial<T>)}
                        disabled={readOnly}
                        placeholder="0"
                        className={`${champ({})} text-center`}
                      />
                    </div>
                    {phase.quantites && (
                      <>
                        <div className={cellule}>
                          <input value={saisi.unite ?? ""} onChange={(e) => modifier(index, { unite: e.target.value } as Partial<T>)} disabled={readOnly} placeholder="m³" className={`${champ({})} text-center`} />
                        </div>
                        <div className={cellule}>
                          <input inputMode="decimal" value={formatQuantite(saisi.quantite)} onChange={(e) => modifier(index, { quantite: parseQuantite(e.target.value) } as Partial<T>)} disabled={readOnly} placeholder="0" className={`${champ({})} text-right`} />
                        </div>
                        <div className={cellule}>
                          <input inputMode="decimal" value={formatQuantite(saisi.prixUnitaire)} onChange={(e) => modifier(index, { prixUnitaire: parseQuantite(e.target.value) } as Partial<T>)} disabled={readOnly} placeholder="0" className={`${champ({})} text-right`} />
                        </div>
                        <div className={`${cellule} justify-end text-[11px] text-fg-muted`} title="Quantité × prix unitaire">
                          {saisi.quantite && saisi.prixUnitaire ? formatMontant(saisi.quantite * saisi.prixUnitaire) : "—"}
                        </div>
                      </>
                    )}
                    <div className={cellule}>
                      <input
                        list={listeNumeros}
                        value={saisi.predecesseur ?? ""}
                        onChange={(e) => modifier(index, { predecesseur: e.target.value } as Partial<T>)}
                        onBlur={() => l.predecesseur && modifier(index, { predecesseur: l.predecesseur } as Partial<T>)}
                        disabled={readOnly}
                        placeholder="—"
                        title={
                          problemeDe(index, "predecesseur") ??
                          `${phase.mot[0].toUpperCase()}${phase.mot.slice(1)} dont celle-ci dépend. Décalage possible : ${EXEMPLES_LIAISON}`
                        }
                        className={`${champ({ erreur: problemeDe(index, "predecesseur") })} text-center`}
                      />
                    </div>
                    <div className={cellule}>
                      <input
                        type="date"
                        value={l.dateDebut ?? ""}
                        onChange={(e) => modifier(index, (e.target.value ? { dateDebut: e.target.value, debutFixe: true } : { dateDebut: undefined, debutFixe: false }) as Partial<T>)}
                        disabled={readOnly || !!l.predecesseur}
                        title={origineDebut(l)}
                        className={champ({ deduit: !l.debutFixe, erreur: problemeDe(index, "dateDebut") })}
                      />
                    </div>
                    <div className={cellule}>
                      <input
                        inputMode="decimal"
                        value={formatQuantite(l.duree)}
                        onChange={(e) => fixerFin(index, "duree", { duree: parseQuantite(e.target.value) } as Partial<T>)}
                        disabled={readOnly || verrouille("duree")}
                        title={aideColonne("duree", l.modeFin, "La durée fixe l'échéance", "Déduite — saisir une durée fixe l'échéance")}
                        className={`${champ({ deduit: l.modeFin !== "duree" })} text-center`}
                      />
                      <select value={l.dureeUnite} onChange={(e) => modifier(index, { dureeUnite: e.target.value as Unite } as Partial<T>)} disabled={readOnly} className={selectUnite}>
                        {UNITES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div className={cellule}>
                      <input
                        inputMode="decimal"
                        value={formatQuantite(l.delai)}
                        onChange={(e) => fixerFin(index, "delai", { delai: parseQuantite(e.target.value) } as Partial<T>)}
                        disabled={readOnly || verrouille("delai")}
                        title={
                          problemeDe(index, "delai") ??
                          aideColonne("delai", l.modeFin, "Le délai depuis T0 fixe l'échéance", "Déduit — saisir un délai fixe l'échéance")
                        }
                        className={`${champ({ deduit: l.modeFin !== "delai", erreur: problemeDe(index, "delai") })} text-center`}
                      />
                      <select value={l.delaiUnite} onChange={(e) => modifier(index, { delaiUnite: e.target.value as Unite } as Partial<T>)} disabled={readOnly} className={selectUnite}>
                        {UNITES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div className={cellule}>
                      <input
                        type="date"
                        value={l.dateFin ?? ""}
                        onChange={(e) => fixerFin(index, "fin", { dateFin: e.target.value || undefined } as Partial<T>)}
                        disabled={readOnly || verrouille("fin")}
                        title={
                          problemeDe(index, "dateFin") ??
                          aideColonne("fin", l.modeFin, "Échéance saisie", "Déduite — saisir une date fixe l'échéance")
                        }
                        className={champ({ deduit: l.modeFin !== "fin", erreur: problemeDe(index, "dateFin") })}
                      />
                    </div>
                    <div className={`${cellule} justify-center text-[10px] text-fg-muted`} title="Déduit des prédécesseurs">
                      {l.successeur ?? "—"}
                    </div>
                    <div className="px-1 py-1.5 flex items-center justify-center gap-0.5 border-b border-line">
                      {!readOnly && (
                        <>
                          <button type="button" onClick={() => deplacer(index, -1)} disabled={index === 0} title="Monter" className="p-1 rounded text-fg-subtle hover:bg-inset disabled:opacity-25">
                            <ArrowUp size={13} />
                          </button>
                          <button type="button" onClick={() => deplacer(index, 1)} disabled={index === lignes.length - 1} title="Descendre" className="p-1 rounded text-fg-subtle hover:bg-inset disabled:opacity-25">
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => insererApres(index)}
                            title={`Insérer une ${phase.mot} en dessous`}
                            className="p-1 rounded text-fg-subtle hover:bg-inset"
                          >
                            <ListPlus size={13} />
                          </button>
                          <button type="button" onClick={() => supprimer(index)} title="Supprimer" className="p-1 rounded text-fg-subtle hover:bg-danger-subtle hover:text-danger">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {lignes.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-fg-subtle">Aucun(e) {phase.mot}.</div>}
            </div>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={ajouter} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-primary-fg hover:bg-primary/10 rounded-md">
                <Plus size={14} /> Ajouter {phase.mot === "tâche" ? "une tâche" : "un livrable"}
              </button>
              {!pondValide && lignes.length > 0 && (
                <button type="button" onClick={equilibrer} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-fg-muted hover:bg-hover rounded-md" title="Répartir 100 % à parts égales">
                  <Scale size={14} /> Répartir 100 %
                </button>
              )}
              <button type="button" onClick={() => setShowImportModal(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-fg-muted border border-line hover:bg-hover rounded-md">
                <Upload size={14} /> Importer depuis Excel
              </button>
            </div>
          )}

          {/* Problèmes à corriger avant d'enregistrer */}
          {(problemesLignes.length > 0 || nomsManquants > 0 || (!pondValide && lignes.length > 0)) && (
            <div className="flex gap-2 px-3 py-2 rounded-md border border-warning/20 bg-warning-subtle text-[11px] text-warning">
              <AlertCircle size={15} className="shrink-0 mt-px" />
              <ul className="space-y-0.5">
                {nomsManquants > 0 && (
                  <li>
                    {nomsManquants === 1
                      ? `Une ${phase.mot} n'a pas d'intitulé (case en rouge).`
                      : `${nomsManquants} ${motPluriel} n'ont pas d'intitulé (cases en rouge).`}
                  </li>
                )}
                {problemesLignes.map((message) => <li key={message}>{message}</li>)}
                {!pondValide && lignes.length > 0 && <li>La somme des pondérations doit être égale à 100 % (actuellement {formatQuantite(calendrier.totalPonderation)} %).</li>}
              </ul>
            </div>
          )}

          <details className="rounded-md border border-primary/20 bg-primary-subtle text-[11px] text-primary-fg">
            <summary className="px-3 py-2 cursor-pointer font-semibold">Règles de calcul</summary>
            <ul className="px-5 pb-3 space-y-1 list-disc">
              <li><strong>Délai</strong> : temps depuis T0 jusqu&apos;à l&apos;échéance (T0 + 3 mois = échéance).</li>
              <li><strong>Durée</strong> : temps d&apos;exécution (début + 1 mois = fin).</li>
              <li><strong>Échéance</strong> : fixée par la durée, le délai ou une date saisie ; les deux autres valeurs sont déduites et affichées en italique. Saisir une valeur en italique la rend déterminante.</li>
              <li><strong>Série</strong> : avec un prédécesseur, la ligne commence à la fin du prédécesseur.</li>
              <li>
                <strong>Liaisons</strong> : comme dans MS&nbsp;Project. <code>T3</code> démarre à la fin de T3 ;
                <code>T3FD+2sem</code> deux semaines après la fin de T3 ; <code>T3DD+2j</code> deux jours après le
                <em> début</em> de T3. Le décalage peut être négatif et vaut des jours si l&apos;unité est omise.
              </li>
              <li><strong>Parallèle</strong> : sans prédécesseur, elle commence à la date de début saisie, sinon à T0.</li>
              <li><strong>Successeurs</strong> : déduits automatiquement des prédécesseurs.</li>
              <li><strong>Mois</strong> : mois de calendrier (15 janv. + 1 mois = 15 févr.), quel que soit le régime.</li>
              {calendrierTravail.regime !== "calendaire" && (
                <li>
                  <strong>Jours ouvrés</strong> : {LIBELLE_REGIME[calendrierTravail.regime].toLowerCase()}. Une durée de
                  3 jours commencée le lundi se termine le mercredi, dernier jour travaillé compris, et un successeur
                  enchaîne le jour travaillé suivant. Un décalage de liaison, lui, saute les jours chômés sans en
                  compter aucun.
                </li>
              )}
              <li><strong>Pondération</strong> : la somme des {motPluriel} doit être égale à 100 %.</li>
              {phase.quantites && <li><strong>Montant</strong> : quantité × prix unitaire, pour information.</li>}
            </ul>
          </details>
        </div>
      </section>
    </>
  );
}

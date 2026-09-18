"use client";

// ══════════════════════════════════════════════════════════════
// PLANIFICATION DE LA PASSATION
// Une activité = un marché. Le tableau garde la forme du PPM d'EDC : les
// étapes en colonnes, regroupées par phase du processus, puis la synthèse et
// l'exécution. L'identification du marché est sortie du tableau, au-dessus :
// désignation, prestation et montant y sont ceux de l'activité, le reste se
// saisit ici.
//
// Les colonnes datées viennent du modèle (lib/passationEtapes.ts) ; on peut en
// insérer, en ajouter à un groupe ou en supprimer, puis rétablir celles du
// modèle qui manquent.
// ══════════════════════════════════════════════════════════════

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Briefcase, ChevronLeft, ChevronRight, FileSpreadsheet, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClasses } from "@/components/ui/input";
import { typeActivite, voile, type ActivityType } from "@/lib/activityTypes";
import { formatCurrency } from "@/lib/helpers/currencyHelpers";
import { cn } from "@/lib/utils";
import { ecart, toDay } from "@/lib/livrableSchedule";
import {
  ETAPES_MODELE,
  MODELE_PPM,
  TYPES_AO,
  colonnesModele,
  delaiPassation,
  estAChoix,
  estDuModele,
  nouvelleCle,
  type GroupePassation,
} from "@/lib/passationEtapes";
import type { ColonnePassation, SynthesePassation } from "@/services/api/planningService";

/** Saisie de la passation telle que la tient la page de l'activité. */
export interface PassationSaisie {
  typeAO: string;
  sourceFinancement: string;
  imputationBudgetaire: string;
  responsablePassation: string;
  colonnes: ColonnePassation[];
  synthese: SynthesePassation;
}

export const nouvellePassation = (): PassationSaisie => ({
  typeAO: "",
  sourceFinancement: "",
  imputationBudgetaire: "",
  responsablePassation: "",
  colonnes: colonnesModele(),
  synthese: {},
});

interface Props {
  data: PassationSaisie;
  onChange: (data: PassationSaisie) => void;
  readOnly: boolean;
  /** L'activité, dont le marché reprend le nom, le type et le budget. */
  activite: { nom: string; type: ActivityType; montant: number };
  /** Adresse du PPM consolidé du projet. */
  lienPPM: string;
  /** Action placée dans l'en-tête de la carte (retirer la phase…). */
  action?: ReactNode;
}

const LARGEUR = 118;
const LARGEUR_SYNTHESE = 118;

type ChampSynthese = keyof SynthesePassation | "delaiPassation";

const SYNTHESE: { cle: ChampSynthese; label: string; type: "date" | "number"; calculee?: boolean }[] = [
  { cle: "delaiPassation", label: "Délai passation (j)", type: "number", calculee: true },
  { cle: "osDeDemarrage", label: "OS démarrage", type: "date" },
  { cle: "delaiGlobalExecution", label: "Délai exéc. (j)", type: "number" },
  { cle: "dateReceptionProvisoire", label: "Réception prov.", type: "date" },
  { cle: "periodeGarantie", label: "Garantie (j)", type: "number" },
  { cle: "dateReceptionDefinitive", label: "Réception déf.", type: "date" },
];

const GROUPE_SYNTHESE = { label: "Synthèse et exécution", couleur: "var(--text-secondary)" };

const dateCourte = (jour?: string) =>
  jour ? new Date(`${jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

const CELLULE =
  "h-full w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-[12.5px] text-fg tabular-nums " +
  "focus:relative focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary " +
  "disabled:cursor-not-allowed disabled:text-fg-subtle";

const champClasses = cn(controlClasses, "h-8 px-2.5 text-[12.5px]");

export function PlanningFormPassation({ data, onChange, readOnly, activite, lienPPM, action }: Props) {
  const [groupeVise, setGroupeVise] = useState<string>(MODELE_PPM[0].label);
  const scrollRef = useRef<HTMLDivElement>(null);

  const modifier = (patch: Partial<PassationSaisie>) => onChange({ ...data, ...patch });
  const modifierColonnes = (colonnes: ColonnePassation[]) => modifier({ colonnes });
  const modifierColonne = (cle: string, patch: Partial<ColonnePassation>) =>
    modifierColonnes(data.colonnes.map((c) => (c.cle === cle ? { ...c, ...patch } : c)));
  const modifierSynthese = (patch: Partial<SynthesePassation>) => modifier({ synthese: { ...data.synthese, ...patch } });

  // ── Colonnes : insérer, ajouter, supprimer, rétablir ──
  const nouvelleColonne = (groupe: GroupePassation): ColonnePassation => ({ cle: nouvelleCle(), designation: "Nouvelle étape", groupe });

  const insererApres = (cle: string) => {
    const index = data.colonnes.findIndex((c) => c.cle === cle);
    const copie = [...data.colonnes];
    copie.splice(index + 1, 0, nouvelleColonne(data.colonnes[index].groupe));
    modifierColonnes(copie);
  };

  const ajouterAuGroupe = (groupe: GroupePassation) => {
    const dernier = data.colonnes.map((c) => c.groupe).lastIndexOf(groupe);
    // Groupe vide : après les groupes qui le précèdent dans le modèle
    const ordre = MODELE_PPM.map((g) => g.id);
    const position =
      dernier >= 0 ? dernier + 1 : data.colonnes.filter((c) => ordre.indexOf(c.groupe) < ordre.indexOf(groupe)).length;
    const copie = [...data.colonnes];
    copie.splice(position, 0, nouvelleColonne(groupe));
    modifierColonnes(copie);
  };

  const supprimer = (colonne: ColonnePassation) => {
    const renseignee = colonne.date || colonne.choix;
    if (renseignee && !confirm(`Supprimer l'étape « ${colonne.designation} » et sa valeur ?`)) return;
    modifierColonnes(data.colonnes.filter((c) => c.cle !== colonne.cle));
  };

  const manquantes = ETAPES_MODELE.filter((e) => !data.colonnes.some((c) => c.cle === e.cle));

  /** Remet les étapes du modèle retirées à leur place, derrière l'étape du modèle qui les précède. */
  const retablirModele = () => {
    const resultat = [...data.colonnes];
    ETAPES_MODELE.forEach((etape, rang) => {
      if (resultat.some((c) => c.cle === etape.cle)) return;
      const precedentes = ETAPES_MODELE.slice(0, rang).map((e) => e.cle);
      const apres = resultat.reduce((pos, c, i) => (precedentes.includes(c.cle) ? i : pos), -1);
      resultat.splice(apres + 1, 0, { cle: etape.cle, designation: etape.designation, groupe: etape.groupe });
    });
    modifierColonnes(resultat);
  };

  // ── Groupes dans l'ordre du modèle ──
  const groupes = MODELE_PPM.map((g) => ({ ...g, colonnes: data.colonnes.filter((c) => c.groupe === g.id) }));
  const largeurGroupe = (n: number) => Math.max(n, 1) * LARGEUR;
  const largeurSynthese = SYNTHESE.length * LARGEUR_SYNTHESE;

  const allerAuGroupe = (label: string) => {
    setGroupeVise(label);
    const rang = groupes.findIndex((g) => g.label === label);
    const gauche = rang < 0 ? groupes.reduce((s, g) => s + largeurGroupe(g.colonnes.length), 0) : groupes.slice(0, rang).reduce((s, g) => s + largeurGroupe(g.colonnes.length), 0);
    scrollRef.current?.scrollTo({ left: gauche, behavior: "smooth" });
  };

  // ── Synthèse de la phase ──
  const delai = useMemo(() => delaiPassation(data.colonnes), [data.colonnes]);
  const derniere = useMemo(() => data.colonnes.map((c) => toDay(c.date)).filter((d): d is string => !!d).sort().pop(), [data.colonnes]);
  const os = toDay(data.synthese.osDeDemarrage);
  const apresPassation = derniere && os ? ecart(derniere, os, "jours") : undefined;

  const chiffres = [
    { label: "Délai de passation", valeur: delai === undefined ? "—" : `${delai} jours`, detail: "De la première à la dernière étape datée" },
    {
      label: "Ordre de service",
      valeur: dateCourte(os),
      detail: apresPassation === undefined ? "Démarrage de l'exécution" : `Démarrage de l'exécution, ${apresPassation} j après la dernière étape`,
    },
    {
      label: "Délai d'exécution",
      valeur: data.synthese.delaiGlobalExecution === undefined ? "—" : `${data.synthese.delaiGlobalExecution} jours`,
      detail: data.synthese.dateReceptionProvisoire ? `Réception provisoire le ${dateCourte(toDay(data.synthese.dateReceptionProvisoire))}` : "Jusqu'à la réception provisoire",
    },
    {
      label: "Étapes",
      valeur: String(data.colonnes.length),
      detail: manquantes.length ? `${manquantes.length} étape${manquantes.length > 1 ? "s" : ""} du modèle retirée${manquantes.length > 1 ? "s" : ""}` : "Toutes les étapes du modèle EDC",
    },
  ];

  const prestation = typeActivite(activite.type);

  // ── Cellules ──
  const celluleEtape = (colonne: ColonnePassation) =>
    estAChoix(colonne.cle) ? (
      <select
        value={colonne.choix ?? ""}
        disabled={readOnly}
        onChange={(e) => modifierColonne(colonne.cle, { choix: (e.target.value || undefined) as ColonnePassation["choix"] })}
        aria-label={colonne.designation}
        className={`${CELLULE} appearance-none`}
      >
        <option value="">—</option>
        {["OUI", "NON", "N/A"].map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    ) : (
      <input
        type="date"
        value={toDay(colonne.date) ?? ""}
        disabled={readOnly}
        onChange={(e) => modifierColonne(colonne.cle, { date: e.target.value || undefined })}
        aria-label={colonne.designation}
        className={CELLULE}
      />
    );

  const celluleSynthese = (champ: (typeof SYNTHESE)[number]) => {
    if (champ.cle === "delaiPassation") {
      return <input value={delai ?? ""} disabled aria-label={champ.label} className={`${CELLULE} italic`} />;
    }
    const cle = champ.cle;
    const valeur = data.synthese[cle];
    return champ.type === "date" ? (
      <input
        type="date"
        value={toDay(valeur as string | undefined) ?? ""}
        disabled={readOnly}
        onChange={(e) => modifierSynthese({ [cle]: e.target.value || undefined })}
        aria-label={champ.label}
        className={CELLULE}
      />
    ) : (
      <input
        type="number"
        min={0}
        value={valeur ?? ""}
        disabled={readOnly}
        onChange={(e) => modifierSynthese({ [cle]: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
        aria-label={champ.label}
        className={CELLULE}
      />
    );
  };

  const boutonIcone =
    "flex size-5 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

  return (
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
            <h2 className="text-[15px] font-semibold text-fg">Planification de la passation</h2>
            <p className="text-[12.5px] text-fg-muted">Conforme au modèle PPM EDC · un marché pour l&apos;activité</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={lienPPM} className={buttonClasses({ variant: "secondary", size: "sm" })} title="Plan de passation des marchés du projet">
            <FileSpreadsheet /> Portail vers le PPM
          </Link>
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

      {/* Identification du marché */}
      <section className="border-b border-line px-4 py-3">
        <h3 className="mb-2 text-[11px] font-bold tracking-wide text-fg-subtle uppercase">Identification du marché</h3>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Donnee label="Marché" titre="Nom de l'activité">
            <span className="truncate">{activite.nom}</span>
          </Donnee>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-muted">Type d&apos;AO</span>
            <select value={data.typeAO} disabled={readOnly} onChange={(e) => modifier({ typeAO: e.target.value })} className={champClasses}>
              <option value="">—</option>
              {TYPES_AO.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <Donnee label="Prestation" titre="Type de l'activité">
            <span aria-hidden className="size-1.75 shrink-0 rounded-xs" style={{ background: prestation.couleur }} />
            {prestation.label}
          </Donnee>
          <Donnee label="Montant prévisionnel" titre="Budget de l'activité">
            {activite.montant ? formatCurrency(activite.montant, "FCFA") : "Budget à définir"}
          </Donnee>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-muted">Source de financement</span>
            <input value={data.sourceFinancement} disabled={readOnly} onChange={(e) => modifier({ sourceFinancement: e.target.value })} placeholder="BIP, bailleur…" className={champClasses} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-fg-muted">Imputation budgétaire</span>
            <input value={data.imputationBudgetaire} disabled={readOnly} onChange={(e) => modifier({ imputationBudgetaire: e.target.value })} placeholder="Ligne budgétaire" className={champClasses} />
          </label>
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-[11px] font-semibold text-fg-muted">Responsable de la passation</span>
            <input value={data.responsablePassation} disabled={readOnly} onChange={(e) => modifier({ responsablePassation: e.target.value })} placeholder="Cellule des marchés…" className={champClasses} />
          </label>
        </div>
      </section>

      {/* Groupes de colonnes et défilement */}
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-2">
        <div className="inline-flex gap-0.5 rounded-md border border-line bg-inset p-0.75">
          {[...groupes.map((g) => ({ label: g.label, couleur: g.couleur, n: g.colonnes.length })), { ...GROUPE_SYNTHESE, n: SYNTHESE.length }].map((groupe) => (
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
              <span className="text-[11px] text-fg-subtle">{groupe.n}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!readOnly && manquantes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={retablirModele} title={manquantes.map((e) => e.designation).join(", ")}>
              <RotateCcw /> Rétablir le modèle ({manquantes.length})
            </Button>
          )}
          <span className="text-xs text-fg-subtle">{data.colonnes.length + SYNTHESE.length} colonnes</span>
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
          <div className="flex h-12 items-center border-b border-line bg-inset px-2.5 text-[11px] font-semibold text-fg-subtle">Marché</div>
          <div className="flex h-10.5 items-center border-b border-line px-2.5 text-[12.5px] font-medium text-fg">
            <span className="truncate">{activite.nom}</span>
          </div>
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="w-max">
            {/* Groupes */}
            <div className="flex">
              {groupes.map((g) => (
                <div
                  key={g.id}
                  className="flex h-7.5 shrink-0 items-center justify-between gap-1 border-r border-line bg-inset px-2.5 text-[11px] font-bold tracking-wide uppercase"
                  style={{ width: largeurGroupe(g.colonnes.length), borderTop: `2px solid ${g.couleur}`, color: g.couleur }}
                >
                  <span className="truncate">{g.label}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => ajouterAuGroupe(g.id)} title={`Ajouter une étape à « ${g.label} »`} aria-label={`Ajouter une étape à ${g.label}`} className={`${boutonIcone} hover:bg-hover hover:text-fg`}>
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              ))}
              <div
                className="flex h-7.5 shrink-0 items-center border-r border-line bg-inset px-2.5 text-[11px] font-bold tracking-wide uppercase"
                style={{ width: largeurSynthese, borderTop: `2px solid ${GROUPE_SYNTHESE.couleur}`, color: GROUPE_SYNTHESE.couleur }}
              >
                {GROUPE_SYNTHESE.label}
              </div>
            </div>

            {/* Étapes */}
            <div className="flex border-y border-line bg-inset">
              {groupes.map((g) =>
                g.colonnes.length === 0 ? (
                  <div key={g.id} className="flex h-12 shrink-0 items-center border-r border-line px-2 text-[11px] italic text-fg-subtle" style={{ width: LARGEUR }}>
                    Aucune étape
                  </div>
                ) : (
                  g.colonnes.map((c) => (
                    <div key={c.cle} className="group flex h-12 shrink-0 flex-col justify-center gap-0.5 border-r border-line px-2" style={{ width: LARGEUR }}>
                      {estDuModele(c.cle) || readOnly ? (
                        <span title={c.designation} className="truncate text-[11px] font-semibold text-fg-subtle">{c.designation}</span>
                      ) : (
                        <input
                          value={c.designation}
                          onChange={(e) => modifierColonne(c.cle, { designation: e.target.value })}
                          aria-label="Nom de l'étape"
                          title="Étape ajoutée : cliquez pour la renommer"
                          className="min-w-0 rounded border border-transparent bg-transparent text-[11px] font-semibold text-fg italic hover:border-line focus:border-primary focus:outline-none"
                        />
                      )}
                      {!readOnly && (
                        <div className="flex gap-0.5 opacity-40 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button type="button" onClick={() => insererApres(c.cle)} title="Insérer une étape après" aria-label={`Insérer une étape après ${c.designation}`} className={`${boutonIcone} hover:bg-hover hover:text-fg`}>
                            <Plus size={12} />
                          </button>
                          <button type="button" onClick={() => supprimer(c)} title="Supprimer l'étape" aria-label={`Supprimer l'étape ${c.designation}`} className={`${boutonIcone} hover:bg-danger-subtle hover:text-danger`}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ),
              )}
              {SYNTHESE.map((s) => (
                <div key={s.cle} title={s.label} className="flex h-12 shrink-0 items-center truncate border-r border-line px-2 text-[11px] font-semibold text-fg-subtle" style={{ width: LARGEUR_SYNTHESE }}>
                  {s.label}
                </div>
              ))}
            </div>

            {/* Le marché */}
            <div className="flex h-10.5 border-b border-line">
              {groupes.map((g) =>
                g.colonnes.length === 0 ? (
                  <div key={g.id} className="shrink-0 border-r border-line" style={{ width: LARGEUR }} />
                ) : (
                  g.colonnes.map((c) => (
                    <div key={c.cle} className="shrink-0 border-r border-line" style={{ width: LARGEUR }}>
                      {celluleEtape(c)}
                    </div>
                  ))
                ),
              )}
              {SYNTHESE.map((s) => (
                <div key={s.cle} className="shrink-0 border-r border-line" style={{ width: LARGEUR_SYNTHESE }}>
                  {celluleSynthese(s)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="px-4 py-2 text-xs text-fg-subtle">
        Une étape sans objet peut être supprimée : elle apparaîtra « N/A » dans le PPM du projet. Une étape ajoutée (en italique) se renomme
        dans son en-tête. Le délai de passation va de la première à la dernière étape datée. Non obj. BF : non-objection du bailleur de fonds.
      </p>
    </Card>
  );
}

/** Donnée du marché reprise de l'activité : affichée, modifiable seulement sur l'activité. */
function Donnee({ label, titre, children }: { label: string; titre: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" title={`${titre} — se modifie sur l'activité`}>
      <span className="text-[11px] font-semibold text-fg-muted">{label}</span>
      <span className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-line-subtle bg-inset px-2.5 text-[12.5px] font-medium text-fg">
        {children}
      </span>
    </div>
  );
}

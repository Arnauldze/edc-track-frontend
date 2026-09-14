"use client";

// ══════════════════════════════════════════════════════════════
// PLANIFICATION DE L'ÉTUDE PRÉALABLE — tableau des livrables
//
// Composant contrôlé : la page détient les livrables. Les dates, durées,
// délais et successeurs sont calculés par lib/livrableSchedule.ts, le même
// moteur que le serveur. Pour chaque livrable, l'échéance est fixée par la
// durée, le délai depuis T0 ou une date : les deux autres valeurs sont
// déduites (en italique) et restent modifiables — les modifier change la
// saisie qui fixe l'échéance.
// ══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, FileText, Info, Plus, Scale, Trash2, Upload } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import type { Livrable } from "@/services/api/planningService";
import {
  calculerCalendrierEtude,
  ecart,
  toDay,
  type ChampLivrable,
  type ModeFin,
  type Unite,
} from "@/lib/livrableSchedule";

interface Props {
  livrables: Livrable[];
  onChange: (livrables: Livrable[]) => void;
  /** Date T0 de l'activité (AAAA-MM-JJ), saisie dans les informations générales. */
  dateT0: string;
  readOnly: boolean;
}

const UNITES: { value: Unite; label: string }[] = [
  { value: "jours", label: "jours" },
  { value: "semaines", label: "sem." },
  { value: "mois", label: "mois" },
];

const GRID = "grid-cols-[56px_minmax(180px,1fr)_68px_84px_132px_128px_128px_132px_72px_76px]";

export const nouveauLivrable = (numero: string): Livrable => ({
  numero,
  intitule: "",
  ponderation: 0,
  duree: 1,
  dureeUnite: "mois",
  delaiUnite: "mois",
  modeFin: "duree",
  debutFixe: false,
  statut: "en_attente",
});

const prochainNumero = (livrables: Livrable[]) => {
  const max = livrables.reduce((m, l) => Math.max(m, Number(/^R(\d+)$/.exec(l.numero ?? "")?.[1] ?? 0)), 0);
  return `R${max + 1}`;
};

const formatQuantite = (value: number | undefined) =>
  value === undefined ? "" : value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

const parseQuantite = (raw: string): number | undefined => {
  const value = parseFloat(raw.replace(",", "."));
  return isFinite(value) && value >= 0 ? value : undefined;
};

const formatJour = (day?: string) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function PlanningFormEtude({ livrables, onChange, dateT0, readOnly }: Props) {
  const [showImportModal, setShowImportModal] = useState(false);
  const calendrier = useMemo(() => calculerCalendrierEtude(livrables, dateT0), [livrables, dateT0]);

  const problemeDe = (index: number, champ: ChampLivrable) =>
    calendrier.problemes.find((p) => p.index === index && p.champ === champ)?.message;
  // Un message par problème : une boucle est signalée sur chacune de ses lignes
  const problemesLignes = [...new Set(calendrier.problemes.filter((p) => p.champ !== "ponderation").map((p) => p.message))];
  const pondValide = Math.abs(calendrier.totalPonderation - 100) <= 0.01;

  // ── Modifications ──
  const modifier = (index: number, patch: Partial<Livrable>) =>
    onChange(livrables.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const renommer = (index: number, numero: string) => {
    const ancien = livrables[index].numero;
    onChange(
      livrables.map((l, i) =>
        i === index ? { ...l, numero } : l.predecesseur && l.predecesseur === ancien ? { ...l, predecesseur: numero } : l,
      ),
    );
  };

  const fixerFin = (index: number, mode: ModeFin, patch: Partial<Livrable>) => modifier(index, { ...patch, modeFin: mode });

  const ajouter = () => onChange([...livrables, nouveauLivrable(prochainNumero(livrables))]);

  const supprimer = (index: number) => {
    const retire = livrables[index].numero;
    onChange(
      livrables
        .filter((_, i) => i !== index)
        .map((l) => (l.predecesseur === retire ? { ...l, predecesseur: "" } : l)),
    );
  };

  const deplacer = (index: number, direction: -1 | 1) => {
    const cible = index + direction;
    if (cible < 0 || cible >= livrables.length) return;
    const copie = [...livrables];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    onChange(copie);
  };

  /** Répartit 100 % à parts égales, l'arrondi sur la dernière ligne. */
  const equilibrer = () => {
    if (livrables.length === 0) return;
    const part = Math.floor((100 / livrables.length) * 100) / 100;
    onChange(
      livrables.map((l, i) => ({
        ...l,
        ponderation: i === livrables.length - 1 ? Math.round((100 - part * (livrables.length - 1)) * 100) / 100 : part,
      })),
    );
  };

  const importer = (lignes: Record<string, unknown>[]) => {
    onChange(
      lignes.map((row) => ({
        ...nouveauLivrable(String(row.numero ?? "")),
        intitule: String(row.intitule ?? ""),
        ponderation: Number(row.ponderation) || 0,
        predecesseur: String(row.predecesseur ?? ""),
        description: row.description ? String(row.description) : undefined,
        duree: parseQuantite(String(row.duree ?? "")),
        delai: parseQuantite(String(row.delai ?? "")),
        dateDebut: toDay(String(row.dateDebut ?? "")),
        debutFixe: !!toDay(String(row.dateDebut ?? "")),
        dateFin: toDay(String(row.dateFin ?? "")),
        // Priorité de l'import : durée, sinon délai, sinon date de fin
        modeFin: parseQuantite(String(row.duree ?? "")) ? "duree" : parseQuantite(String(row.delai ?? "")) ? "delai" : "fin",
      })),
    );
  };

  // ── Styles ──
  const cellule = "px-1.5 py-1.5 flex items-center gap-1 border-r border-b border-[var(--border-default)] min-w-0";
  const champ = (options: { deduit?: boolean; erreur?: string }) =>
    [
      "w-full min-w-0 px-1.5 py-1 rounded text-[11px] border focus:outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed",
      options.erreur ? "border-red-500 bg-red-500/5" : "border-transparent hover:border-[var(--border-default)]",
      options.deduit ? "italic text-[var(--text-tertiary)] bg-[var(--bg-inset)]" : "bg-transparent text-[var(--text-primary)]",
    ].join(" ");
  const selectUnite = "shrink-0 w-[52px] px-0.5 py-1 bg-transparent text-[10px] rounded border border-[var(--border-subtle)] focus:outline-none disabled:opacity-60";

  const dureeEtude = calendrier.debut && calendrier.fin ? ecart(calendrier.debut, calendrier.fin, "mois") : undefined;

  return (
    <>
      <FileImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={importer} importType="etude" />

      <section className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden">
        <header className="p-5 border-b border-[var(--border-subtle)] flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={16} /> Planification de l&apos;étude préalable
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">
              Livrables de l&apos;étude : pondération, enchaînement et échéances.
            </p>
          </div>

          {/* Synthèse de l'étude */}
          <dl className="flex flex-wrap gap-2 text-[11px]">
            {[
              { label: "T0", value: dateT0 ? formatJour(dateT0) : "Non définie", alert: !dateT0 },
              { label: "Début", value: formatJour(calendrier.debut) },
              { label: "Fin", value: formatJour(calendrier.fin) },
              { label: "Durée", value: dureeEtude === undefined ? "—" : `${formatQuantite(dureeEtude)} mois` },
            ].map((item) => (
              <div
                key={item.label}
                className={`px-2.5 py-1.5 rounded-[var(--radius-md)] border ${item.alert ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-[var(--border-default)] bg-[var(--bg-inset)]"}`}
              >
                <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">{item.label}</dt>
                <dd className="font-semibold">{item.value}</dd>
              </div>
            ))}
            <div
              className={`px-2.5 py-1.5 rounded-[var(--radius-md)] border ${pondValide ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
            >
              <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">Pondération</dt>
              <dd className="font-semibold">{formatQuantite(calendrier.totalPonderation)} % {pondValide ? "✓" : "/ 100 %"}</dd>
            </div>
          </dl>
        </header>

        <div className="p-5 space-y-4">
          {readOnly && (
            <div className="flex gap-2 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertCircle size={15} className="shrink-0 mt-px" />
              <span><strong>Consultation :</strong> seul le chef de projet peut modifier la planification.</span>
            </div>
          )}

          {!dateT0 && (
            <div className="flex gap-2 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-400">
              <Info size={15} className="shrink-0 mt-px" />
              <span>Renseignez la <strong>date T0</strong> dans les informations générales : les livrables sans prédécesseur ni date de début démarrent à T0, et les délais se comptent depuis T0.</span>
            </div>
          )}

          {/* Tableau */}
          <div className="border border-[var(--border-default)] rounded-[var(--radius-md)] overflow-x-auto">
            <div className="min-w-[1060px]">
              <div className={`grid ${GRID} bg-[var(--bg-inset)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider`}>
                {["N°", "Intitulé du livrable", "Pond. %", "Préd.", "Début", "Durée", "Délai (T0 +)", "Échéance", "Succ.", ""].map((label, i) => (
                  <div key={i} className={`px-2 py-2 border-r border-b border-[var(--border-default)] ${i === 1 ? "" : "text-center"}`}>
                    {label}
                  </div>
                ))}
              </div>

              {calendrier.livrables.map((l, index) => {
                const saisi = livrables[index];
                const autres = livrables.filter((_, i) => i !== index && livrables[i].numero);
                return (
                  <div key={index} className={`grid ${GRID} text-[12px] hover:bg-[var(--bg-surface-hover)]`}>
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
                        value={saisi.intitule}
                        onChange={(e) => modifier(index, { intitule: e.target.value })}
                        disabled={readOnly}
                        placeholder="Nom du livrable…"
                        className={champ({})}
                      />
                    </div>
                    <div className={cellule}>
                      <input
                        inputMode="decimal"
                        value={saisi.ponderation ? formatQuantite(saisi.ponderation) : ""}
                        onChange={(e) => modifier(index, { ponderation: parseQuantite(e.target.value) ?? 0 })}
                        disabled={readOnly}
                        placeholder="0"
                        className={`${champ({})} text-center`}
                      />
                    </div>
                    <div className={cellule}>
                      <select
                        value={saisi.predecesseur ?? ""}
                        onChange={(e) => modifier(index, { predecesseur: e.target.value })}
                        disabled={readOnly}
                        title={problemeDe(index, "predecesseur") ?? "Livrable qui doit être terminé avant (série)"}
                        className={`${champ({ erreur: problemeDe(index, "predecesseur") })} text-center`}
                      >
                        <option value="">—</option>
                        {autres.map((o) => (
                          <option key={o.numero} value={o.numero}>{o.numero}</option>
                        ))}
                        {saisi.predecesseur && !autres.some((o) => o.numero === saisi.predecesseur) && (
                          <option value={saisi.predecesseur}>{saisi.predecesseur} ?</option>
                        )}
                      </select>
                    </div>
                    <div className={cellule}>
                      <input
                        type="date"
                        value={l.dateDebut ?? ""}
                        onChange={(e) => modifier(index, e.target.value ? { dateDebut: e.target.value, debutFixe: true } : { dateDebut: undefined, debutFixe: false })}
                        disabled={readOnly || !!l.predecesseur}
                        title={l.predecesseur ? `Fin de ${l.predecesseur}` : l.debutFixe ? "Date de début saisie (videz pour suivre T0)" : "Démarre à T0"}
                        className={champ({ deduit: !l.debutFixe, erreur: problemeDe(index, "dateDebut") })}
                      />
                    </div>
                    <div className={cellule}>
                      <input
                        inputMode="decimal"
                        value={formatQuantite(l.duree)}
                        onChange={(e) => fixerFin(index, "duree", { duree: parseQuantite(e.target.value) })}
                        disabled={readOnly}
                        title={l.modeFin === "duree" ? "La durée fixe l'échéance" : "Déduite — saisir une durée fixe l'échéance"}
                        className={`${champ({ deduit: l.modeFin !== "duree" })} text-center`}
                      />
                      <select value={l.dureeUnite} onChange={(e) => modifier(index, { dureeUnite: e.target.value as Unite })} disabled={readOnly} className={selectUnite}>
                        {UNITES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div className={cellule}>
                      <input
                        inputMode="decimal"
                        value={formatQuantite(l.delai)}
                        onChange={(e) => fixerFin(index, "delai", { delai: parseQuantite(e.target.value) })}
                        disabled={readOnly}
                        title={problemeDe(index, "delai") ?? (l.modeFin === "delai" ? "Le délai depuis T0 fixe l'échéance" : "Déduit — saisir un délai fixe l'échéance")}
                        className={`${champ({ deduit: l.modeFin !== "delai", erreur: problemeDe(index, "delai") })} text-center`}
                      />
                      <select value={l.delaiUnite} onChange={(e) => modifier(index, { delaiUnite: e.target.value as Unite })} disabled={readOnly} className={selectUnite}>
                        {UNITES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div className={cellule}>
                      <input
                        type="date"
                        value={l.dateFin ?? ""}
                        onChange={(e) => fixerFin(index, "fin", { dateFin: e.target.value || undefined })}
                        disabled={readOnly}
                        title={problemeDe(index, "dateFin") ?? (l.modeFin === "fin" ? "Échéance saisie" : "Déduite — saisir une date fixe l'échéance")}
                        className={champ({ deduit: l.modeFin !== "fin", erreur: problemeDe(index, "dateFin") })}
                      />
                    </div>
                    <div className={`${cellule} justify-center text-[10px] text-[var(--text-secondary)]`} title="Déduit des prédécesseurs">
                      {l.successeur ?? "—"}
                    </div>
                    <div className="px-1 py-1.5 flex items-center justify-center gap-0.5 border-b border-[var(--border-default)]">
                      {!readOnly && (
                        <>
                          <button type="button" onClick={() => deplacer(index, -1)} disabled={index === 0} title="Monter" className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-inset)] disabled:opacity-25">
                            <ArrowUp size={13} />
                          </button>
                          <button type="button" onClick={() => deplacer(index, 1)} disabled={index === livrables.length - 1} title="Descendre" className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-inset)] disabled:opacity-25">
                            <ArrowDown size={13} />
                          </button>
                          <button type="button" onClick={() => supprimer(index)} title="Supprimer" className="p-1 rounded text-red-500/70 hover:text-red-500 hover:bg-red-500/10">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {livrables.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-[var(--text-tertiary)]">Aucun livrable.</div>
              )}
            </div>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={ajouter} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-md)]">
                <Plus size={14} /> Ajouter un livrable
              </button>
              {!pondValide && livrables.length > 0 && (
                <button type="button" onClick={equilibrer} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)]" title="Répartir 100 % à parts égales">
                  <Scale size={14} /> Répartir 100 %
                </button>
              )}
              <button type="button" onClick={() => setShowImportModal(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)]">
                <Upload size={14} /> Importer depuis Excel
              </button>
            </div>
          )}

          {/* Problèmes à corriger avant d'enregistrer */}
          {(problemesLignes.length > 0 || (!pondValide && livrables.length > 0)) && (
            <div className="flex gap-2 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertCircle size={15} className="shrink-0 mt-px" />
              <ul className="space-y-0.5">
                {problemesLignes.map((message) => <li key={message}>{message}</li>)}
                {!pondValide && livrables.length > 0 && (
                  <li>La somme des pondérations doit être égale à 100 % (actuellement {formatQuantite(calendrier.totalPonderation)} %).</li>
                )}
              </ul>
            </div>
          )}

          <details className="rounded-[var(--radius-md)] border border-blue-500/20 bg-blue-500/5 text-[11px] text-blue-700 dark:text-blue-400">
            <summary className="px-3 py-2 cursor-pointer font-semibold">Règles de calcul</summary>
            <ul className="px-5 pb-3 space-y-1 list-disc">
              <li><strong>Délai</strong> : temps depuis T0 jusqu&apos;à l&apos;échéance (T0 + 3 mois = échéance).</li>
              <li><strong>Durée</strong> : temps d&apos;exécution du livrable (début + 1 mois = fin).</li>
              <li><strong>Échéance</strong> : fixée par la durée, le délai ou une date saisie ; les deux autres valeurs sont déduites et affichées en italique. Saisir une valeur en italique la rend déterminante.</li>
              <li><strong>Série</strong> : avec un prédécesseur, le livrable commence à la fin du prédécesseur.</li>
              <li><strong>Parallèle</strong> : sans prédécesseur, il commence à la date de début saisie, sinon à T0.</li>
              <li><strong>Successeurs</strong> : déduits automatiquement des prédécesseurs.</li>
              <li><strong>Mois</strong> : mois de calendrier (15 janv. + 1 mois = 15 févr.).</li>
              <li><strong>Pondération</strong> : la somme des livrables doit être égale à 100 %.</li>
            </ul>
          </details>
        </div>
      </section>
    </>
  );
}

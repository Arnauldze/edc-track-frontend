"use client";

// ══════════════════════════════════════════════════════════════
// RÉPARTITION
//
// Rien ne se saisit ici : tout vient du devis et du planning, par
// lib/repartition.ts. Seul le pas de temps se choisit.
//
// Deux tableaux, comme dans le classeur d'EDC :
//   la VENTILATION, qui dit combien de jours travaillés chaque ligne occupe
//   dans chaque période — c'est ce qui permet de vérifier le calcul ;
//   la RÉPARTITION elle-même, qui en tire quantités, montants et cumuls.
// ══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { AlertCircle, CalendarRange } from "lucide-react";
import {
  LIBELLE_PAS,
  repartir,
  type Echelle,
  type PasTemps,
  type Repartition,
  type TacheRepartie,
} from "@/lib/repartition";
import type { Calendrier } from "@/lib/livrableSchedule";
import type { Fiscalite, LigneDqe } from "@/lib/dqe";
import { totauxDqe } from "@/lib/dqe";

/** Ce qu'on montre pour chaque période : l'ordre des six colonnes du classeur. */
const COLONNES = [
  { cle: "quantite", label: "Qté période" },
  { cle: "quantiteCumulee", label: "Qté cumulée" },
  { cle: "montant", label: "Montant" },
  { cle: "montantCumule", label: "Montant cumulé" },
  { cle: "pourcentage", label: "% période" },
  { cle: "pourcentageCumule", label: "% cumulé" },
] as const;

const nf = (value: number, decimales = 2) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: decimales });

const formatMontant = (value: number) => Math.round(value).toLocaleString("fr-FR");

interface Props {
  dqe: LigneDqe[];
  taches: TacheRepartie[];
  echelle: Echelle;
  onEchelle: (echelle: Echelle) => void;
  fiscalite: Fiscalite;
  calendrierTravail?: Calendrier;
  readOnly: boolean;
}

export function RepartitionTable({ dqe, taches, echelle, onEchelle, fiscalite, calendrierTravail, readOnly }: Props) {
  const [vue, setVue] = useState<"repartition" | "ventilation">("repartition");

  const r: Repartition = useMemo(
    () => repartir(dqe, taches, echelle, calendrierTravail),
    [dqe, taches, echelle, calendrierTravail],
  );
  const totaux = useMemo(() => totauxDqe(dqe, fiscalite), [dqe, fiscalite]);

  const vide = r.lignes.length === 0;

  return (
    <section className="bg-surface rounded-lg border border-line overflow-hidden">
      <header className="px-4 py-2.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-fg flex items-center gap-2">
            <CalendarRange size={16} /> Répartition
          </h2>
          <p className="text-[11px] text-fg-muted mt-0.5">
            Quantités et montants étalés sur les périodes, au prorata des jours travaillés.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider font-bold text-fg-subtle">Pas de temps</span>
            <select
              value={echelle.pas}
              onChange={(e) => onEchelle({ ...echelle, pas: e.target.value as PasTemps })}
              disabled={readOnly}
              className="px-2 py-1 rounded-md border border-line bg-surface text-[11px] font-semibold text-fg focus:outline-none focus:border-primary disabled:opacity-60"
            >
              {(Object.keys(LIBELLE_PAS) as PasTemps[]).map((pas) => (
                <option key={pas} value={pas}>
                  {LIBELLE_PAS[pas]}
                </option>
              ))}
            </select>
          </label>

          {echelle.pas === "personnalise" && (
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                value={echelle.joursPersonnalises ?? 15}
                onChange={(e) =>
                  onEchelle({ ...echelle, joursPersonnalises: Math.max(1, parseInt(e.target.value) || 15) })
                }
                disabled={readOnly}
                className="w-16 px-2 py-1 rounded-md border border-line bg-surface text-right focus:outline-none focus:border-primary disabled:opacity-60"
              />
              <span className="text-fg-muted">jours</span>
            </label>
          )}

          <div className="flex rounded-md border border-line overflow-hidden">
            {(["repartition", "ventilation"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVue(v)}
                className={`px-2.5 py-1 text-[11px] font-semibold ${
                  vue === v ? "bg-inset text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {v === "repartition" ? "Répartition" : "Ventilation des jours"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {r.problemes.length > 0 && (
        <div className="border-b border-line-subtle bg-warning-subtle px-4 py-2 text-[11px] text-warning">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertCircle size={13} /> Une partie du devis ne peut pas être répartie
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {r.problemes.slice(0, 6).map((message) => (
              <li key={message}>{message}</li>
            ))}
            {r.problemes.length > 6 && <li>… et {r.problemes.length - 6} autre(s).</li>}
          </ul>
        </div>
      )}

      {vide ? (
        <p className="px-4 py-10 text-center text-[12px] text-fg-muted">
          Rien à répartir pour l&apos;instant. Reliez les lignes du devis aux tâches du planning, et donnez des dates
          à ces tâches.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="border-collapse text-[11px]">
              <thead>
                <tr className="bg-inset text-[10px] font-bold uppercase tracking-wide text-fg-subtle">
                  <th className="sticky left-0 z-10 bg-inset border-r border-b border-line px-2 py-2 text-left">N°</th>
                  <th className="sticky left-[70px] z-10 bg-inset border-r border-b border-line px-2 py-2 text-left min-w-[200px]">
                    Désignation
                  </th>
                  <th className="border-r border-b border-line px-2 py-2">Unité</th>
                  <th className="border-r border-b border-line px-2 py-2 text-right">Quantité</th>
                  <th className="border-r border-b border-line px-2 py-2 text-right">Début</th>
                  <th className="border-r border-b border-line px-2 py-2 text-right">Fin</th>
                  <th className="border-r border-b border-line px-2 py-2 text-right">Jours</th>
                  {r.periodes.map((periode) => (
                    <th
                      key={periode.rang}
                      colSpan={vue === "repartition" ? COLONNES.length : 1}
                      className="border-r border-b border-line px-2 py-2 text-center whitespace-nowrap"
                      title={`${periode.debut} → ${periode.fin} · ${periode.joursOuvres} jour(s) travaillé(s)`}
                    >
                      {periode.libelle}
                    </th>
                  ))}
                </tr>
                {vue === "repartition" && (
                  <tr className="bg-inset/60 text-[9px] font-semibold text-fg-subtle">
                    <th className="sticky left-0 z-10 bg-inset/60 border-r border-b border-line" />
                    <th className="sticky left-[70px] z-10 bg-inset/60 border-r border-b border-line" />
                    <th className="border-r border-b border-line" colSpan={5} />
                    {r.periodes.map((periode) =>
                      COLONNES.map((colonne) => (
                        <th
                          key={`${periode.rang}-${colonne.cle}`}
                          className="border-r border-b border-line px-1.5 py-1 whitespace-nowrap font-normal"
                        >
                          {colonne.label}
                        </th>
                      )),
                    )}
                  </tr>
                )}
              </thead>

              <tbody>
                {r.lignes.map((ligne) => (
                  <tr key={ligne.ligneId ?? ligne.numero} className="hover:bg-inset/40">
                    <th className="sticky left-0 z-10 bg-surface border-r border-b border-line px-2 py-1.5 text-left font-bold">
                      {ligne.numero}
                    </th>
                    <td
                      className="sticky left-[70px] z-10 bg-surface border-r border-b border-line px-2 py-1.5 max-w-[240px] truncate"
                      title={`${ligne.designation}\nRéalisée par : ${ligne.taches.join(", ")}`}
                    >
                      {ligne.designation}
                    </td>
                    <td className="border-r border-b border-line px-2 py-1.5 text-center text-fg-muted">{ligne.unite ?? "—"}</td>
                    <td className="border-r border-b border-line px-2 py-1.5 text-right tabular-nums">{nf(ligne.quantite, 3)}</td>
                    <td className="border-r border-b border-line px-2 py-1.5 text-right text-fg-muted whitespace-nowrap">{ligne.debut}</td>
                    <td className="border-r border-b border-line px-2 py-1.5 text-right text-fg-muted whitespace-nowrap">{ligne.fin}</td>
                    <td className="border-r border-b border-line px-2 py-1.5 text-right tabular-nums font-semibold">{ligne.totalJours}</td>

                    {vue === "ventilation"
                      ? ligne.jours.map((jours, i) => (
                          <td
                            key={i}
                            className={`border-r border-b border-line px-2 py-1.5 text-center tabular-nums ${
                              jours ? "font-semibold text-fg" : "text-fg-subtle"
                            }`}
                          >
                            {jours || "—"}
                          </td>
                        ))
                      : ligne.periodes.map((cellule, i) => (
                          <CellulesPeriode key={i} cellule={cellule} />
                        ))}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-inset font-semibold">
                  <th className="sticky left-0 z-10 bg-inset border-r border-b border-line px-2 py-2 text-left">—</th>
                  <td className="sticky left-[70px] z-10 bg-inset border-r border-b border-line px-2 py-2">
                    Total hors taxe
                  </td>
                  <td className="border-r border-b border-line" colSpan={5} />
                  {vue === "ventilation"
                    ? r.periodes.map((periode) => (
                        <td key={periode.rang} className="border-r border-b border-line px-2 py-2 text-center tabular-nums">
                          {periode.joursOuvres}
                        </td>
                      ))
                    : r.synthese.map((s) => (
                        <td
                          key={s.rang}
                          colSpan={COLONNES.length}
                          className="border-r border-b border-line px-2 py-2 text-right tabular-nums whitespace-nowrap"
                        >
                          {formatMontant(s.montant)} <span className="text-fg-subtle">· {nf(s.avancement, 1)} %</span>
                        </td>
                      ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px]">
            <p className="text-fg-subtle">
              {r.lignes.length} ligne(s) réparties sur {r.periodes.length} période(s), du {r.debut} au {r.fin}.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Réparti HT", value: `${formatMontant(r.totalHT)} FCFA` },
                { label: "Devis HT", value: `${formatMontant(totaux.totalHT)} FCFA` },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`px-2 py-1 rounded-md border ${
                    Math.abs(r.totalHT - totaux.totalHT) > 0.5 ? "border-warning/30 bg-warning-subtle text-warning" : "border-line bg-inset"
                  }`}
                >
                  <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">{item.label}</dt>
                  <dd className="font-semibold">{item.value}</dd>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Les six colonnes d'une période, pour une ligne. */
function CellulesPeriode({ cellule }: { cellule: import("@/lib/repartition").CelluleRepartition }) {
  const sourd = cellule.montant === 0 && cellule.quantite === 0;
  const classe = `border-r border-b border-line px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap ${
    sourd ? "text-fg-subtle" : ""
  }`;
  return (
    <>
      <td className={classe}>{cellule.quantite ? nf(cellule.quantite, 3) : "—"}</td>
      <td className={`${classe} text-fg-muted`}>{cellule.quantiteCumulee ? nf(cellule.quantiteCumulee, 3) : "—"}</td>
      <td className={classe}>{cellule.montant ? formatMontant(cellule.montant) : "—"}</td>
      <td className={`${classe} text-fg-muted`}>{cellule.montantCumule ? formatMontant(cellule.montantCumule) : "—"}</td>
      <td className={classe}>{cellule.pourcentage ? `${nf(cellule.pourcentage, 1)} %` : "—"}</td>
      <td className={`${classe} text-fg-muted`}>{cellule.pourcentageCumule ? `${nf(cellule.pourcentageCumule, 1)} %` : "—"}</td>
    </>
  );
}

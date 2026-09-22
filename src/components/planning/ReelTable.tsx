"use client";

// ══════════════════════════════════════════════════════════════
// RÉEL — LES DÉCOMPTES DE L'ENTREPRISE
//
// Le même tableau que la répartition, mais vide et saisissable — et une seule
// colonne l'est : la QUANTITÉ réellement exécutée sur la période. Le montant
// suit le prix unitaire du devis, les cumuls et l'avancement s'en déduisent,
// exactement comme dans un décompte.
//
// Un décompte reste attaché à la date de sa période, pas à son rang : changer
// le pas de temps d'affichage ne déplace pas ce qui a été constaté.
// ══════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  comparer,
  repartir,
  type Echelle,
  type Realisation,
  type TacheRepartie,
} from "@/lib/repartition";
import type { Calendrier } from "@/lib/livrableSchedule";
import type { LigneDqe } from "@/lib/dqe";

const nf = (value: number, decimales = 2) =>
  value.toLocaleString("fr-FR", { maximumFractionDigits: decimales });

const formatMontant = (value: number) => Math.round(value).toLocaleString("fr-FR");

const parseNombre = (raw: string): number => {
  const value = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return isFinite(value) && value >= 0 ? value : 0;
};

interface Props {
  dqe: LigneDqe[];
  taches: TacheRepartie[];
  echelle: Echelle;
  realisations: Realisation[];
  onRealisations: (realisations: Realisation[]) => void;
  calendrierTravail?: Calendrier;
  readOnly: boolean;
}

export function ReelTable({ dqe, taches, echelle, realisations, onRealisations, calendrierTravail, readOnly }: Props) {
  const c = useMemo(
    () => comparer(repartir(dqe, taches, echelle, calendrierTravail), realisations),
    [dqe, taches, echelle, calendrierTravail, realisations],
  );

  /** Remplace le décompte d'une ligne pour une période — zéro efface la saisie. */
  const saisir = (ligneId: string | undefined, periode: string, valeur: number) => {
    if (!ligneId) return;
    const autres = realisations.filter((r) => !(r.ligneId === ligneId && r.periode === periode));
    onRealisations(valeur > 0 ? [...autres, { ligneId, periode, quantite: valeur }] : autres);
  };

  const quantiteSaisie = (ligneId: string | undefined, periode: string) =>
    realisations.find((r) => r.ligneId === ligneId && r.periode === periode)?.quantite;

  if (!c.lignes.length) {
    return (
      <section className="rounded-lg border border-line bg-surface px-4 py-10 text-center">
        <h2 className="flex items-center justify-center gap-2 text-sm font-bold text-fg">
          <ClipboardCheck size={16} /> Réel
        </h2>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-fg-muted">
          Rien à constater pour l&apos;instant : il faut d&apos;abord un devis relié à des tâches datées.
        </p>
      </section>
    );
  }

  const cumulReel = c.synthese[c.synthese.length - 1];

  return (
    <section className="bg-surface rounded-lg border border-line overflow-hidden">
      <header className="px-4 py-2.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-fg flex items-center gap-2">
            <ClipboardCheck size={16} /> Réel
          </h2>
          <p className="text-[11px] text-fg-muted mt-0.5">
            Décomptes de l&apos;entreprise : saisissez la quantité exécutée, le reste se calcule.
          </p>
        </div>

        <dl className="flex flex-wrap gap-1.5 text-[11px]">
          {[
            { label: "Réalisé", value: `${formatMontant(cumulReel?.montantReelCumule ?? 0)} FCFA` },
            { label: "Avancement réel", value: `${nf(cumulReel?.avancementReel ?? 0, 1)} %` },
            {
              label: "Écart",
              value: `${(cumulReel?.ecart ?? 0) > 0 ? "+" : ""}${nf(cumulReel?.ecart ?? 0, 1)} pts`,
              alerte: (cumulReel?.ecart ?? 0) < 0,
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-2 py-1 rounded-md border ${
                item.alerte ? "border-warning/30 bg-warning-subtle text-warning" : "border-line bg-inset"
              }`}
              title={item.label === "Écart" ? "Avancement réel moins avancement prévu, en points." : undefined}
            >
              <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">{item.label}</dt>
              <dd className="font-semibold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="overflow-x-auto">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr className="bg-inset text-[10px] font-bold uppercase tracking-wide text-fg-subtle">
              <th className="sticky left-0 z-10 bg-inset border-r border-b border-line px-2 py-2 text-left">N°</th>
              <th className="sticky left-[70px] z-10 bg-inset border-r border-b border-line px-2 py-2 text-left min-w-[200px]">
                Désignation
              </th>
              <th className="border-r border-b border-line px-2 py-2">Unité</th>
              <th className="border-r border-b border-line px-2 py-2 text-right">Qté devis</th>
              <th className="border-r border-b border-line px-2 py-2 text-right">Qté réalisée</th>
              <th className="border-r border-b border-line px-2 py-2 text-right">Réalisé</th>
              {c.periodes.map((periode) => (
                <th
                  key={periode.rang}
                  className="border-r border-b border-line px-2 py-2 text-center whitespace-nowrap"
                  title={`${periode.debut} → ${periode.fin}`}
                >
                  {periode.libelle}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {c.lignes.map((ligne) => (
              <tr key={ligne.ligneId ?? ligne.numero} className="hover:bg-inset/40">
                <th className="sticky left-0 z-10 bg-surface border-r border-b border-line px-2 py-1.5 text-left font-bold">
                  {ligne.numero}
                </th>
                <td
                  className="sticky left-[70px] z-10 bg-surface border-r border-b border-line px-2 py-1.5 max-w-[240px] truncate"
                  title={ligne.designation}
                >
                  {ligne.designation}
                </td>
                <td className="border-r border-b border-line px-2 py-1.5 text-center text-fg-muted">{ligne.unite ?? "—"}</td>
                <td className="border-r border-b border-line px-2 py-1.5 text-right tabular-nums text-fg-muted">
                  {nf(ligne.quantite, 3)}
                </td>
                <td
                  className={`border-r border-b border-line px-2 py-1.5 text-right tabular-nums font-semibold ${
                    ligne.quantiteReelle > ligne.quantite ? "text-warning" : ""
                  }`}
                  title={
                    ligne.quantiteReelle > ligne.quantite
                      ? "La quantité déclarée dépasse celle du devis."
                      : undefined
                  }
                >
                  {nf(ligne.quantiteReelle, 3)}
                </td>
                <td className="border-r border-b border-line px-2 py-1.5 text-right tabular-nums text-fg-muted">
                  {nf(ligne.reel[ligne.reel.length - 1]?.pourcentageCumule ?? 0, 1)} %
                </td>

                {c.periodes.map((periode, i) => (
                  <td key={periode.rang} className="border-r border-b border-line p-0">
                    <ChampQuantite
                      valeur={quantiteSaisie(ligne.ligneId, periode.debut)}
                      onValeur={(v) => saisir(ligne.ligneId, periode.debut, v)}
                      disabled={readOnly}
                      placeholder={ligne.prevu[i].quantite ? nf(ligne.prevu[i].quantite, 2) : "—"}
                      title={`Prévu : ${nf(ligne.prevu[i].quantite, 3)} ${ligne.unite ?? ""}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-inset font-semibold">
              <th className="sticky left-0 z-10 bg-inset border-r border-b border-line px-2 py-2 text-left">—</th>
              <td className="sticky left-[70px] z-10 bg-inset border-r border-b border-line px-2 py-2">
                Montant réalisé · écart
              </td>
              <td className="border-r border-b border-line" colSpan={4} />
              {c.synthese.map((s) => (
                <td key={s.rang} className="border-r border-b border-line px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {formatMontant(s.montantReel)}
                  <span className={s.ecart < 0 ? "text-warning" : "text-fg-subtle"}>
                    {" "}· {s.ecart > 0 ? "+" : ""}
                    {nf(s.ecart, 1)}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="px-4 py-2.5 text-[11px] text-fg-subtle">
        En gris et en italique, la quantité prévue pour la période — c&apos;est le repère, pas une valeur saisie. Un
        décompte reste attaché aux dates de sa période : changer le pas de temps d&apos;affichage ne le déplace pas.
      </p>
    </section>
  );
}

/**
 * Saisie d'une quantité.
 *
 * Le champ garde le texte tapé tant qu'on y est. Le lier directement à la
 * valeur enregistrée rendrait les décimales impossibles à écrire : « 0, » vaut
 * zéro, la saisie serait effacée avant même qu'on ait tapé le chiffre suivant.
 * À la sortie du champ, l'affichage reprend la valeur enregistrée, remise en
 * forme.
 */
function ChampQuantite({
  valeur,
  onValeur,
  disabled,
  placeholder,
  title,
}: {
  valeur: number | undefined;
  onValeur: (valeur: number) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null);

  return (
    <input
      inputMode="decimal"
      value={brouillon ?? (valeur === undefined ? "" : nf(valeur, 3))}
      onChange={(e) => {
        setBrouillon(e.target.value);
        onValeur(parseNombre(e.target.value));
      }}
      onBlur={() => setBrouillon(null)}
      disabled={disabled}
      placeholder={placeholder}
      title={title}
      className="w-full min-w-[92px] bg-transparent px-2 py-1.5 text-right text-[11px] tabular-nums placeholder:text-fg-subtle placeholder:italic focus:outline-none focus:bg-primary-subtle disabled:cursor-not-allowed"
    />
  );
}

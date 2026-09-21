"use client";

// ══════════════════════════════════════════════════════════════
// COURBES DE L'EXÉCUTION
//
// Deux questions, posées à chaque comité : « combien faut-il décaisser cette
// période ? » et « où devrions-nous en être ? ». D'où deux panneaux, empilés
// et alignés sur le même axe du temps :
//
//   en haut   les montants par période — des barres, une grandeur à comparer ;
//   en bas    l'avancement cumulé — la courbe en S, de 0 à 100 %.
//
// Le classeur d'EDC les superpose sur deux axes verticaux. On ne le fait pas :
// deux échelles sur un même cadrage laissent croire à une correspondance entre
// les deux courbes qui n'existe pas — leur alignement ne dépend que du choix
// des bornes. Empilés, les deux panneaux se lisent à la même date sans rien
// suggérer de faux.
//
// Tout vient de lib/repartition.ts : rien ne se saisit ici.
// ══════════════════════════════════════════════════════════════

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { repartir, type Echelle, type TacheRepartie } from "@/lib/repartition";
import type { Calendrier } from "@/lib/livrableSchedule";
import type { LigneDqe } from "@/lib/dqe";

const formatMontant = (value: number) => Math.round(value).toLocaleString("fr-FR");

/** Abrège un montant pour l'axe : 12 400 000 → 12,4 M. */
function abreger(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1e3) return `${Math.round(value / 1e3)} k`;
  return String(Math.round(value));
}

interface Props {
  dqe: LigneDqe[];
  taches: TacheRepartie[];
  echelle: Echelle;
  calendrierTravail?: Calendrier;
}

interface Point {
  libelle: string;
  intervalle: string;
  montant: number;
  montantCumule: number;
  avancement: number;
}

export function CourbesExecution({ dqe, taches, echelle, calendrierTravail }: Props) {
  const r = useMemo(
    () => repartir(dqe, taches, echelle, calendrierTravail),
    [dqe, taches, echelle, calendrierTravail],
  );

  const points: Point[] = useMemo(
    () =>
      r.periodes.map((periode, i) => ({
        libelle: periode.libelle,
        intervalle: `${periode.debut} → ${periode.fin}`,
        montant: r.synthese[i].montant,
        montantCumule: r.synthese[i].montantCumule,
        avancement: r.synthese[i].avancement,
      })),
    [r],
  );

  if (!points.length) {
    return (
      <section className="rounded-lg border border-line bg-surface px-4 py-10 text-center">
        <h2 className="flex items-center justify-center gap-2 text-sm font-bold text-fg">
          <BarChart3 size={16} /> Courbes
        </h2>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-fg-muted">
          Rien à tracer pour l&apos;instant. Reliez les lignes du devis aux tâches du planning, et donnez des dates à
          ces tâches.
        </p>
      </section>
    );
  }

  return (
    <section className="viz-root bg-surface rounded-lg border border-line overflow-hidden">
      {/* Couleurs de tracé : le bleu et l'orange de la palette catégorielle,
          vérifiés contre les deux surfaces de l'application. */}
      <style>{`
        .viz-root {
          --viz-montant: #2a78d6;
          --viz-avancement: #eb6834;
          --viz-grille: var(--border-subtle, #e6e8ee);
          --viz-encre: var(--text-secondary, #52514e);
        }
        .dark .viz-root {
          --viz-montant: #3987e5;
          --viz-avancement: #d95926;
        }
      `}</style>

      <header className="px-4 py-2.5 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-fg flex items-center gap-2">
            <BarChart3 size={16} /> Courbes
          </h2>
          <p className="text-[11px] text-fg-muted mt-0.5">
            Dépenses prévues par période, et avancement cumulé du marché.
          </p>
        </div>
        <dl className="flex flex-wrap gap-1.5 text-[11px]">
          {[
            { label: "Périodes", value: String(points.length) },
            { label: "Pic de dépense", value: `${formatMontant(Math.max(...points.map((p) => p.montant)))} FCFA` },
            { label: "Total réparti", value: `${formatMontant(r.totalHT)} FCFA` },
          ].map((item) => (
            <div key={item.label} className="px-2 py-1 rounded-md border border-line bg-inset">
              <dt className="text-[9px] uppercase tracking-wider font-bold opacity-70">{item.label}</dt>
              <dd className="font-semibold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="px-3 py-3 space-y-1">
        <Panneau titre="Dépenses par période" unite="FCFA">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 8 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--viz-grille)" />
              <XAxis dataKey="libelle" tick={false} axisLine={{ stroke: "var(--viz-grille)" }} tickLine={false} height={4} />
              <YAxis
                tickFormatter={abreger}
                width={56}
                tick={{ fill: "var(--viz-encre)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<Infobulle />} cursor={{ fill: "var(--viz-grille)", fillOpacity: 0.35 }} />
              {/* Extrémité arrondie côté valeur, ancrée sur la ligne de base. */}
              <Bar dataKey="montant" fill="var(--viz-montant)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panneau>

        <Panneau titre="Avancement cumulé" unite="%">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grille)" />
              <XAxis
                dataKey="libelle"
                tick={{ fill: "var(--viz-encre)", fontSize: 10 }}
                axisLine={{ stroke: "var(--viz-grille)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v} %`}
                width={56}
                tick={{ fill: "var(--viz-encre)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<Infobulle />} cursor={{ stroke: "var(--viz-grille)", strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="avancement"
                stroke="var(--viz-avancement)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--viz-avancement)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panneau>
      </div>

      {/* Les mêmes chiffres en toutes lettres : une courbe ne se lit pas au franc près. */}
      <details className="border-t border-line-subtle px-4 py-2 text-[11px]">
        <summary className="cursor-pointer font-semibold text-fg-muted">Voir les valeurs</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="text-[11px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-fg-subtle">
                <th className="px-2 py-1">Période</th>
                <th className="px-2 py-1 text-right">Dépense</th>
                <th className="px-2 py-1 text-right">Cumul</th>
                <th className="px-2 py-1 text-right">Avancement</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.libelle} className="border-t border-line-subtle">
                  <td className="px-2 py-1 whitespace-nowrap" title={point.intervalle}>{point.libelle}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatMontant(point.montant)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-fg-muted">{formatMontant(point.montantCumule)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{point.avancement.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Panneau({ titre, unite, children }: { titre: string; unite: string; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      <figcaption className="px-2 pb-0.5 text-[11px] font-semibold text-fg">
        {titre} <span className="font-normal text-fg-subtle">({unite})</span>
      </figcaption>
      {children}
    </figure>
  );
}

interface InfobulleProps {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
}

function Infobulle({ active, payload }: InfobulleProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-2.5 py-2 text-[11px] shadow-lg">
      <p className="font-semibold text-fg">{point.libelle}</p>
      <p className="text-[10px] text-fg-subtle">{point.intervalle}</p>
      <dl className="mt-1.5 space-y-0.5">
        {[
          { label: "Dépense", value: `${formatMontant(point.montant)} FCFA` },
          { label: "Cumul", value: `${formatMontant(point.montantCumule)} FCFA` },
          { label: "Avancement", value: `${point.avancement.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` },
        ].map((item) => (
          <div key={item.label} className="flex justify-between gap-4">
            <dt className="text-fg-muted">{item.label}</dt>
            <dd className="font-semibold text-fg tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

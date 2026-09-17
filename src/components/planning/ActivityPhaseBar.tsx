"use client";

// Bande des phases d'une activité : une carte par phase (état, dates) et une
// frise qui les situe dans le temps. Les phases ont des dates indépendantes :
// la frise signale les chevauchements sans les corriger.

import { AlertTriangle, ArrowRight, CheckCircle2, Circle, CircleDashed, Plus } from "lucide-react";
import { voile } from "@/lib/activityTypes";
import { PHASE_LABELS, PHASE_ORDER, chevauchements, type Periode, type PhaseKey } from "@/lib/phaseTimeline";

export type PhaseTone = "ok" | "warn" | "todo" | "off";

export interface PhaseSummary {
  key: PhaseKey;
  active: boolean;
  tone: PhaseTone;
  status: string;
  periode: Periode;
  dirty: boolean;
}

interface Props {
  phases: PhaseSummary[];
  selected: PhaseKey;
  onSelect: (key: PhaseKey) => void;
  dateT0?: string;
}

/** Couleur de rôle de chaque phase (claire et sombre selon le thème). */
const COULEURS: Record<PhaseKey, string> = {
  etude: "var(--phase-etude)",
  passation: "var(--phase-passation)",
  execution: "var(--phase-execution)",
};

const TONE: Record<PhaseTone, { icon: typeof Circle; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-success" },
  warn: { icon: AlertTriangle, className: "text-warning" },
  todo: { icon: CircleDashed, className: "text-fg-muted" },
  off: { icon: Circle, className: "text-fg-subtle" },
};

const DAY = 86_400_000;
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const court = (day?: string) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export function ActivityPhaseBar({ phases, selected, onSelect, dateT0 }: Props) {
  const datees = phases.filter((p) => p.active && p.periode.debut && p.periode.fin);
  const bornes = [...datees.flatMap((p) => [p.periode.debut!, p.periode.fin!]), ...(dateT0 && datees.length ? [dateT0] : [])].sort();
  const debut = bornes[0];
  const fin = bornes[bornes.length - 1];
  const etendue = debut && fin ? Math.max(1, (utc(fin) - utc(debut)) / DAY) : 0;
  const position = (day: string) => ((utc(day) - utc(debut!)) / DAY / etendue) * 100;

  const recouvrements = chevauchements(Object.fromEntries(datees.map((p) => [p.key, p.periode])));

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="Phases de l'activité" className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        {PHASE_ORDER.map((key, index) => {
          const phase = phases.find((p) => p.key === key)!;
          const couleur = COULEURS[key];
          const tone = TONE[phase.tone];
          const ToneIcon = tone.icon;
          const ouverte = selected === key;
          return (
            <div key={key} className="contents">
              {index > 0 && (
                <div className="hidden items-center text-fg-subtle md:flex" aria-hidden>
                  <ArrowRight size={16} />
                </div>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={ouverte}
                onClick={() => onSelect(key)}
                style={ouverte ? { borderColor: couleur, background: voile(couleur) } : undefined}
                className={[
                  "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-[background-color,border-color,box-shadow] duration-150",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus",
                  ouverte ? "border-2" : "m-px border bg-surface hover:border-line-strong",
                  ouverte || phase.active ? "" : "border-dashed border-line-strong",
                  !ouverte && phase.active ? "border-line shadow-sm" : "",
                ].join(" ")}
              >
                <span className={`flex shrink-0 items-center gap-2 text-sm font-semibold ${phase.active ? "text-fg" : "text-fg-muted"}`}>
                    <span
                      aria-hidden
                      className="flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-fg-inverted"
                      style={{ background: phase.active ? couleur : "var(--text-tertiary)" }}
                    >
                      {index + 1}
                    </span>
                    {PHASE_LABELS[key]}
                  </span>
                  <span className={`flex min-w-0 items-center gap-1.5 truncate text-[12px] font-semibold ${tone.className}`}>
                    {phase.active ? <ToneIcon size={14} /> : <Plus size={14} />}
                    {phase.status}
                  </span>
                  <span className="ml-auto truncate text-xs text-fg-muted">
                    {phase.active ? `${court(phase.periode.debut)} → ${court(phase.periode.fin)}` : "Cliquez pour la planifier"}
                  </span>
                  {phase.dirty && <span className="size-2 shrink-0 rounded-full bg-accent" title="Modifications non enregistrées" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Frise des phases */}
      {datees.length > 0 && debut && fin && (
        <div className="rounded-lg border border-line bg-inset px-3.5 py-2.5">
          <div className="relative space-y-1.25">
            {dateT0 && (
              <div className="absolute -top-1 -bottom-1 w-px bg-fg-subtle" style={{ left: `${position(dateT0)}%` }} title={`T0 : ${court(dateT0)}`}>
                <span className="absolute -top-1.5 left-1 text-[10px] font-bold text-fg-subtle">T0</span>
              </div>
            )}
            {PHASE_ORDER.map((key) => {
              const phase = datees.find((p) => p.key === key);
              return (
                <div key={key} className="relative h-2">
                  {phase && (
                    <button
                      type="button"
                      onClick={() => onSelect(key)}
                      title={`${PHASE_LABELS[key]} : ${court(phase.periode.debut)} → ${court(phase.periode.fin)}`}
                      className={`absolute top-0 h-full rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus ${
                        selected === key ? "" : "opacity-45 hover:opacity-80"
                      }`}
                      style={{
                        background: COULEURS[key],
                        left: `${position(phase.periode.debut!)}%`,
                        width: `max(6px, ${position(phase.periode.fin!) - position(phase.periode.debut!)}%)`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-fg-subtle">
            <span>{court(debut)}</span>
            {recouvrements.length > 0 ? (
              <span className="flex min-w-0 items-center gap-1 text-warning">
                <AlertTriangle size={11} className="shrink-0" />
                <span className="truncate">
                  {recouvrements
                    .map((c) => `${PHASE_LABELS[c.avant]} et ${PHASE_LABELS[c.apres].toLowerCase()} se chevauchent du ${court(c.du)} au ${court(c.au)}`)
                    .join(" • ")}
                </span>
              </span>
            ) : (
              <span className="truncate">Phases aux dates indépendantes · aucun chevauchement</span>
            )}
            <span>{court(fin)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

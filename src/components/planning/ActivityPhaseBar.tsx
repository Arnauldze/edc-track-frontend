"use client";

// Bande des phases d'une activité : une carte par phase (état, dates) et une
// frise qui les situe dans le temps. Les phases ont des dates indépendantes :
// la frise signale les chevauchements sans les corriger.

import { AlertTriangle, ArrowRight, CheckCircle2, Circle, CircleDashed, Plus } from "lucide-react";
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

const COLORS: Record<PhaseKey, { bar: string; ring: string; soft: string; text: string }> = {
  etude: { bar: "bg-blue-500", ring: "border-blue-500", soft: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  passation: { bar: "bg-green-500", ring: "border-green-500", soft: "bg-green-500/10", text: "text-green-600 dark:text-green-400" },
  execution: { bar: "bg-purple-500", ring: "border-purple-500", soft: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
};

const TONE: Record<PhaseTone, { icon: typeof Circle; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-green-600 dark:text-green-400" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  todo: { icon: CircleDashed, className: "text-[var(--text-secondary)]" },
  off: { icon: Circle, className: "text-[var(--text-tertiary)]" },
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
    <div className="space-y-3">
      <div role="tablist" aria-label="Phases de l'activité" className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2">
        {PHASE_ORDER.map((key, index) => {
          const phase = phases.find((p) => p.key === key)!;
          const colors = COLORS[key];
          const tone = TONE[phase.tone];
          const ToneIcon = tone.icon;
          const isSelected = selected === key;
          return (
            <div key={key} className="contents">
              {index > 0 && (
                <div className="hidden md:flex items-center text-[var(--text-tertiary)]" aria-hidden>
                  <ArrowRight size={16} />
                </div>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelect(key)}
                className={`relative text-left p-3 rounded-[var(--radius-md)] border-2 transition-all ${
                  isSelected ? `${colors.ring} ${colors.soft}` : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                } ${phase.active ? "" : "border-dashed"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-2 text-[13px] font-bold ${phase.active ? colors.text : "text-[var(--text-secondary)]"}`}>
                    <span className={`w-5 h-5 rounded-full text-[10px] text-white flex items-center justify-center ${phase.active ? colors.bar : "bg-[var(--text-tertiary)]"}`}>
                      {index + 1}
                    </span>
                    {PHASE_LABELS[key]}
                  </span>
                  {phase.dirty && <span className="w-2 h-2 rounded-full bg-amber-500" title="Modifications non enregistrées" />}
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${tone.className}`}>
                  {phase.active ? <ToneIcon size={13} /> : <Plus size={13} />}
                  {phase.status}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  {phase.active ? `${court(phase.periode.debut)} → ${court(phase.periode.fin)}` : "Cliquez pour la planifier"}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Frise des phases */}
      {datees.length > 0 && debut && fin && (
        <div className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--bg-inset)] border border-[var(--border-subtle)]">
          <div className="relative space-y-1">
            {dateT0 && (
              <div className="absolute top-0 bottom-0 w-px bg-[var(--text-tertiary)]" style={{ left: `${position(dateT0)}%` }} title={`T0 : ${court(dateT0)}`}>
                <span className="absolute -top-0.5 left-1 text-[9px] font-bold text-[var(--text-tertiary)]">T0</span>
              </div>
            )}
            {PHASE_ORDER.map((key) => {
              const phase = datees.find((p) => p.key === key);
              return (
                <div key={key} className="relative h-2.5">
                  {phase && (
                    <button
                      type="button"
                      onClick={() => onSelect(key)}
                      title={`${PHASE_LABELS[key]} : ${court(phase.periode.debut)} → ${court(phase.periode.fin)}`}
                      className={`absolute top-0 h-full rounded-full ${COLORS[key].bar} ${selected === key ? "" : "opacity-60 hover:opacity-90"}`}
                      style={{
                        left: `${position(phase.periode.debut!)}%`,
                        width: `max(6px, ${position(phase.periode.fin!) - position(phase.periode.debut!)}%)`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[var(--text-tertiary)]">
            <span>{court(debut)}</span>
            {recouvrements.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={11} />
                {recouvrements
                  .map((c) => `${PHASE_LABELS[c.avant]} et ${PHASE_LABELS[c.apres].toLowerCase()} se chevauchent du ${court(c.du)} au ${court(c.au)}`)
                  .join(" • ")}
              </span>
            )}
            <span>{court(fin)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

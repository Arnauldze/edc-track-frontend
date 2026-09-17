"use client";

// ══════════════════════════════════════════════════════════════
// StructureTreeEditor — saisie de la structure d'un projet en un seul
// tableau arborescent (assistant de création).
//
// Au clavier, dans le nom : Entrée ajoute une ligne au même niveau,
// Tab la fait descendre d'un niveau, Maj + Tab la fait remonter.
// Seuls les composants portent un budget ; seules les unités fines
// portent un type d'activité (voir lib/structureOps.ts).
// ══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Plus, Trash2 } from "lucide-react";
import type { Component } from "@/services/api/projectService";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_ORDER, type ActivityType } from "@/lib/activityTypes";
import { CURRENCIES } from "@/lib/helpers/currencyHelpers";
import { formatMoney } from "@/lib/utils";
import { formatShare, parseAmount, shareOf, toFCFA, type ExchangeRates } from "@/lib/componentBudget";
import {
  addChild,
  addComponent,
  addSibling,
  canAddChild,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  indentUnit,
  moveUnitDown,
  moveUnitUp,
  outdentUnit,
  removeUnit,
  renameUnit,
  setUnitType,
  wbsNumbers,
} from "@/lib/structureOps";

interface Row {
  id: string;
  depth: 1 | 2 | 3;
  name: string;
  leaf: boolean;
  typeActivite?: ActivityType;
  budget?: number;
  devise?: string;
  count: number;
}

function flatten(components: Component[]): Row[] {
  const rows: Row[] = [];
  for (const c of components) {
    const scs = c.sousComposants ?? [];
    rows.push({ id: c.id, depth: 1, name: c.name, leaf: scs.length === 0, typeActivite: c.typeActivite, budget: c.budget, devise: c.devise, count: scs.length });
    for (const sc of scs) {
      rows.push({ id: sc.id, depth: 2, name: sc.name, leaf: sc.activities.length === 0, typeActivite: sc.typeActivite, count: sc.activities.length });
      for (const a of sc.activities) {
        rows.push({ id: a.id, depth: 3, name: a.name, leaf: true, typeActivite: a.typeActivite, count: 0 });
      }
    }
  }
  return rows;
}

const PLACEHOLDER = { 1: "Nom de la composante", 2: "Nom de la sous-composante", 3: "Nom de l'activité" } as const;
const COLS = "grid-cols-[52px_minmax(0,1fr)_150px_210px_64px_132px]";

const iconBtn =
  "w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-25 disabled:pointer-events-none transition-colors";

function BudgetCell({ budget, devise = "FCFA", onChange }: { budget?: number; devise?: string; onChange: (v: { budget?: number; devise: string }) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        aria-label="Budget de la composante"
        placeholder="Montant"
        value={draft ?? (budget ? formatMoney(budget, 0) : "")}
        onFocus={() => setDraft(budget ? String(budget).replace(".", ",") : "")}
        onChange={(e) => { setDraft(e.target.value); onChange({ budget: parseAmount(e.target.value), devise }); }}
        onBlur={() => setDraft(null)}
        className="min-w-0 flex-1 h-8 bg-inset border border-line rounded-[var(--radius-sm)] px-2 text-[12.5px] text-right tabular-nums text-fg focus:outline-none focus:border-primary"
      />
      <select
        aria-label="Devise"
        value={devise}
        onChange={(e) => onChange({ budget, devise: e.target.value })}
        className="h-8 w-[68px] bg-inset border border-line rounded-[var(--radius-sm)] px-1 text-[11.5px] font-semibold text-fg-muted focus:outline-none focus:border-primary cursor-pointer"
      >
        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
      </select>
    </div>
  );
}

interface StructureTreeEditorProps {
  value: Component[];
  onChange: (value: Component[]) => void;
  /** Budget financé en FCFA : référence des pondérations. */
  referenceFCFA: number;
  rates: ExchangeRates;
  /** Suppression d'une unité qui a des enfants : demander confirmation. */
  onConfirmRemove: (name: string, apply: () => void) => void;
}

export function StructureTreeEditor({ value, onChange, referenceFCFA, rates, onConfirmRemove }: StructureTreeEditorProps) {
  const rows = flatten(value);
  const numbers = wbsNumbers(value);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // Ligne à focaliser une fois la nouvelle structure affichée.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFocus.current) return;
    inputs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [value]);

  const setFocusId = (id: string) => { pendingFocus.current = id; };

  const insert = (result: { components: Component[]; id: string | null }) => {
    onChange(result.components);
    if (result.id) setFocusId(result.id);
  };

  const keepFocus = (id: string, next: Component[]) => {
    if (next === value) return;
    onChange(next);
    setFocusId(id);
  };

  const remove = (row: Row) => {
    const apply = () => onChange(removeUnit(value, row.id));
    if (row.count > 0) onConfirmRemove(row.name || PLACEHOLDER[row.depth].replace("Nom de ", ""), apply);
    else apply();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: Row) => {
    if (e.key === "Enter") {
      e.preventDefault();
      insert(addSibling(value, row.id, ""));
    } else if (e.key === "Tab" && !e.shiftKey && canIndent(value, row.id)) {
      e.preventDefault();
      keepFocus(row.id, indentUnit(value, row.id, rates));
    } else if (e.key === "Tab" && e.shiftKey && canOutdent(value, row.id)) {
      e.preventDefault();
      keepFocus(row.id, outdentUnit(value, row.id));
    }
  };

  return (
    <div className="space-y-2">
      <div className="border border-line rounded-[var(--radius-lg)] overflow-x-auto bg-surface">
        <div className="min-w-[760px]">
          <div className={`grid ${COLS} items-center h-9 px-2 border-b border-line bg-inset text-[11px] font-semibold uppercase tracking-wider text-fg-subtle`}>
            <span className="pl-1">N°</span>
            <span>Nom</span>
            <span>Type d&apos;activité</span>
            <span className="text-right pr-1">Budget</span>
            <span className="text-right">Pond.</span>
            <span />
          </div>

          {rows.map((row) => {
            const share = row.depth === 1 && row.budget ? shareOf(toFCFA(row.budget, row.devise, rates), referenceFCFA) : 0;
            const type = row.typeActivite ?? "travaux";
            return (
              <div
                key={row.id}
                className={`group grid ${COLS} items-center min-h-[42px] px-2 border-b border-line-subtle last:border-b-0 hover:bg-hover/60 ${row.depth === 1 ? "bg-inset/40" : ""}`}
              >
                <span className={`pl-1 font-mono text-[12px] tabular-nums ${row.depth === 1 ? "font-semibold text-fg" : "text-fg-muted"}`}>
                  {numbers.get(row.id)}
                </span>

                <div className="flex items-center min-w-0" style={{ paddingLeft: (row.depth - 1) * 22 }}>
                  {row.leaf && (
                    <span className={`w-2 h-2 mr-2 rounded-full flex-shrink-0 ${ACTIVITY_TYPES[type].pastille}`} aria-hidden />
                  )}
                  <input
                    ref={(el) => { if (el) inputs.current.set(row.id, el); else inputs.current.delete(row.id); }}
                    type="text"
                    value={row.name}
                    placeholder={PLACEHOLDER[row.depth]}
                    onChange={(e) => onChange(renameUnit(value, row.id, e.target.value))}
                    onKeyDown={(e) => onKeyDown(e, row)}
                    className={`w-full min-w-0 h-8 bg-transparent border border-transparent rounded-[var(--radius-sm)] px-2 text-fg placeholder:text-fg-subtle hover:border-line focus:bg-surface focus:border-primary focus:outline-none ${row.depth === 1 ? "text-[13.5px] font-semibold" : row.depth === 2 ? "text-[13px] font-medium" : "text-[13px]"}`}
                  />
                </div>

                <div className="pr-2">
                  {row.leaf ? (
                    <select
                      aria-label="Type d'activité"
                      value={type}
                      onChange={(e) => onChange(setUnitType(value, row.id, e.target.value as ActivityType))}
                      className="w-full h-8 bg-inset border border-line rounded-[var(--radius-sm)] px-2 text-[12px] text-fg focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {ACTIVITY_TYPE_ORDER.map((t) => <option key={t} value={t}>{ACTIVITY_TYPES[t].label}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 text-[12px] text-fg-subtle">
                      {row.count} {row.depth === 1 ? `sous-composante${row.count > 1 ? "s" : ""}` : `activité${row.count > 1 ? "s" : ""}`}
                    </span>
                  )}
                </div>

                <div className="pr-1">
                  {row.depth === 1 && (
                    <BudgetCell
                      budget={row.budget}
                      devise={row.devise}
                      onChange={(v) => onChange(value.map((c) => (c.id === row.id ? { ...c, budget: v.budget, devise: v.devise } : c)))}
                    />
                  )}
                </div>

                <span className="text-right text-[12px] tabular-nums text-fg-muted">
                  {row.depth === 1 && referenceFCFA > 0 && row.budget ? formatShare(share) : ""}
                </span>

                <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <button type="button" className={iconBtn} title="Monter" disabled={!canMoveUp(value, row.id)} onClick={() => onChange(moveUnitUp(value, row.id))}><ArrowUp size={14} /></button>
                  <button type="button" className={iconBtn} title="Descendre" disabled={!canMoveDown(value, row.id)} onClick={() => onChange(moveUnitDown(value, row.id))}><ArrowDown size={14} /></button>
                  <button type="button" className={iconBtn} title="Remonter d'un niveau (Maj + Tab)" disabled={!canOutdent(value, row.id)} onClick={() => onChange(outdentUnit(value, row.id))}><IndentDecrease size={14} /></button>
                  <button type="button" className={iconBtn} title="Descendre d'un niveau (Tab)" disabled={!canIndent(value, row.id)} onClick={() => onChange(indentUnit(value, row.id, rates))}><IndentIncrease size={14} /></button>
                  <button type="button" className={iconBtn} title="Ajouter un élément dedans" disabled={!canAddChild(value, row.id)} onClick={() => insert(addChild(value, row.id, ""))}><Plus size={14} /></button>
                  <button type="button" className={`${iconBtn} hover:text-danger hover:bg-danger-subtle`} title="Supprimer" onClick={() => remove(row)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => insert(addComponent(value, ""))}
            className="w-full h-10 flex items-center gap-2 px-4 border-t border-line text-[12.5px] font-semibold text-primary-fg hover:bg-primary-subtle transition-colors"
          >
            <Plus size={14} /> Ajouter une composante
          </button>
        </div>
      </div>
      <p className="text-[12px] text-fg-subtle">
        Au clavier : Entrée ajoute une ligne au même niveau, Tab la fait descendre d&apos;un niveau, Maj + Tab la fait remonter.
      </p>
    </div>
  );
}

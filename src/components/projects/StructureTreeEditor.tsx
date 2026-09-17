"use client";

// ══════════════════════════════════════════════════════════════
// StructureTreeEditor — saisie de la structure d'un projet en un seul
// tableau arborescent (assistant de création).
//
// Au clavier, dans le nom : Entrée ajoute une ligne au même niveau,
// Tab la fait descendre d'un niveau, Maj + Tab la fait remonter.
// La barre d'outils agit sur la ligne sélectionnée (la dernière touchée).
// Seuls les composants portent un budget ; seules les unités fines
// portent un type d'activité (voir lib/structureOps.ts).
// ══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, IndentDecrease, IndentIncrease, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { Component } from "@/services/api/projectService";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_ORDER, type ActivityType } from "@/lib/activityTypes";
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
  /** Nombre d'enfants directs. */
  count: number;
  /** Activités sous cette unité, pour la ligne repliée. */
  feuilles: number;
}

function flatten(components: Component[], collapsed: Set<string>): Row[] {
  const rows: Row[] = [];
  for (const c of components) {
    const scs = c.sousComposants ?? [];
    const feuilles = scs.reduce((n, sc) => n + Math.max(1, sc.activities.length), 0);
    rows.push({ id: c.id, depth: 1, name: c.name, leaf: scs.length === 0, typeActivite: c.typeActivite, budget: c.budget, devise: c.devise, count: scs.length, feuilles });
    if (collapsed.has(c.id)) continue;
    for (const sc of scs) {
      rows.push({ id: sc.id, depth: 2, name: sc.name, leaf: sc.activities.length === 0, typeActivite: sc.typeActivite, count: sc.activities.length, feuilles: sc.activities.length });
      if (collapsed.has(sc.id)) continue;
      for (const a of sc.activities) {
        rows.push({ id: a.id, depth: 3, name: a.name, leaf: true, typeActivite: a.typeActivite, count: 0, feuilles: 0 });
      }
    }
  }
  return rows;
}

const PLACEHOLDER = { 1: "Nom de la composante", 2: "Nom de la sous-composante", 3: "Nom de l'activité" } as const;
const COLS = "grid-cols-[44px_minmax(0,1fr)_168px_124px_62px_30px]";

const outilClass =
  "h-[30px] px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12.5px] font-medium text-fg hover:bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors";

/** Budget d'une composante, en FCFA : les devises des sources sont traitées à l'étape Financement. */
function BudgetCell({ budget, onChange }: { budget?: number; onChange: (budget?: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Budget de la composante, en FCFA"
      placeholder="Budget"
      value={draft ?? (budget ? formatMoney(budget, 0) : "")}
      onFocus={() => setDraft(budget ? String(budget).replace(".", ",") : "")}
      onChange={(e) => { setDraft(e.target.value); onChange(parseAmount(e.target.value)); }}
      onBlur={() => setDraft(null)}
      className="w-full h-[30px] bg-transparent border border-transparent rounded-[var(--radius-sm)] px-2 font-mono text-[12.5px] font-semibold text-right text-fg placeholder:font-sans placeholder:font-normal placeholder:text-fg-subtle hover:border-line focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none transition-colors"
    />
  );
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

/** Menu « … » d'une ligne : les mêmes commandes que la barre d'outils, sur cette ligne. */
function RowMenu({ ouvert, onOuvrir, items }: { ouvert: boolean; onOuvrir: (v: boolean) => void; items: MenuItem[] }) {
  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label="Actions sur cette ligne"
        aria-expanded={ouvert}
        onClick={() => onOuvrir(!ouvert)}
        className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-subtle hover:bg-hover hover:text-fg transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOuvrir(false)} />
          <div className="absolute right-0 top-8 z-50 w-60 rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-lg)]">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => { item.run(); onOuvrir(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] hover:bg-hover disabled:opacity-30 disabled:pointer-events-none transition-colors ${item.danger ? "text-danger" : "text-fg"}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </>
      )}
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const rows = flatten(value, collapsed);
  const numbers = wbsNumbers(value);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // Ligne à focaliser une fois la nouvelle structure affichée.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingFocus.current) return;
    inputs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [value]);

  const insert = (result: { components: Component[]; id: string | null }) => {
    onChange(result.components);
    if (result.id) {
      pendingFocus.current = result.id;
      setSelected(result.id);
    }
  };

  const apply = (id: string, next: Component[]) => {
    if (next === value) return;
    onChange(next);
    pendingFocus.current = id;
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const remove = (row: Row) => {
    const run = () => onChange(removeUnit(value, row.id));
    if (row.count > 0) onConfirmRemove(row.name.trim() || "Élément sans nom", run);
    else run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: Row) => {
    if (e.key === "Enter") {
      e.preventDefault();
      insert(addSibling(value, row.id, ""));
    } else if (e.key === "Tab" && !e.shiftKey && canIndent(value, row.id)) {
      e.preventDefault();
      apply(row.id, indentUnit(value, row.id, rates));
    } else if (e.key === "Tab" && e.shiftKey && canOutdent(value, row.id)) {
      e.preventDefault();
      apply(row.id, outdentUnit(value, row.id));
    }
  };

  // La barre d'outils agit sur la ligne sélectionnée, si elle est visible.
  const cible = selected && rows.some((r) => r.id === selected) ? selected : null;

  return (
    <div className="space-y-2">
      <div className="border border-line rounded-[var(--radius-lg)] bg-surface overflow-hidden">
        {/* Outils */}
        <div className="flex flex-wrap items-center gap-1 px-2.5 py-2 border-b border-line">
          <button type="button" onClick={() => insert(addComponent(value, ""))} className="h-[30px] px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover transition-colors">
            <Plus size={15} strokeWidth={2.5} /> Composante
          </button>
          <button type="button" disabled={!cible || !canAddChild(value, cible)} onClick={() => cible && insert(addChild(value, cible, ""))} className={outilClass} title="Ajouter un élément dans la ligne sélectionnée">
            <Plus size={15} /> Sous-niveau
          </button>
          <button type="button" disabled={!cible} onClick={() => cible && insert(addSibling(value, cible, ""))} className={outilClass} title="Ajouter une ligne au même niveau (Entrée)">
            <Plus size={15} /> Même niveau
          </button>
          <span className="w-px h-5 bg-line mx-1" aria-hidden />
          <button type="button" disabled={!cible || !canOutdent(value, cible)} onClick={() => cible && apply(cible, outdentUnit(value, cible))} className={outilClass} title="Remonter d'un niveau (Maj + Tab)">
            <IndentDecrease size={15} /> Monter
          </button>
          <button type="button" disabled={!cible || !canIndent(value, cible)} onClick={() => cible && apply(cible, indentUnit(value, cible, rates))} className={outilClass} title="Descendre d'un niveau (Tab)">
            <IndentIncrease size={15} /> Descendre
          </button>
        </div>

        <div>
          <div>
            <div className={`grid ${COLS} gap-2.5 items-center h-8 px-3 border-b border-line bg-inset text-[11px] font-semibold uppercase tracking-wider text-fg-subtle`}>
              <span>N°</span>
              <span>Nom</span>
              <span>Type d&apos;activité</span>
              <span className="text-right">Budget FCFA</span>
              <span className="text-right">Pond.</span>
              <span />
            </div>

            {rows.map((row) => {
              const composante = row.depth === 1;
              const share = composante && row.budget ? shareOf(toFCFA(row.budget, row.devise, rates), referenceFCFA) : 0;
              const type = row.typeActivite ?? "travaux";
              const actif = row.id === cible;
              const replie = collapsed.has(row.id);
              return (
                <div
                  key={row.id}
                  className={`group grid ${COLS} gap-2.5 items-center h-[42px] px-3 border-b border-line-subtle last:border-b-0 transition-colors
                    ${actif ? "bg-primary-subtle shadow-[inset_2px_0_0_var(--primary)]" : composante ? "bg-inset" : "bg-surface hover:bg-hover/50"}`}
                >
                  <span className={`font-mono text-[11.5px] tabular-nums ${composante ? "font-semibold text-fg" : "text-fg-subtle"}`}>
                    {numbers.get(row.id)}
                  </span>

                  <div className="flex items-center gap-1.5 min-w-0" style={{ paddingLeft: (row.depth - 1) * 20 }}>
                    {row.leaf ? (
                      <span className="w-4 flex-shrink-0" aria-hidden />
                    ) : (
                      <button type="button" onClick={() => toggle(row.id)} aria-label={replie ? "Déplier" : "Replier"} className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-fg-subtle hover:text-fg">
                        {replie ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
                      </button>
                    )}
                    <input
                      ref={(el) => { if (el) inputs.current.set(row.id, el); else inputs.current.delete(row.id); }}
                      type="text"
                      value={row.name}
                      placeholder={PLACEHOLDER[row.depth]}
                      onChange={(e) => onChange(renameUnit(value, row.id, e.target.value))}
                      onFocus={() => setSelected(row.id)}
                      onKeyDown={(e) => onKeyDown(e, row)}
                      className={`w-full min-w-0 h-[30px] bg-transparent border border-transparent rounded-[var(--radius-sm)] px-2 text-[13px] text-fg placeholder:text-fg-subtle hover:border-line focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none transition-colors ${composante ? "font-semibold" : row.depth === 2 ? "font-medium" : ""}`}
                    />
                  </div>

                  <div className="min-w-0">
                    {row.leaf ? (
                      <div className="inline-flex items-center h-[26px] rounded-[var(--radius-sm)] border border-line bg-surface pl-2">
                        <span className={`w-2 h-2 rounded-sm ${ACTIVITY_TYPES[type].pastille}`} aria-hidden />
                        <select
                          aria-label="Type d'activité"
                          value={type}
                          onChange={(e) => onChange(setUnitType(value, row.id, e.target.value as ActivityType))}
                          className="h-full bg-transparent pl-1.5 pr-1 text-[12px] text-fg focus:outline-none cursor-pointer"
                        >
                          {ACTIVITY_TYPE_ORDER.map((t) => <option key={t} value={t}>{ACTIVITY_TYPES[t].label}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[12px] text-fg-subtle">
                        {replie
                          ? `${row.feuilles} activité${row.feuilles > 1 ? "s" : ""}`
                          : `${row.count} ${composante ? `sous-composante${row.count > 1 ? "s" : ""}` : `activité${row.count > 1 ? "s" : ""}`}`}
                      </span>
                    )}
                  </div>

                  <div>
                    {composante && (
                      <BudgetCell
                        budget={row.budget}
                        onChange={(budget) => onChange(value.map((c) => (c.id === row.id ? { ...c, budget, devise: "FCFA" } : c)))}
                      />
                    )}
                  </div>

                  <span className="text-right text-[12.5px] tabular-nums text-fg-muted">
                    {composante && referenceFCFA > 0 && row.budget ? formatShare(share) : ""}
                  </span>

                  <RowMenu
                    ouvert={menu === row.id}
                    onOuvrir={(v) => setMenu(v ? row.id : null)}
                    items={[
                      { label: "Ajouter un sous-niveau", icon: <Plus size={14} />, disabled: !canAddChild(value, row.id), run: () => insert(addChild(value, row.id, "")) },
                      { label: "Ajouter au même niveau", icon: <Plus size={14} />, run: () => insert(addSibling(value, row.id, "")) },
                      { label: "Monter d'un niveau", icon: <IndentDecrease size={14} />, disabled: !canOutdent(value, row.id), run: () => apply(row.id, outdentUnit(value, row.id)) },
                      { label: "Descendre d'un niveau", icon: <IndentIncrease size={14} />, disabled: !canIndent(value, row.id), run: () => apply(row.id, indentUnit(value, row.id, rates)) },
                      { label: "Déplacer vers le haut", icon: <ArrowUp size={14} />, disabled: !canMoveUp(value, row.id), run: () => apply(row.id, moveUnitUp(value, row.id)) },
                      { label: "Déplacer vers le bas", icon: <ArrowDown size={14} />, disabled: !canMoveDown(value, row.id), run: () => apply(row.id, moveUnitDown(value, row.id)) },
                      { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, run: () => remove(row) },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-[12px] text-fg-subtle">
        Au clavier : Entrée ajoute une ligne au même niveau, Tab la fait descendre d&apos;un niveau, Maj + Tab la fait remonter.
      </p>
    </div>
  );
}

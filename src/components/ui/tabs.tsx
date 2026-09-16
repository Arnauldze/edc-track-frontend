"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// ONGLETS ET SÉLECTEUR SEGMENTÉ
// Tabs : sections d'une page (souligné bleu).
// SegmentedControl : bascule entre vues d'un même contenu (Tableau / Gantt).
// Les deux se pilotent au clavier avec les flèches, Début et Fin.
// ══════════════════════════════════════════════════════════════

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Compteur affiché après le libellé. */
  count?: number;
  disabled?: boolean;
}

interface TabListProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom accessible de la liste. */
  label: string;
  /** Préfixe des identifiants : les panneaux utilisent `${idBase}-panel-${value}`. */
  idBase?: string;
  className?: string;
}

function useRovingKeys<T extends string>(items: TabItem<T>[], value: T, onChange: (value: T) => void) {
  const refs = React.useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = (event: React.KeyboardEvent) => {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    const next = {
      ArrowRight: enabled[(index + 1) % enabled.length],
      ArrowLeft: enabled[(index - 1 + enabled.length) % enabled.length],
      Home: enabled[0],
      End: enabled[enabled.length - 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  const register = (key: T) => (node: HTMLButtonElement | null) => {
    if (node) refs.current.set(key, node);
    else refs.current.delete(key);
  };

  return { onKeyDown, register };
}

export function Tabs<T extends string>({ items, value, onChange, label, idBase, className }: TabListProps<T>) {
  const { onKeyDown, register } = useRovingKeys(items, value, onChange);
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn("flex gap-6 border-b border-line", className)}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={register(item.value)}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${item.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${item.value}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[13px] transition-colors duration-150",
              "focus-visible:rounded-sm focus-visible:outline-offset-4 disabled:opacity-45",
              selected ? "border-primary font-semibold text-fg" : "border-transparent font-medium text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="text-[11px] font-medium text-fg-subtle">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({ items, value, onChange, label, idBase, className }: TabListProps<T>) {
  const { onKeyDown, register } = useRovingKeys(items, value, onChange);
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex gap-0.5 rounded-md border border-line bg-inset p-0.75", className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={register(item.value)}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${item.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${item.value}` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex h-6.5 items-center gap-1.5 rounded-sm px-3 text-xs transition-[background-color,color,box-shadow] duration-150 disabled:opacity-45",
              selected ? "bg-surface font-semibold text-fg shadow-sm" : "font-medium text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="text-[11px] font-medium text-fg-subtle">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

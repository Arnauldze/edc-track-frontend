"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, CornerDownLeft, FolderKanban, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { getLeafActivities } from "@/lib/projectStore";
import { Kbd } from "@/components/ui/kbd";
import type { NavSection } from "./navigation";

// ══════════════════════════════════════════════════════════════
// RECHERCHE GLOBALE (Ctrl K) — pages, projets et activités.
// Monté seulement à l'ouverture : les projets ne sont chargés
// qu'au premier usage, puis servis depuis le cache.
// ══════════════════════════════════════════════════════════════

interface Result {
  id: string;
  group: "Pages" | "Projets" | "Activités";
  label: string;
  detail?: string;
  href: string;
  icon: LucideIcon;
}

const LIMITS = { Pages: 7, Projets: 6, Activités: 8 } as const;

/** Minuscules sans accents, pour une recherche tolérante (« etude » trouve « Étude »). */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function matches(query: string, ...fields: (string | undefined)[]) {
  const haystack = normalize(fields.filter(Boolean).join(" "));
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

interface CommandPaletteProps {
  sections: NavSection[];
  onClose: () => void;
}

export function CommandPalette({ sections, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: projects, isLoading, isError } = useProjects();

  const allResults = useMemo<Result[]>(() => {
    const pages = sections.map((section) => ({
      id: `page:${section.href}`,
      group: "Pages" as const,
      label: section.label,
      href: section.href,
      icon: section.icon,
    }));
    const projectResults = (projects ?? []).map((project) => ({
      id: `project:${project.code}`,
      group: "Projets" as const,
      label: project.name,
      detail: project.code,
      href: `/planification/${encodeURIComponent(project.code)}`,
      icon: FolderKanban,
    }));
    const activities = (projects ?? []).flatMap((project) =>
      getLeafActivities(project).map((leaf) => ({
        id: `activity:${project.code}:${leaf.path}`,
        group: "Activités" as const,
        label: leaf.name,
        detail: [project.name, leaf.componentName, leaf.subComponentName]
          .filter((part) => part && part !== leaf.name)
          .join(" › "),
        href: `/planification/${encodeURIComponent(project.code)}/${encodeURIComponent(leaf.path)}`,
        icon: CalendarRange,
      })),
    );
    return [...pages, ...projectResults, ...activities];
  }, [sections, projects]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const counts = { Pages: 0, Projets: 0, Activités: 0 };
    return allResults.filter((result) => {
      // Sans saisie : les pages seulement, comme point de départ.
      if (!trimmed) return result.group === "Pages";
      if (counts[result.group] >= LIMITS[result.group] || !matches(trimmed, result.label, result.detail)) return false;
      counts[result.group] += 1;
      return true;
    });
  }, [allResults, query]);

  const active = results[Math.min(activeIndex, results.length - 1)];
  const optionId = (result: Result) => `${listId}-${result.id}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (active) document.getElementById(`${listId}-${active.id}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const open = (result: Result) => {
    onClose();
    router.push(result.href);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      // Le champ est le seul élément focalisable : le focus reste dans la fenêtre.
      event.preventDefault();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const current = Math.min(activeIndex, results.length - 1);
      setActiveIndex((current + step + results.length) % results.length);
    } else if (event.key === "Enter" && active) {
      event.preventDefault();
      open(active);
    }
  };

  const groups = (["Pages", "Projets", "Activités"] as const)
    .map((group) => ({ group, items: results.filter((result) => result.group === group) }))
    .filter(({ items }) => items.length > 0);

  const searchingProjects = query.trim() !== "" && (isLoading || isError);
  let status: ReactNode = null;
  if (results.length === 0) {
    status = searchingProjects
      ? isError
        ? "Les projets n'ont pas pu être chargés."
        : "Chargement des projets…"
      : `Aucun résultat pour « ${query.trim()} ».`;
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-overlay px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[min(560px,76vh)] w-full max-w-150 animate-pop-in flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden className="size-4.5 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={active ? optionId(active) : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un projet, une activité, une page…"
            className="h-13 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <Kbd>Échap</Kbd>
        </div>

        <div id={listId} role="listbox" aria-label="Résultats" className="min-h-0 overflow-y-auto p-2">
          {groups.map(({ group, items }) => (
            <div key={group} role="group" aria-label={group} className="pb-1">
              <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-fg-subtle">{group}</div>
              {items.map((result) => {
                const selected = result === active;
                const Icon = result.icon;
                return (
                  <div
                    key={result.id}
                    id={optionId(result)}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActiveIndex(results.indexOf(result))}
                    onClick={() => open(result)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                      selected ? "bg-primary-subtle" : "hover:bg-hover",
                    )}
                  >
                    <Icon aria-hidden className={cn("size-4 shrink-0", selected ? "text-primary-fg" : "text-fg-subtle")} strokeWidth={1.8} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium text-fg">{result.label}</span>
                      {result.detail && <span className="truncate text-xs text-fg-muted">{result.detail}</span>}
                    </span>
                    {selected && <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-primary-fg" />}
                  </div>
                );
              })}
            </div>
          ))}
          {status && (
            <p role="status" className="px-3 py-8 text-center text-[13px] text-fg-muted">
              {status}
            </p>
          )}
          {query.trim() !== "" && results.length > 0 && isLoading && (
            <p role="status" className="px-3 pb-2 pt-1 text-xs text-fg-subtle">
              Chargement des projets…
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-inset px-4 py-2 text-[11.5px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            naviguer
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Entrée</Kbd>
            ouvrir
          </span>
        </div>
      </div>
    </div>
  );
}

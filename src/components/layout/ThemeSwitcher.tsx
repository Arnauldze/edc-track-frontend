"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/useClientState";

// ══════════════════════════════════════════════════════════════
// CHOIX DU THÈME : clair, sombre ou celui du système.
// Le thème n'est connu qu'une fois dans le navigateur : avant, aucun
// segment n'est marqué, ce qui évite un écart d'hydratation.
// ══════════════════════════════════════════════════════════════

const THEMES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Thème clair", icon: Sun },
  { value: "dark", label: "Thème sombre", icon: Moon },
  { value: "system", label: "Thème du système", icon: Monitor },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div role="radiogroup" aria-label="Thème" className="flex items-center gap-0.5 rounded-md border border-line bg-inset p-0.5">
      {THEMES.map(({ value, label, icon: Icon }) => {
        const selected = hydrated && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-6.5 w-7.5 items-center justify-center rounded-sm transition-[background-color,color,box-shadow] duration-150",
              selected ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg",
            )}
          >
            <Icon aria-hidden className="size-3.75" strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}

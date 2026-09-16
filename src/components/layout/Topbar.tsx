"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertsCount } from "@/hooks/useAlerts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { Kbd } from "@/components/ui/kbd";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ALERTS_HREF, visibleSections } from "./navigation";

// ══════════════════════════════════════════════════════════════
// BARRE DU HAUT — fil d'Ariane, recherche (Ctrl K), thème, alertes.
// ══════════════════════════════════════════════════════════════

export function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAdmin } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const { data: unreadAlerts = 0 } = useAlertsCount();
  const sections = visibleSections({ isAdmin, canAccessInitialisation: !!currentUser?.canAccessInitialisation });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          "flex h-8.5 w-75 items-center gap-2 rounded-md border border-line bg-inset px-2.75 text-[12.5px] text-fg-subtle",
          "transition-colors duration-150 hover:border-line-strong hover:text-fg-muted",
        )}
      >
        <Search aria-hidden className="size-3.75 shrink-0" strokeWidth={1.8} />
        <span className="flex-1 truncate text-left">Rechercher un projet, une activité…</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      <ThemeSwitcher />

      <Link
        href={ALERTS_HREF}
        aria-label={unreadAlerts > 0 ? `Alertes, ${unreadAlerts} non lues` : "Alertes"}
        title="Alertes"
        className="relative flex size-8.5 shrink-0 items-center justify-center rounded-md border border-line text-fg-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
      >
        <Bell aria-hidden className="size-4.25" strokeWidth={1.8} />
        {unreadAlerts > 0 && <span aria-hidden className="absolute right-1.75 top-1.5 size-1.75 rounded-full bg-accent" />}
      </Link>

      {searchOpen && <CommandPalette sections={sections} onClose={() => setSearchOpen(false)} />}
    </header>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertsCount } from "@/hooks/useAlerts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { useStoredFlag } from "@/hooks/useClientState";
import { ALERTS_HREF, sectionOf, visibleSections } from "./navigation";
import { UserMenu } from "./UserMenu";

// ══════════════════════════════════════════════════════════════
// NAVIGATION LATÉRALE — bleu EDC, dépliée (240 px) ou repliée (72 px).
// Le choix est conservé d'une visite à l'autre. Quelques écrans à trois
// volets (assistant de création) la replient d'office, sans toucher au
// choix de l'utilisateur : il le retrouve en quittant l'écran.
// ══════════════════════════════════════════════════════════════

/** Écrans qui replient le menu d'office, pour laisser la place au contenu. */
const REPLI_FORCE = ["/projects/new"];

export function Sidebar() {
  const pathname = usePathname();
  const [stored, setCollapsed] = useStoredFlag("edc-sidebar-collapsed");
  const replieDOffice = REPLI_FORCE.includes(pathname);
  const collapsed = stored || replieDOffice;
  const { isAdmin } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const { data: unreadAlerts = 0 } = useAlertsCount();

  const sections = visibleSections({ isAdmin, canAccessInitialisation: !!currentUser?.canAccessInitialisation });
  const active = sectionOf(pathname);

  return (
    <aside
      aria-label="Navigation principale"
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-nav-line bg-nav transition-[width] duration-200 ease-out",
        collapsed ? "w-18" : "w-60",
      )}
    >
      <Link
        href="/dashboard"
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b border-nav-line focus-visible:outline-white/70 focus-visible:-outline-offset-4",
          collapsed ? "justify-center" : "px-4",
        )}
      >
        <Image src="/edc_logo.jpg" alt="EDC" width={32} height={32} className="size-8 rounded-sm bg-white object-cover" priority />
        {!collapsed && (
          <span className="flex flex-col leading-[1.15]">
            <span className="text-sm font-bold text-white">EDC Track</span>
            <span className="text-[10.5px] tracking-[0.4px] text-nav-muted">Pilotage des projets</span>
          </span>
        )}
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {sections.map((section) => {
          const current = section === active;
          const badge = section.href === ALERTS_HREF && unreadAlerts > 0 ? unreadAlerts : undefined;
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={current ? "page" : undefined}
              aria-label={collapsed ? (badge ? `${section.label}, ${badge} non lues` : section.label) : undefined}
              title={collapsed ? section.label : undefined}
              className={cn(
                "relative flex h-9.5 shrink-0 items-center gap-2.75 rounded-md text-[13px] transition-colors duration-150",
                "focus-visible:outline-white/70 focus-visible:-outline-offset-2",
                collapsed ? "justify-center" : "px-2.75",
                current ? "bg-nav-active font-semibold text-white" : "font-medium text-nav-fg hover:bg-nav-hover hover:text-white",
              )}
            >
              <Icon aria-hidden className={cn("size-4.5 shrink-0", current && "text-accent")} strokeWidth={1.8} />
              {!collapsed && <span className="flex-1 truncate">{section.label}</span>}
              {badge !== undefined &&
                (collapsed ? (
                  <span aria-hidden className="absolute right-3.5 top-1.5 size-2 rounded-full border-2 border-nav bg-accent" />
                ) : (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ))}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-nav-line p-3">
        <UserMenu collapsed={collapsed} />
        <button
          type="button"
          hidden={replieDOffice}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Déplier le menu" : undefined}
          title={collapsed ? "Déplier le menu" : undefined}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md text-xs text-nav-fg transition-colors duration-150 hover:bg-nav-hover hover:text-white",
            "focus-visible:outline-white/70",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          {collapsed ? <ChevronRight aria-hidden className="size-4" /> : <ChevronLeft aria-hidden className="size-4" />}
          {!collapsed && <span>Réduire le menu</span>}
        </button>
      </div>
    </aside>
  );
}

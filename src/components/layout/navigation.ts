import { Bell, CalendarDays, Eye, Folder, LayoutDashboard, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// SECTIONS DE L'APPLICATION
// Source unique pour la navigation latérale, le fil d'Ariane et la recherche.
// ══════════════════════════════════════════════════════════════

export interface NavAccess {
  isAdmin: boolean;
  /** Capacité calculée par le serveur (/auth/me) : gère, supervise ou peut créer un projet. */
  canAccessInitialisation: boolean;
}

export interface NavSection {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Section visible pour cet utilisateur. Absent : visible par tous. */
  visible?: (access: NavAccess) => boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Initialisation", href: "/projects", icon: SlidersHorizontal, visible: (a) => a.canAccessInitialisation },
  { label: "Planification", href: "/planification", icon: CalendarDays },
  { label: "Archives", href: "/archives", icon: Folder },
  { label: "Suivi", href: "/suivi", icon: Eye },
  { label: "Utilisateurs", href: "/users", icon: Users, visible: (a) => a.isAdmin },
  { label: "Alertes", href: "/alerts", icon: Bell },
];

export const ALERTS_HREF = "/alerts";

export function visibleSections(access: NavAccess) {
  return NAV_SECTIONS.filter((section) => section.visible?.(access) ?? true);
}

/** Section qui contient ce chemin (`/planification/PRJ-1` → Planification). */
export function sectionOf(pathname: string) {
  return NAV_SECTIONS.find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`));
}

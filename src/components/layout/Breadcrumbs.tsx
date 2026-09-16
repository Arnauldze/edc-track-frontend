"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useProject } from "@/hooks/useProjects";
import { findUnit } from "@/lib/structureUnits";
import { sectionOf } from "./navigation";

// ══════════════════════════════════════════════════════════════
// FIL D'ARIANE — section, puis projet et activité par leur nom.
// Tant que le projet n'est pas chargé, son code tient lieu de nom.
// ══════════════════════════════════════════════════════════════

interface Crumb {
  label: string;
  href: string;
}

/** Sections dont le deuxième segment d'URL est le code d'un projet. */
const PROJECT_SECTIONS = new Set(["/planification", "/projects", "/archives", "/suivi"]);

const FIXED_LABELS: Record<string, string> = {
  "/projects/new": "Nouveau projet",
};

const SUB_PAGES: Record<string, string> = {
  team: "Équipe",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  const fixed = FIXED_LABELS[pathname];
  const projectCode = section && PROJECT_SECTIONS.has(section.href) && !fixed && segments[1] ? segments[1].toUpperCase() : "";
  const { data: project } = useProject(projectCode);

  const crumbs: Crumb[] = [];
  if (section) crumbs.push({ label: section.label, href: section.href });
  if (fixed) crumbs.push({ label: fixed, href: pathname });

  if (section && projectCode) {
    const projectHref = `/${segments[0]}/${segments[1]}`;
    crumbs.push({ label: project?.name ?? projectCode, href: projectHref });

    const detail = segments[2];
    if (detail) {
      const label =
        SUB_PAGES[detail] ??
        (section.href === "/planification" ? findUnit(project?.components, detail)?.name : undefined);
      if (label) crumbs.push({ label, href: `${projectHref}/${segments[2]}` });
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Fil d'Ariane" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />}
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-fg">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="truncate rounded-sm text-fg-subtle transition-colors hover:text-fg">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

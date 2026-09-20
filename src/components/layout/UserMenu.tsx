"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLogout } from "@/hooks/useLogout";
import { Avatar } from "@/components/ui/avatar";

// ══════════════════════════════════════════════════════════════
// UTILISATEUR CONNECTÉ : identité en pied de navigation, menu de compte.
// ══════════════════════════════════════════════════════════════

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { data: session } = useCurrentUser();
  const { seDeconnecter, enCours: leaving } = useLogout();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      const outside = event instanceof MouseEvent && !rootRef.current?.contains(event.target as Node);
      if (outside || (event instanceof KeyboardEvent && event.key === "Escape")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!session) return null;

  const fullName = `${session.firstName} ${session.lastName}`.trim();
  const role = session.platformRole === "admin" ? "Administrateur" : session.position || "Utilisateur";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? `Compte de ${fullName}` : undefined}
        title={collapsed ? fullName : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors duration-150 hover:bg-nav-hover",
          "focus-visible:outline-white/70",
          collapsed && "justify-center",
        )}
      >
        <Avatar prenom={session.firstName} nom={session.lastName} />
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[12.5px] font-semibold text-white">{fullName}</span>
              <span className="truncate text-[11px] text-nav-muted">{role}</span>
            </span>
            <ChevronsUpDown aria-hidden className="size-3.5 text-nav-muted" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Compte"
          className={cn(
            "absolute bottom-full z-50 mb-2 w-64 animate-pop-in overflow-hidden rounded-lg border border-line bg-surface shadow-lg",
            collapsed ? "left-0" : "inset-x-0 w-auto",
          )}
        >
          <div className="flex items-center gap-3 border-b border-line px-3.5 py-3">
            <Avatar prenom={session.firstName} nom={session.lastName} size={40} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-fg">{fullName}</span>
              <span className="truncate text-xs text-fg-muted">{session.email}</span>
              <span className="truncate text-xs text-fg-subtle">{role}</span>
            </div>
          </div>
          <div className="p-1.5">
            <Link
              href="/mot-de-passe"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-inset"
            >
              <KeyRound aria-hidden className="size-4" />
              Changer mon mot de passe
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={leaving}
              onClick={seDeconnecter}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger-subtle disabled:opacity-45"
            >
              <LogOut aria-hidden className="size-4" />
              {leaving ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

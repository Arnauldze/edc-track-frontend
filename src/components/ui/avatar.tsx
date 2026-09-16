import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// AVATAR : initiales de la personne, sur l'orange EDC.
// ══════════════════════════════════════════════════════════════

export function initiales(prenom?: string, nom?: string) {
  const lettres = `${prenom?.trim()[0] ?? ""}${nom?.trim()[0] ?? ""}`.toUpperCase();
  return lettres || "?";
}

export function Avatar({ prenom, nom, size = 32, className }: { prenom?: string; nom?: string; size?: 28 | 32 | 40; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size >= 40 ? 14 : 12 }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-on-accent", className)}
    >
      {initiales(prenom, nom)}
    </span>
  );
}

import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// EMPLACEMENT DE CHARGEMENT : la forme du contenu à venir,
// à la place d'un spinner plein écran.
// ══════════════════════════════════════════════════════════════

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-skeleton rounded-md bg-[length:300%_100%]",
        "bg-[linear-gradient(90deg,var(--skeleton)_0%,var(--skeleton)_40%,var(--skeleton-shine)_50%,var(--skeleton)_60%,var(--skeleton)_100%)]",
        className,
      )}
    />
  );
}

import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// INDICATEURS DE CHARGEMENT
// Spinner : attente courte dans un bouton ou un petit bloc.
// Pour un écran ou une liste, préférer les emplacements (Skeleton).
// ══════════════════════════════════════════════════════════════

const SIZES = { sm: 14, md: 20, lg: 28 } as const;

export function Spinner({ size = "sm", className }: { size?: keyof typeof SIZES; className?: string }) {
  const px = SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("shrink-0 animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingSpinner({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center text-primary-fg", className)}>
      <Spinner size={size} />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div role="status" className="flex min-h-100 flex-col items-center justify-center gap-3 text-fg-muted">
      <Spinner size="lg" className="text-primary-fg" />
      <p className="text-[13px]">Chargement…</p>
    </div>
  );
}

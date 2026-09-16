import * as React from "react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// BADGE : état court (Planifiée, En cours, 2 problèmes…).
// ══════════════════════════════════════════════════════════════

export type BadgeTone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-inset text-fg-muted ring-1 ring-inset ring-line",
  primary: "bg-primary-subtle text-primary-fg",
  accent: "bg-accent-subtle text-accent-fg",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Pastille de couleur devant le libellé. */
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

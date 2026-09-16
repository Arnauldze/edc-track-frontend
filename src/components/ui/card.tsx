import * as React from "react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// CARTE : surface blanche bordée, en-tête optionnel.
// ══════════════════════════════════════════════════════════════

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-lg border border-line bg-surface shadow-sm", className)} {...props} />;
}

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Actions à droite (lien, bouton). */
  actions?: React.ReactNode;
}

export function CardHeader({ title, description, actions, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex min-h-13 items-center justify-between gap-4 border-b border-line px-4.5 py-3", className)} {...props}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="text-[12.5px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

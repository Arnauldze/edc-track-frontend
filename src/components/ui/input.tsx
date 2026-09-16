import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// CHAMP DE SAISIE
// Bordure marquée au repos, anneau bleu au focus, rouge en erreur.
// ══════════════════════════════════════════════════════════════

/** Classes communes aux contrôles de formulaire (input, select, textarea). */
export const controlClasses =
  "w-full rounded-md border border-line-strong bg-surface text-[13px] text-fg shadow-none " +
  "placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 " +
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus " +
  "disabled:cursor-not-allowed disabled:bg-inset disabled:text-fg-muted " +
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Met le champ en erreur (bordure rouge, aria-invalid). */
  error?: boolean;
  /** Icône décorative à gauche. */
  leftIcon?: LucideIcon;
  /** Élément à droite : bouton afficher/masquer, unité… */
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, leftIcon: LeftIcon, rightIcon, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <div className="relative flex w-full items-center">
      {LeftIcon && <LeftIcon aria-hidden className="pointer-events-none absolute left-3 size-4 text-fg-subtle" />}
      <input
        ref={ref}
        type={type}
        aria-invalid={error || ariaInvalid || undefined}
        className={cn(controlClasses, "h-9 px-3", LeftIcon && "pl-9", rightIcon && "pr-10", className)}
        {...props}
      />
      {rightIcon && <div className="absolute right-2 flex items-center">{rightIcon}</div>}
    </div>
  ),
);
Input.displayName = "Input";

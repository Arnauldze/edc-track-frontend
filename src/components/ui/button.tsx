import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./LoadingSpinner";

// ══════════════════════════════════════════════════════════════
// BOUTON
// Un seul bouton principal par écran. L'accent (orange) est réservé
// aux actions qui lancent quelque chose (planifier une phase…).
// ══════════════════════════════════════════════════════════════

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon-sm" | "icon";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border font-semibold select-none " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus " +
  "disabled:pointer-events-none [&:disabled:not([aria-busy])]:opacity-45 " +
  "[&_svg]:shrink-0 [&[aria-busy]>svg+svg]:hidden";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover",
  accent: "border-accent bg-accent text-on-accent hover:border-accent-hover hover:bg-accent-hover",
  secondary: "border-line-strong bg-surface text-fg shadow-sm hover:bg-hover",
  ghost: "border-transparent bg-transparent text-fg-muted hover:bg-hover hover:text-fg",
  danger: "border-line bg-surface text-danger shadow-sm hover:border-danger/40 hover:bg-danger-subtle",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7.5 px-2.75 text-xs [&_svg]:size-3.5",
  md: "h-9 px-3.5 text-[13px] [&_svg]:size-3.75",
  "icon-sm": "size-7.5 [&_svg]:size-3.5",
  icon: "size-9 [&_svg]:size-4",
};

/** Classes d'un bouton, pour styler un lien (`<Link className={buttonClasses(...)}>`). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Affiche un indicateur et bloque le bouton pendant une action. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, type = "button", disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

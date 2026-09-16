import * as React from "react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════
// CHAMP DE FORMULAIRE : libellé, contrôle, aide ou erreur.
// L'erreur remplace l'aide et est reliée au contrôle (aria-describedby).
// ══════════════════════════════════════════════════════════════

interface FieldProps {
  label: React.ReactNode;
  /** Identifiant du contrôle : relie le libellé et le message. */
  htmlFor: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactElement<{ "aria-describedby"?: string; error?: boolean }>;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const messageId = `${htmlFor}-message`;
  const message = error ?? hint;
  const control = message
    ? React.cloneElement(children, { "aria-describedby": messageId, ...(error ? { error: true } : {}) })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-fg-muted">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      {control}
      {message && (
        <p id={messageId} className={cn("text-[11.5px]", error ? "text-danger" : "text-fg-subtle")}>
          {message}
        </p>
      )}
    </div>
  );
}

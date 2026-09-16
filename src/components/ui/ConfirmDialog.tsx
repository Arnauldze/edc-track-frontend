"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ══════════════════════════════════════════════════════════════
// DIALOGUE DE CONFIRMATION
// Échap ou un clic à l'extérieur annulent ; le focus part sur « Annuler »
// pour qu'une validation au clavier ne confirme jamais par mégarde.
// ══════════════════════════════════════════════════════════════

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
};

const VARIANTS = {
  danger: { icon: AlertTriangle, pastille: "bg-danger-subtle text-danger", confirm: "border-danger bg-danger text-white hover:border-danger hover:bg-danger/90 dark:text-canvas" },
  warning: { icon: AlertTriangle, pastille: "bg-warning-subtle text-warning", confirm: "" },
  info: { icon: Info, pastille: "bg-primary-subtle text-primary-fg", confirm: "" },
} as const;

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const { icon: Icon, pastille, confirm } = VARIANTS[variant];

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-overlay p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="w-full max-w-md animate-pop-in rounded-lg border border-line bg-surface shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3.5 p-5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", pastille)}>
            <Icon aria-hidden className="size-4.5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
            <h2 id={titleId} className="text-[15px] font-semibold text-fg">
              {title}
            </h2>
            <p id={messageId} className="text-[13px] leading-relaxed text-fg-muted">
              {message}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Fermer" onClick={onCancel} className="-mr-1 -mt-1">
            <X />
          </Button>
        </div>
        <div className="flex justify-end gap-2 rounded-b-lg border-t border-line bg-inset px-5 py-3">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            className={confirm}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { AlertCircle, X } from "lucide-react";

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
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "bg-red-500/10 text-red-600",
      button: "bg-red-600 hover:bg-red-700",
      border: "border-red-500/20",
    },
    warning: {
      icon: "bg-amber-500/10 text-amber-600",
      button: "bg-amber-600 hover:bg-amber-700",
      border: "border-amber-500/20",
    },
    info: {
      icon: "bg-blue-500/10 text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700",
      border: "border-blue-500/20",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md p-6 border border-[var(--border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ${styles.icon} flex items-center justify-center flex-shrink-0`}>
            <AlertCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
              {title}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`px-4 py-2 ${styles.button} text-white text-xs font-semibold rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] transition-colors`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

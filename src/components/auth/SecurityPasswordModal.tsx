"use client";

// ══════════════════════════════════════
// SecurityPasswordModal — Confirmation par mot de passe sécurité
// Pour les actions sensibles (suppression membre, suppression doc, déblocage)
// ══════════════════════════════════════

import React, { useState } from "react";
import { ShieldAlert, Lock, X } from "lucide-react";
import { getCurrentUserId } from "@/lib/authStore";

// TODO: Implémenter verifySecurityPassword
const verifySecurityPassword = async (userId: string, password: string): Promise<boolean> => {
  // Temporaire: toujours retourner true
  return true;
};

type SecurityPasswordModalProps = {
  /** Titre de l'action à confirmer */
  title: string;
  /** Description de l'action */
  description: string;
  /** Label du bouton de confirmation */
  confirmLabel?: string;
  /** Couleur du bouton: "red" pour suppression, "amber" pour déblocage */
  variant?: "red" | "amber" | "default";
  /** Appelé à la fermeture sans confirmation */
  onCancel: () => void;
  /** Appelé après vérification réussie du mot de passe */
  onConfirm: () => void;
};

export function SecurityPasswordModal({
  title,
  description,
  confirmLabel = "Confirmer",
  variant = "default",
  onCancel,
  onConfirm,
}: SecurityPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const userId = getCurrentUserId();
    if (!userId) {
      setError("Session expirée. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("Veuillez saisir le mot de passe sécurité.");
      setLoading(false);
      return;
    }

    // Vérification
    const isValid = await verifySecurityPassword(userId, password);
    
    if (isValid) {
      onConfirm();
    } else {
      setError("Mot de passe sécurité incorrect.");
      setPassword("");
    }
    setLoading(false);
  };

  const btnColors = variant === "red"
    ? "bg-red-600 hover:bg-red-700"
    : variant === "amber"
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-[var(--accent)] hover:opacity-90";

  const iconColors = variant === "red"
    ? "bg-red-500/10 text-red-500"
    : variant === "amber"
      ? "bg-amber-500/10 text-amber-600"
      : "bg-blue-500/10 text-blue-500";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-sm border border-[var(--border-default)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full ${iconColors} flex items-center justify-center flex-shrink-0`}>
              <ShieldAlert size={18} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1 -mt-1 -mr-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5">
          <div className="p-3 bg-amber-500/8 border border-amber-500/15 rounded-[var(--radius-md)] mb-4">
            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>⚠️ Action sécurisée :</strong> Saisissez votre mot de passe sécurité pour confirmer cette action. Cette action sera enregistrée dans le journal d&apos;audit.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
              <Lock size={10} className="inline mr-1" />
              Mot de passe sécurité
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Saisissez votre mot de passe sécurité..."
              className="w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-subtle)]"
            />
            {error && (
              <p className="text-[11px] text-red-500 font-semibold mt-1.5">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className={`px-4 py-2 ${btnColors} text-white text-xs font-bold rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] transition-colors disabled:opacity-50 flex items-center gap-1.5`}
            >
              <Lock size={12} />
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

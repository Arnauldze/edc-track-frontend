"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, X } from "lucide-react";
import { getUserDirectory, type DirectoryUser } from "@/lib/userStore";
import { teamService, type PreviousChefOutcome } from "@/services/api/teamService";
import { getErrorMessage } from "@/services/api/client";
import { toast } from "@/lib/toastStore";

interface ChangeChefModalProps {
  isOpen: boolean;
  projectId: string;
  /** Chefs en place : normalement un seul, plusieurs sur des données anciennes. */
  currentChefs: { userId: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}

export function ChangeChefModal({ isOpen, projectId, currentChefs, onClose, onChanged }: ChangeChefModalProps) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [newChefId, setNewChefId] = useState("");
  const [previousChef, setPreviousChef] = useState<PreviousChefOutcome>("contributeur");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNewChefId("");
    setPreviousChef("contributeur");
    getUserDirectory()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [isOpen]);

  // Désigner comme seul chef quelqu'un qui l'est déjà (avec d'autres) reste utile :
  // cela régularise un projet à plusieurs chefs.
  const candidates = useMemo(
    () => users.filter((u) => !(currentChefs.length === 1 && currentChefs[0].userId === u.id)),
    [users, currentChefs],
  );

  if (!isOpen) return null;

  const others = currentChefs.filter((c) => c.userId !== newChefId);

  const handleSubmit = async () => {
    if (!newChefId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await teamService.changeChef(projectId, newChefId, previousChef);
      toast.success("Chef de projet mis à jour");
      onChanged();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--border-default)] flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Crown size={16} className="text-primary" /> Changer le chef de projet
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)]">
            <X size={18} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-[var(--text-secondary)]">
            Un projet n&apos;a qu&apos;un chef.{" "}
            {currentChefs.length === 0
              ? "Ce projet n'en a pas encore."
              : `Actuellement : ${currentChefs.map((c) => c.name).join(", ")}.`}
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Nouveau chef de projet *
            </label>
            <select
              value={newChefId}
              onChange={(e) => setNewChefId(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">— Sélectionner —</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                  {u.position ? ` — ${u.position}` : ""}
                </option>
              ))}
            </select>
          </div>

          {others.length > 0 && newChefId && (
            <fieldset>
              <legend className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                {others.length > 1 ? "Les chefs actuels" : `${others[0].name}, chef actuel`}
              </legend>
              <div className="space-y-2">
                {([
                  ["contributeur", "Reste dans l'équipe comme contributeur", "Il garde l'accès au projet et peut continuer à déposer des documents."],
                  ["retire", "Est retiré de l'équipe", "Il n'a plus accès au projet."],
                ] as const).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer ${
                      previousChef === value
                        ? "border-[var(--primary)] bg-[var(--primary-subtle)]"
                        : "border-[var(--border-default)] bg-[var(--bg-inset)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="previousChef"
                      checked={previousChef === value}
                      onChange={() => setPreviousChef(value)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
                      <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border-default)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!newChefId || isSubmitting}
            className="px-5 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Enregistrement…" : "Désigner"}
          </button>
        </div>
      </div>
    </div>
  );
}

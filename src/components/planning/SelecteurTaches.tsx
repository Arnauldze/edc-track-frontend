"use client";

// Choix des tâches qui réalisent une ligne du devis.
//
// Plusieurs, volontairement : une prestation se réalise souvent par zone ou
// par bâtiment — 96 000 m³ de remblais ne sont pas une seule tâche. Le cas
// courant reste une tâche pour une ligne, et le bouton l'affiche alors tel
// quel ; le panneau ne s'ouvre que si on le demande.

import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";

export interface TacheLiable {
  id?: string;
  numero: string;
  designation?: string;
}

interface Props {
  taches: TacheLiable[];
  /** Identifiants des tâches retenues. */
  valeur: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function SelecteurTaches({ taches, valeur, onChange, disabled }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", fermer);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", fermer);
    };
  }, [ouvert]);

  const liables = taches.filter((t) => t.id);
  const retenues = liables.filter((t) => valeur.includes(t.id!));
  const etiquette = retenues.length ? retenues.map((t) => t.numero).join(", ") : "—";

  const basculer = (id: string) =>
    onChange(valeur.includes(id) ? valeur.filter((v) => v !== id) : [...valeur, id]);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <button
        type="button"
        onClick={() => !disabled && setOuvert(!ouvert)}
        disabled={disabled}
        title={
          retenues.length
            ? retenues.map((t) => `${t.numero} — ${t.designation ?? ""}`).join("\n")
            : "Aucune tâche ne réalise cette ligne"
        }
        className={`flex w-full items-center gap-1 rounded border px-1.5 py-1 text-[11px] ${
          retenues.length ? "border-transparent text-fg hover:border-line" : "border-transparent text-fg-subtle hover:border-line"
        } ${disabled ? "cursor-default" : "cursor-pointer"}`}
      >
        <Link2 size={11} className="shrink-0 opacity-60" />
        <span className="truncate">{etiquette}</span>
      </button>

      {ouvert && (
        <div className="absolute top-full right-0 z-30 mt-1 max-h-60 w-64 overflow-y-auto rounded-md border border-line bg-surface p-1.5 shadow-lg">
          {liables.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-fg-subtle">
              Aucune tâche dans le planning. Saisissez-le d&apos;abord.
            </p>
          ) : (
            liables.map((tache) => (
              <label
                key={tache.id}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[11px] hover:bg-inset"
              >
                <input
                  type="checkbox"
                  checked={valeur.includes(tache.id!)}
                  onChange={() => basculer(tache.id!)}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="font-semibold">{tache.numero}</span>
                  {tache.designation && <span className="block truncate text-fg-muted">{tache.designation}</span>}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

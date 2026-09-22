"use client";

// Choix des tâches qui réalisent une ligne du devis.
//
// Plusieurs, volontairement : une prestation se réalise souvent par zone ou
// par bâtiment — 96 000 m³ de remblais ne sont pas une seule tâche. Le cas
// courant reste une tâche pour une ligne, et le bouton l'affiche alors tel
// quel ; le panneau ne s'ouvre que si on le demande.
//
// Le panneau est rendu dans un PORTAIL, à la racine du document. Le tableau du
// devis défile horizontalement (overflow-x), ce qui rogne tout élément
// positionné à l'intérieur — un menu déroulant y serait coupé, donc
// inutilisable. Il est donc positionné en `fixed` d'après la place du bouton.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const LARGEUR = 256;
const HAUTEUR_MAX = 240;

export function SelecteurTaches({ taches, valeur, onChange, disabled }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const panneauRef = useRef<HTMLDivElement>(null);

  /**
   * Ouvre le panneau et le place sous le bouton, ou au-dessus s'il déborde en
   * bas. La mesure se fait ici plutôt que dans un effet : le panneau naît déjà
   * à sa place, sans rendu intermédiaire hors écran.
   */
  const basculerOuverture = () => {
    if (disabled) return;
    if (ouvert) {
      setOuvert(false);
      return;
    }
    const bouton = boutonRef.current?.getBoundingClientRect();
    if (!bouton) return;
    const dessous = window.innerHeight - bouton.bottom;
    setPlace({
      top: dessous < HAUTEUR_MAX && bouton.top > dessous ? bouton.top - HAUTEUR_MAX - 4 : bouton.bottom + 4,
      // Aligné à droite du bouton, sans sortir de la fenêtre.
      left: Math.max(8, Math.min(bouton.right - LARGEUR, window.innerWidth - LARGEUR - 8)),
    });
    setOuvert(true);
  };

  useEffect(() => {
    if (!ouvert) return;

    const dehors = (e: MouseEvent) =>
      !boutonRef.current?.contains(e.target as Node) && !panneauRef.current?.contains(e.target as Node);
    const surClic = (e: MouseEvent) => { if (dehors(e)) setOuvert(false); };
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    // Le panneau est en position fixe : un défilement le détacherait du bouton.
    const surDefilement = () => setOuvert(false);

    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    window.addEventListener("scroll", surDefilement, true);
    window.addEventListener("resize", surDefilement);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("scroll", surDefilement, true);
      window.removeEventListener("resize", surDefilement);
    };
  }, [ouvert]);

  const liables = taches.filter((t) => t.id);
  const retenues = liables.filter((t) => valeur.includes(t.id!));
  const etiquette = retenues.length ? retenues.map((t) => t.numero).join(", ") : "—";

  const basculer = (id: string) =>
    onChange(valeur.includes(id) ? valeur.filter((v) => v !== id) : [...valeur, id]);

  return (
    <div className="w-full min-w-0">
      <button
        ref={boutonRef}
        type="button"
        onClick={basculerOuverture}
        disabled={disabled}
        title={
          retenues.length
            ? retenues.map((t) => `${t.numero} — ${t.designation ?? ""}`).join("\n")
            : "Aucune tâche ne réalise cette ligne"
        }
        className={`flex w-full items-center gap-1 rounded border border-transparent px-1.5 py-1 text-[11px] ${
          retenues.length ? "text-fg" : "text-fg-subtle"
        } ${disabled ? "cursor-default" : "cursor-pointer hover:border-line"}`}
      >
        <Link2 size={11} className="shrink-0 opacity-60" />
        <span className="truncate">{etiquette}</span>
      </button>

      {ouvert &&
        place &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panneauRef}
            style={{ position: "fixed", top: place.top, left: place.left, width: LARGEUR, maxHeight: HAUTEUR_MAX }}
            className="z-50 overflow-y-auto rounded-md border border-line bg-surface p-1.5 shadow-lg"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}

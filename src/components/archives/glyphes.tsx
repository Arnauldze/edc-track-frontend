"use client";

// ══════════════════════════════════════════════════════════════
// ARCHIVES — glyphes et pastilles
// Dossier et fichier sont dessinés « à la Windows » : un dossier à onglet,
// une feuille à coin plié dont le bandeau porte l'extension.
// ══════════════════════════════════════════════════════════════

import { Clock } from "lucide-react";
import { extensionDe, typeFichier, STATUTS } from "@/lib/archiveExplorer";

export function GlypheDossier({ taille = 18 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" className="flex-shrink-0" aria-hidden>
      <path d="M2.5 6.5a2 2 0 0 1 2-2h4.2l2 2H19.5a2 2 0 0 1 2 2v1H2.5z" fill="var(--accent-hover)" />
      <path d="M2.5 9h19v9.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="var(--accent)" />
    </svg>
  );
}

export function GlypheFichier({ nom, taille = 18 }: { nom: string; taille?: number }) {
  const couleur = typeFichier(nom).couleur;
  const ext = (extensionDe(nom) || "?").toUpperCase();

  if (taille <= 20) {
    return (
      <svg width={taille} height={taille} viewBox="0 0 24 24" className="flex-shrink-0" aria-hidden>
        <path d="M6 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5z" fill="var(--bg-surface)" stroke="var(--border-strong)" strokeWidth="1.2" />
        <path d="M14 2.5V7h4.5" fill="none" stroke="var(--border-strong)" strokeWidth="1.2" />
        <rect x="3" y="12.5" width="13" height="6" rx="1" fill={couleur} />
      </svg>
    );
  }

  return (
    <div className="relative flex-shrink-0" style={{ width: taille, height: Math.round(taille * 1.25) }} aria-hidden>
      <svg width={taille} height={Math.round(taille * 1.25)} viewBox="0 0 40 50">
        <path d="M6 1h20l13 13v32a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" fill="var(--bg-surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
        <path d="M26 1v13h13" fill="var(--bg-inset)" stroke="var(--border-strong)" strokeWidth="1.5" />
      </svg>
      <span
        className="absolute left-[-4px] font-mono font-semibold tracking-wide rounded-[3px] px-1 text-white"
        style={{ bottom: Math.round(taille * 0.22), background: couleur, fontSize: taille >= 40 ? 10 : 8.5 }}
      >
        {ext}
      </span>
    </div>
  );
}

export function StatutBadge({ statut }: { statut: string }) {
  const info = STATUTS[statut] ?? STATUTS.encours;
  if (statut === "manquant") {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full border border-dashed border-line-strong text-[11.5px] font-semibold text-fg-muted whitespace-nowrap">
        <Clock size={12} /> {info.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center h-[22px] px-2.5 rounded-full border text-[11.5px] font-semibold whitespace-nowrap ${info.classe}`}>
      {info.label}
    </span>
  );
}

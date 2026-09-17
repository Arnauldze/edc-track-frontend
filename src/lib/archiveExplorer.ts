// ══════════════════════════════════════════════════════════════
// ARCHIVES — arbre de navigation et mise en forme
//
// L'explorateur affiche toute la GED d'un projet en un seul arbre :
//   projet › composante › sous-composante › activité › phase › dossier
// Les documents sont rattachés à un emplacement (`context`, des
// identifiants séparés par « / », ou « global »), une phase et un dossier.
// Tout se calcule ici à partir des trois sources : la structure du projet,
// les dossiers enregistrés et les documents.
// ══════════════════════════════════════════════════════════════

import type { Component } from "@/services/api/projectService";
import type { Folder } from "@/services/api/folderService";
import type { DocumentMetadata } from "@/services/api/documentService";

export type Phase = "etude" | "passation" | "execution";

export const PHASES: { id: Phase; label: string }[] = [
  { id: "etude", label: "Étude" },
  { id: "passation", label: "Passation" },
  { id: "execution", label: "Exécution" },
];

export const GLOBAL = "global";

export type NoeudKind = "projet" | "composante" | "sous-composante" | "activite" | "phase" | "dossier";

export interface Noeud {
  /** Chemin unique dans l'arbre, utilisé comme clé et comme sélection. */
  id: string;
  kind: NoeudKind;
  label: string;
  context: string;
  phase?: Phase;
  /** Nom du dossier, pour un nœud « dossier ». */
  folder?: string;
  /** Identifiant du dossier enregistré ; absent s'il n'est que déduit des documents. */
  folderId?: string;
  enfants: Noeud[];
  /** Documents (dernière version) de ce nœud et de ses descendants. */
  total: number;
  aValider: number;
  attendus: number;
  /** Dépôt le plus récent, en ISO. */
  modifie?: string;
}

// ── Documents ──────────────────────────────────────────────────

const lignee = (doc: DocumentMetadata) => `${doc.context || GLOBAL}|${doc.phase}|${doc.folderName}|${doc.fileName}`;

/** Ne garde que la dernière version de chaque document. */
export function dernieresVersions(documents: DocumentMetadata[]): DocumentMetadata[] {
  const parLignee = new Map<string, DocumentMetadata>();
  for (const doc of documents) {
    const precedent = parLignee.get(lignee(doc));
    if (!precedent || doc.version > precedent.version) parLignee.set(lignee(doc), doc);
  }
  return [...parLignee.values()];
}

/** Toutes les versions d'un document, de la plus récente à la plus ancienne. */
export function versionsDe(documents: DocumentMetadata[], doc: DocumentMetadata): DocumentMetadata[] {
  return documents.filter((d) => lignee(d) === lignee(doc)).sort((a, b) => b.version - a.version);
}

const dansContexte = (docContext: string, context: string) =>
  context === GLOBAL ? true : docContext === context || docContext.startsWith(`${context}/`);

// ── Arbre ──────────────────────────────────────────────────────

interface Compteurs {
  total: number;
  aValider: number;
  attendus: number;
  modifie?: string;
}

function compter(documents: DocumentMetadata[]): Compteurs {
  let aValider = 0;
  let attendus = 0;
  let modifie: string | undefined;
  for (const doc of documents) {
    if (doc.status === "encours") aValider += 1;
    if (doc.status === "manquant") attendus += 1;
    if (!modifie || doc.updatedAt > modifie) modifie = doc.updatedAt;
  }
  return { total: documents.length, aValider, attendus, modifie };
}

function noeudDossier(context: string, phase: Phase, nom: string, folderId: string | undefined, documents: DocumentMetadata[]): Noeud {
  const siens = documents.filter((d) => (d.context || GLOBAL) === context && d.phase === phase && d.folderName === nom);
  return { id: `${context}::${phase}::${nom}`, kind: "dossier", label: nom, context, phase, folder: nom, folderId, enfants: [], ...compter(siens) };
}

function noeudsPhases(context: string, dossiers: Folder[], documents: DocumentMetadata[]): Noeud[] {
  return PHASES.map(({ id: phase, label }) => {
    const ici = documents.filter((d) => (d.context || GLOBAL) === context && d.phase === phase);
    const noms = new Map<string, string | undefined>();
    for (const dossier of dossiers) {
      if (dossier.context === context && dossier.phase === phase) noms.set(dossier.name, dossier._id);
    }
    for (const doc of ici) if (!noms.has(doc.folderName)) noms.set(doc.folderName, undefined);

    const enfants = [...noms.entries()]
      .map(([nom, id]) => noeudDossier(context, phase, nom, id, documents))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));

    return { id: `${context}::${phase}`, kind: "phase" as const, label, context, phase, enfants, ...compter(ici) };
  });
}

/**
 * Arbre complet du projet. Un emplacement (projet, composante…) porte ses
 * trois phases, chaque phase ses dossiers.
 */
export function construireArbre(
  projet: { code: string; name: string; components?: Component[] },
  dossiers: Folder[],
  documents: DocumentMetadata[],
): Noeud {
  const emplacement = (kind: NoeudKind, label: string, context: string, enfantsStructure: Noeud[]): Noeud => {
    const siens = documents.filter((d) => dansContexte(d.context || GLOBAL, context));
    const propres = documents.filter((d) => (d.context || GLOBAL) === context);
    return {
      id: context,
      kind,
      label,
      context,
      enfants: [...noeudsPhases(context, dossiers, documents), ...enfantsStructure],
      ...compter(context === GLOBAL ? propres : siens),
      // Le total d'un emplacement inclut ses descendants ; ses phases n'en montrent que la part directe.
      total: context === GLOBAL ? documents.length : siens.length,
      aValider: (context === GLOBAL ? documents : siens).filter((d) => d.status === "encours").length,
      attendus: (context === GLOBAL ? documents : siens).filter((d) => d.status === "manquant").length,
    };
  };

  const composantes = (projet.components ?? []).map((composante) => {
    const sousComposantes = (composante.sousComposants ?? []).map((sc) => {
      const activites = (sc.activities ?? []).map((a) =>
        emplacement("activite", a.name || "Activité sans nom", `${composante.id}/${sc.id}/${a.id}`, []),
      );
      return emplacement("sous-composante", sc.name || "Sous-composante sans nom", `${composante.id}/${sc.id}`, activites);
    });
    return emplacement("composante", composante.name || "Composante sans nom", composante.id, sousComposantes);
  });

  return emplacement("projet", projet.name, GLOBAL, composantes);
}

export function trouverNoeud(racine: Noeud, id: string): Noeud | null {
  if (racine.id === id) return racine;
  for (const enfant of racine.enfants) {
    const trouve = trouverNoeud(enfant, id);
    if (trouve) return trouve;
  }
  return null;
}

/** Chemin de la racine jusqu'au nœud, inclus : le fil d'Ariane. */
export function cheminVers(racine: Noeud, id: string): Noeud[] {
  if (racine.id === id) return [racine];
  for (const enfant of racine.enfants) {
    const chemin = cheminVers(enfant, id);
    if (chemin.length > 0) return [racine, ...chemin];
  }
  return [];
}

/** Documents affichés dans un nœud : ceux de son dossier, ou aucun ailleurs. */
export function documentsDe(noeud: Noeud, documents: DocumentMetadata[]): DocumentMetadata[] {
  if (noeud.kind !== "dossier") return [];
  return documents.filter(
    (d) => (d.context || GLOBAL) === noeud.context && d.phase === noeud.phase && d.folderName === noeud.folder,
  );
}

// ── Mise en forme ──────────────────────────────────────────────

export interface TypeFichier {
  libelle: string;
  /** Couleur du bandeau du glyphe et de la pastille. */
  couleur: string;
}

const TYPES: Record<string, TypeFichier> = {
  pdf: { libelle: "Document PDF", couleur: "var(--danger)" },
  doc: { libelle: "Document Word", couleur: "var(--primary-text)" },
  docx: { libelle: "Document Word", couleur: "var(--primary-text)" },
  xls: { libelle: "Feuille Excel", couleur: "var(--success)" },
  xlsx: { libelle: "Feuille Excel", couleur: "var(--success)" },
  dwg: { libelle: "Plan AutoCAD", couleur: "var(--type-etudes)" },
  zip: { libelle: "Archive ZIP", couleur: "var(--text-secondary)" },
  png: { libelle: "Image PNG", couleur: "var(--accent)" },
  jpg: { libelle: "Image JPEG", couleur: "var(--accent)" },
  jpeg: { libelle: "Image JPEG", couleur: "var(--accent)" },
};

export const extensionDe = (nomFichier: string) =>
  nomFichier.includes(".") ? nomFichier.split(".").pop()!.toLowerCase() : "";

export const typeFichier = (nomFichier: string): TypeFichier =>
  TYPES[extensionDe(nomFichier)] ?? { libelle: "Fichier", couleur: "var(--text-tertiary)" };

export const estImage = (nomFichier: string) => ["png", "jpg", "jpeg"].includes(extensionDe(nomFichier));

/** Le serveur enregistre la taille en texte (« 2.40 MB ») : on la relit en octets. */
export function tailleEnOctets(fileSize?: string): number {
  if (!fileSize) return 0;
  const m = /^([\d.,]+)\s*([KMGT]?)B?$/i.exec(fileSize.trim());
  if (!m) return 0;
  const valeur = parseFloat(m[1].replace(",", "."));
  if (isNaN(valeur)) return 0;
  const facteur = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }[m[2].toUpperCase()] ?? 1;
  return valeur * facteur;
}

export function formaterTaille(octets: number): string {
  if (!octets) return "—";
  const unites: [number, string][] = [[1024 ** 3, "Go"], [1024 ** 2, "Mo"], [1024, "Ko"]];
  for (const [seuil, unite] of unites) {
    if (octets >= seuil) {
      const valeur = octets / seuil;
      return `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: valeur < 10 ? 1 : 0 })} ${unite}`;
    }
  }
  return `${Math.round(octets)} o`;
}

export const tailleDocument = (doc: DocumentMetadata) => formaterTaille(tailleEnOctets(doc.fileSize));

export function formaterDateHeure(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const deuxChiffres = (n: number) => String(n).padStart(2, "0");
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

/** « Depuis 3 jours », pour l'attente de validation. */
export function depuis(iso?: string): string {
  if (!iso) return "";
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (jours <= 0) return "Depuis aujourd'hui";
  if (jours === 1) return "Depuis hier";
  return `Depuis ${jours} jours`;
}

export const STATUTS: Record<string, { label: string; classe: string }> = {
  valide: { label: "Validé", classe: "bg-success-subtle text-success border-success/20" },
  encours: { label: "À valider", classe: "bg-warning-subtle text-warning border-warning/20" },
  rejete: { label: "Rejeté", classe: "bg-danger-subtle text-danger border-danger/20" },
  manquant: { label: "Attendu", classe: "border-dashed border-line-strong text-fg-muted" },
};

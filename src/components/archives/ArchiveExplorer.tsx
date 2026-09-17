"use client";

// ══════════════════════════════════════════════════════════════
// ARCHIVES — explorateur de la GED d'un projet
//
// Un seul écran, à la manière de l'explorateur Windows : l'arbre du projet
// à gauche, le contenu du dossier au centre, le document sélectionné et son
// circuit de validation à droite. La navigation suit l'arbre
// (emplacement › phase › dossier) ; le double-clic ouvre, le clic droit
// donne les actions.
//
// Renommer et Déplacer restent visibles mais inactifs : le serveur ne sait
// pas encore le faire (pas d'endpoint). Les sous-dossiers non plus.
// ══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  FolderPlus,
  Hammer,
  History,
  LayoutGrid,
  List,
  Lock,
  Move,
  PanelRight,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ArrowDownUp,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/lib/rbacStore";
import { getUserDirectory } from "@/lib/userStore";
import { getErrorMessage } from "@/services/api/client";
import {
  approveDocument,
  deleteDocument,
  downloadDocument,
  getDocumentObjectUrl,
  getDocuments,
  rejectDocument,
  reopenDocument,
  restoreDocument,
  trashDocument,
  uploadDocument,
  type DocumentMetadata,
} from "@/services/api/documentService";
import { createFolder, deleteFolder, listFolders, type Folder } from "@/services/api/folderService";
import { ACCEPT_ATTRIBUTE, isAcceptedFile } from "@/lib/documentTypes";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlypheDossier, GlypheFichier, StatutBadge } from "@/components/archives/glyphes";
import {
  GLOBAL,
  cheminVers,
  construireArbre,
  depuis,
  dernieresVersions,
  documentsDe,
  estImage,
  formaterDateHeure,
  formaterTaille,
  tailleDocument,
  tailleEnOctets,
  trouverNoeud,
  typeFichier,
  versionsDe,
  type Noeud,
} from "@/lib/archiveExplorer";
import type { Component } from "@/services/api/projectService";

export interface ProjetArchive {
  code: string;
  name: string;
  components?: Component[];
}

type Ligne = { kind: "noeud"; noeud: Noeud } | { kind: "doc"; doc: DocumentMetadata };

type Modale =
  | { type: "rejet"; doc: DocumentMetadata }
  | { type: "corbeille"; doc: DocumentMetadata }
  | { type: "dossier" }
  | { type: "apercu"; doc: DocumentMetadata }
  | { type: "versions"; doc: DocumentMetadata }
  | { type: "listeCorbeille" }
  | null;

const ICONES_PHASE = { etude: FileText, passation: Briefcase, execution: Hammer } as const;

const BIENTOT = "Bientôt : le serveur ne sait pas encore faire cette opération";

const outil =
  "h-[30px] px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[12.5px] font-medium text-fg hover:bg-hover disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap";

const colonnes = "grid grid-cols-[34px_minmax(0,1fr)_120px_150px_112px_80px] items-center";

export function ArchiveExplorer({ projet }: { projet: ProjetArchive }) {
  const { can, canUploadIn, isAdmin } = usePermissions(projet.code);

  // ── Données ──
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [corbeille, setCorbeille] = useState<DocumentMetadata[]>([]);
  const [dossiers, setDossiers] = useState<Folder[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [auteurs, setAuteurs] = useState<Map<string, string>>(new Map());

  const charger = useCallback(async () => {
    try {
      const [actifs, supprimes, fols] = await Promise.all([
        getDocuments({ projectId: projet.code, isTrashed: false }),
        getDocuments({ projectId: projet.code, isTrashed: true }),
        listFolders(projet.code),
      ]);
      setDocuments(actifs);
      setCorbeille(supprimes);
      setDossiers(fols);
      setErreur(null);
    } catch (e) {
      setErreur(getErrorMessage(e));
    } finally {
      setChargement(false);
    }
  }, [projet.code]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    getUserDirectory()
      .then((users) => setAuteurs(new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]))))
      .catch(() => setAuteurs(new Map()));
  }, []);

  const nomAuteur = (id?: string) => (id ? auteurs.get(id) ?? "Utilisateur inconnu" : "—");

  // ── Arbre ──
  const recents = useMemo(() => dernieresVersions(documents), [documents]);
  const arbre = useMemo(() => construireArbre(projet, dossiers, recents), [projet, dossiers, recents]);

  // ── Navigation ──
  const [histoire, setHistoire] = useState<string[]>([GLOBAL]);
  const [position, setPosition] = useState(0);
  const courantId = histoire[position];
  const courant = useMemo(() => trouverNoeud(arbre, courantId) ?? arbre, [arbre, courantId]);
  const chemin = useMemo(() => cheminVers(arbre, courant.id), [arbre, courant.id]);

  const [deplies, setDeplies] = useState<Set<string>>(new Set([GLOBAL]));
  const [selection, setSelection] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [vue, setVue] = useState<"details" | "icones">("details");
  const [voletOuvert, setVoletOuvert] = useState(true);
  const [tri, setTri] = useState<{ champ: "nom" | "modifie" | "taille"; sens: 1 | -1 }>({ champ: "nom", sens: 1 });
  const [menuTri, setMenuTri] = useState(false);
  const [menuNouveau, setMenuNouveau] = useState(false);
  const [menuContextuel, setMenuContextuel] = useState<{ x: number; y: number; doc: DocumentMetadata } | null>(null);
  const [modale, setModale] = useState<Modale>(null);
  const [motif, setMotif] = useState("");
  const [nouveauDossier, setNouveauDossier] = useState("");
  const [survolDepot, setSurvolDepot] = useState(false);
  const [confirmation, setConfirmation] = useState<{ titre: string; message: string; appliquer: () => void } | null>(null);

  const naviguer = (id: string) => {
    setSelection([]);
    setRecherche("");
    setHistoire((h) => [...h.slice(0, position + 1), id]);
    setPosition((p) => p + 1);
    setDeplies((d) => new Set([...d, ...cheminVers(arbre, id).map((n) => n.id)]));
  };

  const basculer = (id: string) =>
    setDeplies((d) => {
      const suivant = new Set(d);
      if (!suivant.delete(id)) suivant.add(id);
      return suivant;
    });

  // ── Contenu affiché ──
  const docsDuDossier = useMemo(() => documentsDe(courant, recents), [courant, recents]);

  const lignes: Ligne[] = useMemo(() => {
    const filtre = recherche.trim().toLowerCase();
    const noeuds: Ligne[] = courant.enfants
      .filter((n) => !filtre || n.label.toLowerCase().includes(filtre))
      .map((noeud) => ({ kind: "noeud" as const, noeud }));
    const docs: Ligne[] = docsDuDossier
      .filter((d) => !filtre || d.fileName.toLowerCase().includes(filtre))
      .map((doc) => ({ kind: "doc" as const, doc }));

    const nom = (l: Ligne) => (l.kind === "noeud" ? l.noeud.label : l.doc.fileName);
    const date = (l: Ligne) => (l.kind === "noeud" ? l.noeud.modifie ?? "" : l.doc.updatedAt);
    const taille = (l: Ligne) => (l.kind === "noeud" ? 0 : tailleEnOctets(l.doc.fileSize));
    const comparer = (a: Ligne, b: Ligne) => {
      if (tri.champ === "modifie") return date(a).localeCompare(date(b)) * tri.sens;
      if (tri.champ === "taille") return (taille(a) - taille(b)) * tri.sens;
      return nom(a).localeCompare(nom(b), "fr") * tri.sens;
    };
    // Les phases gardent leur ordre métier ; le reste se trie.
    const noeudsTries = courant.kind === "dossier" || courant.enfants.some((n) => n.kind === "phase") ? noeuds : [...noeuds].sort(comparer);
    return [...noeudsTries, ...docs.sort(comparer)];
  }, [courant, docsDuDossier, recherche, tri]);

  const docSelectionne = selection.length === 1 ? recents.find((d) => d._id === selection[0]) ?? null : null;
  const docsSelectionnes = recents.filter((d) => selection.includes(d._id));
  const tailleSelection = docsSelectionnes.reduce((n, d) => n + tailleEnOctets(d.fileSize), 0);

  // ── Chiffres d'en-tête ──
  const totalOctets = recents.reduce((n, d) => n + tailleEnOctets(d.fileSize), 0);
  const aValider = recents.filter((d) => d.status === "encours").length;
  const attendus = recents.filter((d) => d.status === "manquant").length;

  // ── Actions ──
  const entree = useRef<HTMLInputElement>(null);
  const [cibleVersion, setCibleVersion] = useState<DocumentMetadata | null>(null);

  const peutDeposer = courant.kind === "dossier" && canUploadIn(courant.context);

  const executer = async (action: () => Promise<unknown>, succes: string) => {
    try {
      await action();
      toast.success(succes);
      await charger();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const deposer = async (fichiers: FileList | File[]) => {
    if (!peutDeposer || !courant.phase || !courant.folder) return;
    const liste = [...fichiers];
    // Une nouvelle version est reconnue au nom du fichier : le serveur incrémente alors la version.
    if (cibleVersion && liste.length === 1 && liste[0].name !== cibleVersion.fileName) {
      toast.error(`Pour une nouvelle version, le fichier doit s'appeler « ${cibleVersion.fileName} ». Il sera enregistré comme un nouveau document.`);
    }
    const refuses = liste.filter((f) => !isAcceptedFile(f.name));
    const acceptes = liste.filter((f) => isAcceptedFile(f.name));
    if (refuses.length > 0) toast.error(`Format non accepté : ${refuses.map((f) => f.name).join(", ")}`);
    if (acceptes.length === 0) return;
    await executer(
      () =>
        Promise.all(
          acceptes.map((file) =>
            uploadDocument({ projectId: projet.code, phase: courant.phase!, folderName: courant.folder!, context: courant.context, file }),
          ),
        ),
      acceptes.length > 1 ? `${acceptes.length} documents déposés` : "Document déposé",
    );
  };

  const creerDossier = async () => {
    const nom = nouveauDossier.trim();
    if (!nom || !courant.phase) return;
    setModale(null);
    setNouveauDossier("");
    await executer(
      () => createFolder({ projectId: projet.code, phase: courant.phase!, context: courant.context, name: nom }),
      `Dossier « ${nom} » créé`,
    );
  };

  const supprimerDossier = (noeud: Noeud) => {
    if (!noeud.folderId) {
      toast.error("Ce dossier n'existe que par ses documents : videz-le pour le faire disparaître");
      return;
    }
    setConfirmation({
      titre: "Supprimer le dossier",
      message: `Supprimer « ${noeud.label} » ? Il doit être vide.`,
      appliquer: () => executer(() => deleteFolder(noeud.folderId!), "Dossier supprimé"),
    });
  };

  const valider = (doc: DocumentMetadata) => executer(() => approveDocument(doc._id), "Document validé");
  const rouvrir = (doc: DocumentMetadata) => executer(() => reopenDocument(doc._id), "Document remis en revue");
  const telecharger = (doc: DocumentMetadata) =>
    downloadDocument(doc._id, doc.fileName).catch((e) => toast.error(getErrorMessage(e)));

  const confirmerRejet = async () => {
    if (modale?.type !== "rejet" || !motif.trim()) return;
    const doc = modale.doc;
    const raison = motif.trim();
    setModale(null);
    setMotif("");
    await executer(() => rejectDocument(doc._id, raison), "Document rejeté");
  };

  const confirmerCorbeille = async () => {
    if (modale?.type !== "corbeille" || !motif.trim()) return;
    const doc = modale.doc;
    const raison = motif.trim();
    setModale(null);
    setMotif("");
    setSelection([]);
    await executer(() => trashDocument(doc._id, raison), "Document mis à la corbeille");
  };

  // ── Raccourcis clavier ──
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName) || modale) return;
      if (!docSelectionne) return;
      if (e.key === " ") {
        e.preventDefault();
        setModale({ type: "apercu", doc: docSelectionne });
      } else if (e.key === "Delete" && can("doc:delete")) {
        e.preventDefault();
        setModale({ type: "corbeille", doc: docSelectionne });
      } else if (e.key === "F2") {
        e.preventDefault();
        toast.error(BIENTOT);
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [docSelectionne, modale, can]);

  // ── Arbre : rendu récursif ──
  const rendreNoeud = (noeud: Noeud, niveau: number): React.ReactNode => {
    const ouvert = deplies.has(noeud.id);
    const actif = noeud.id === courant.id;
    const Icone = noeud.kind === "phase" ? ICONES_PHASE[noeud.phase!] : null;
    return (
      <div key={noeud.id}>
        <div
          role="treeitem"
          aria-expanded={noeud.enfants.length > 0 ? ouvert : undefined}
          aria-selected={actif}
          onClick={() => naviguer(noeud.id)}
          className={`h-7 flex items-center gap-1.5 pr-2 rounded-[var(--radius-sm)] cursor-pointer text-[12.5px] ${
            actif ? "bg-primary-subtle font-semibold text-primary-fg" : noeud.kind === "phase" ? "text-fg-muted hover:bg-hover" : "text-fg hover:bg-hover"
          }`}
          style={{ paddingLeft: 8 + niveau * 14 }}
        >
          {noeud.enfants.length > 0 ? (
            <button
              type="button"
              aria-label={ouvert ? "Replier" : "Déplier"}
              onClick={(e) => { e.stopPropagation(); basculer(noeud.id); }}
              className="w-3 flex-shrink-0 text-fg-subtle"
            >
              {ouvert ? <ChevronDown size={12} strokeWidth={2.5} /> : <ChevronRight size={12} strokeWidth={2.5} />}
            </button>
          ) : (
            <span className="w-3 flex-shrink-0" />
          )}
          {noeud.kind === "projet" ? (
            <Briefcase size={15} className="flex-shrink-0 text-primary-fg" />
          ) : Icone ? (
            <Icone size={15} className="flex-shrink-0 text-fg-muted" />
          ) : noeud.kind === "dossier" ? (
            <GlypheDossier taille={16} />
          ) : (
            <FolderOpen size={15} className="flex-shrink-0 text-fg-muted" />
          )}
          <span className="flex-1 truncate">{noeud.label}</span>
          {noeud.aValider > 0 && <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" title={`${noeud.aValider} à valider`} />}
          {noeud.total > 0 && <span className="font-mono text-[10.5px] text-fg-subtle">{noeud.total}</span>}
        </div>
        {ouvert && noeud.enfants.map((enfant) => rendreNoeud(enfant, niveau + 1))}
      </div>
    );
  };

  // ── Volet de détails ──
  const rendreVolet = () => {
    if (!docSelectionne) {
      return (
        <div className="w-[300px] flex-shrink-0 border-l border-line bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Emplacement</p>
          <p className="mt-2 text-[13px] font-semibold text-fg">{courant.label}</p>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            {courant.total} document{courant.total > 1 ? "s" : ""}
            {courant.aValider > 0 ? ` · ${courant.aValider} à valider` : ""}
          </p>
          <p className="mt-4 text-[12.5px] text-fg-subtle">Sélectionnez un document pour voir son aperçu et son circuit de validation.</p>
        </div>
      );
    }

    const doc = docSelectionne;
    const versions = versionsDe(documents, doc);
    const emplacement = cheminVers(arbre, courant.id).slice(1).map((n) => n.label).join(" › ");
    const valide = doc.status === "valide";
    const rejete = doc.status === "rejete";

    return (
      <div className="w-[300px] flex-shrink-0 border-l border-line bg-surface flex flex-col min-h-0">
        <div className="p-4 flex flex-col gap-3 border-b border-line">
          <Apercu doc={doc} />
          <div className="flex items-start gap-2.5">
            <GlypheFichier nom={doc.fileName} taille={20} />
            <div className="min-w-0 flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold leading-snug break-words">{doc.fileName}</span>
              <StatutBadge statut={doc.status} />
            </div>
          </div>
        </div>

        <dl className="p-4 flex flex-col gap-1.5 border-b border-line text-[12px]">
          <Info label="Type" valeur={`${typeFichier(doc.fileName).libelle} · ${tailleDocument(doc)}`} />
          <Info label="Déposé par" valeur={nomAuteur(doc.uploadedBy)} />
          <Info label="Déposé le" valeur={formaterDateHeure(doc.createdAt)} />
          <Info label="Version" valeur={versions.length > 1 ? `${doc.version} (${versions.length - 1} antérieure${versions.length > 2 ? "s" : ""})` : `${doc.version} (aucune antérieure)`} />
          <Info label="Emplacement" valeur={emplacement || "Projet"} />
        </dl>

        <div className="p-4 flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Circuit de validation</span>
          <Etape couleur="success" titre="Déposé" detail={`${nomAuteur(doc.uploadedBy)} · ${formaterDateHeure(doc.createdAt)}`} fait />
          {valide ? (
            <Etape couleur="success" titre="Validé" detail={`${nomAuteur(doc.tracking?.approvedBy)} · ${formaterDateHeure(doc.tracking?.approvedAt)}`} fait dernier />
          ) : rejete ? (
            <Etape couleur="danger" titre="Rejeté" detail={`${doc.tracking?.rejectionReason ?? "Sans motif"} — ${nomAuteur(doc.tracking?.rejectedBy)}`} dernier />
          ) : (
            <Etape couleur="warning" titre="En attente du chef de projet" detail={depuis(doc.createdAt)} dernier />
          )}
        </div>

        {(can("doc:validate") || can("doc:reject") || can("doc:unlock")) && (
          <div className="p-3 flex gap-2 border-t border-line">
            {doc.status === "encours" ? (
              <>
                {can("doc:reject") && (
                  <button type="button" onClick={() => { setMotif(""); setModale({ type: "rejet", doc }); }} className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-danger/30 text-[13px] font-semibold text-danger hover:bg-danger-subtle transition-colors">
                    <X size={15} /> Rejeter
                  </button>
                )}
                {can("doc:validate") && (
                  <button type="button" onClick={() => valider(doc)} className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-hover transition-colors">
                    <Check size={15} /> Valider
                  </button>
                )}
              </>
            ) : (
              can("doc:unlock") && (
                <button type="button" onClick={() => rouvrir(doc)} className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-line text-[13px] font-semibold text-fg hover:bg-hover transition-colors">
                  <RotateCcw size={15} /> Remettre en revue
                </button>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Rendu ──
  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas" onClick={() => { setMenuContextuel(null); setMenuNouveau(false); setMenuTri(false); }}>
      {/* En-tête du projet */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3.5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 flex-shrink-0 rounded-[var(--radius-md)] bg-primary-subtle flex items-center justify-center">
            <FolderOpen size={20} className="text-primary-fg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[20px] font-bold tracking-tight text-fg truncate">{projet.name}</h1>
              <span className="font-mono text-[11px] px-1.5 py-px rounded-[var(--radius-sm)] border border-line bg-inset text-fg-muted">{projet.code}</span>
            </div>
            <p className="text-[12.5px] text-fg-muted">
              {recents.length} document{recents.length > 1 ? "s" : ""}
              {aValider > 0 && <> · <span className="font-semibold text-warning">{aValider} à valider</span></>}
              {attendus > 0 && <> · {attendus} attendu{attendus > 1 ? "s" : ""}</>}
              {" · "}{formaterTaille(totalOctets)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setModale({ type: "listeCorbeille" })} className="h-9 px-3.5 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface text-[13px] font-medium text-fg hover:bg-hover transition-colors">
            <Trash2 size={15} /> Corbeille · {corbeille.length}
          </button>
          <a href={`/projects/${projet.code}`} className="h-9 px-3.5 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface text-[13px] font-medium text-fg hover:bg-hover transition-colors">
            <Users size={15} /> Équipe projet
          </a>
        </div>
      </div>

      {/* Explorateur */}
      <div className="flex-1 min-h-0 px-6 pt-4 pb-5">
        <div className="relative h-full flex flex-col min-w-0 rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Barre d'adresse */}
          <div className="h-12 flex-shrink-0 flex items-center gap-1.5 px-2.5 border-b border-line">
            <BoutonNav libelle="Précédent" onClick={() => { setPosition((p) => Math.max(0, p - 1)); setSelection([]); }} desactive={position === 0}><ArrowLeft size={16} /></BoutonNav>
            <BoutonNav libelle="Suivant" onClick={() => { setPosition((p) => Math.min(histoire.length - 1, p + 1)); setSelection([]); }} desactive={position >= histoire.length - 1}><ArrowRight size={16} /></BoutonNav>
            <BoutonNav libelle="Dossier parent" onClick={() => { const parent = chemin[chemin.length - 2]; if (parent) naviguer(parent.id); }} desactive={chemin.length < 2}><ArrowUp size={16} /></BoutonNav>
            <BoutonNav libelle="Actualiser" onClick={() => charger()}><RefreshCw size={16} /></BoutonNav>

            <div className="flex-1 min-w-0 h-8 ml-1 flex items-center gap-0.5 overflow-hidden rounded-[var(--radius-md)] border border-line bg-inset px-2 text-[12.5px]">
              <GlypheDossier taille={16} />
              <span className="w-1" />
              {chemin.map((noeud, i) => (
                <span key={noeud.id} className="flex items-center min-w-0">
                  <button
                    type="button"
                    onClick={() => naviguer(noeud.id)}
                    className={`px-1.5 py-0.5 rounded-[var(--radius-sm)] truncate hover:bg-hover ${i === chemin.length - 1 ? "font-semibold text-fg" : "text-fg-muted"}`}
                  >
                    {noeud.label}
                  </button>
                  {i < chemin.length - 1 && <ChevronRight size={12} className="flex-shrink-0 text-fg-subtle" />}
                </span>
              ))}
            </div>

            <label className="w-[240px] h-8 flex items-center gap-2 px-2.5 rounded-[var(--radius-md)] border border-line text-[12.5px] focus-within:border-primary transition-colors">
              <Search size={15} className="flex-shrink-0 text-fg-subtle" />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher dans ce dossier"
                className="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-subtle focus:outline-none"
              />
            </label>
          </div>

          {/* Commandes */}
          <div className="min-h-[44px] flex-shrink-0 flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-b border-line">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuNouveau((v) => !v); }}
                disabled={!canUploadIn(courant.context) || courant.kind === "projet" || courant.kind === "composante" || courant.kind === "sous-composante" || courant.kind === "activite"}
                title={courant.kind === "phase" || courant.kind === "dossier" ? undefined : "Choisissez une phase ou un dossier"}
                className="h-[30px] px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover disabled:opacity-40 transition-colors"
              >
                <Plus size={15} strokeWidth={2.5} /> Nouveau <ChevronDown size={13} strokeWidth={2.5} />
              </button>
              {menuNouveau && (
                <div className="absolute left-0 top-9 z-50 w-56 rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-lg)]">
                  <button type="button" onClick={() => { setMenuNouveau(false); setNouveauDossier(""); setModale({ type: "dossier" }); }} disabled={!courant.phase} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-fg hover:bg-hover disabled:opacity-40">
                    <FolderPlus size={15} /> Dossier
                  </button>
                  <button type="button" onClick={() => { setMenuNouveau(false); setCibleVersion(null); entree.current?.click(); }} disabled={!peutDeposer} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-fg hover:bg-hover disabled:opacity-40">
                    <Upload size={15} /> Déposer des fichiers
                  </button>
                </div>
              )}
            </div>

            <button type="button" className={outil} disabled={!peutDeposer} onClick={() => { setCibleVersion(null); entree.current?.click(); }}>
              <Upload size={15} /> Déposer
            </button>
            <Separateur />
            <button type="button" className={outil} disabled={!docSelectionne || !can("doc:download")} onClick={() => docSelectionne && telecharger(docSelectionne)}>
              <Download size={15} /> Télécharger
            </button>
            <button type="button" className={outil} disabled title={BIENTOT}>
              <Pencil size={15} /> Renommer
            </button>
            <button type="button" className={outil} disabled title={BIENTOT}>
              <Move size={15} /> Déplacer
            </button>
            <button type="button" className={outil} disabled={!docSelectionne || !can("doc:delete")} onClick={() => docSelectionne && (setMotif(""), setModale({ type: "corbeille", doc: docSelectionne }))}>
              <Trash2 size={15} /> Supprimer
            </button>
            <Separateur />
            <button type="button" className={`${outil} text-success`} disabled={!docSelectionne || docSelectionne.status !== "encours" || !can("doc:validate")} onClick={() => docSelectionne && valider(docSelectionne)}>
              <Check size={15} /> Valider
            </button>
            <button type="button" className={`${outil} text-danger`} disabled={!docSelectionne || docSelectionne.status !== "encours" || !can("doc:reject")} onClick={() => docSelectionne && (setMotif(""), setModale({ type: "rejet", doc: docSelectionne }))}>
              <X size={15} /> Rejeter
            </button>
            {courant.kind === "dossier" && courant.total === 0 && can("doc:delete") && (
              <>
                <Separateur />
                <button type="button" className={`${outil} text-danger`} onClick={() => supprimerDossier(courant)}>
                  <Trash2 size={15} /> Supprimer ce dossier
                </button>
              </>
            )}

            <div className="flex-1" />

            <div className="relative">
              <button type="button" className={outil} onClick={(e) => { e.stopPropagation(); setMenuTri((v) => !v); }}>
                <ArrowDownUp size={15} /> Trier
              </button>
              {menuTri && (
                <div className="absolute right-0 top-9 z-50 w-48 rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-lg)]">
                  {([["nom", "Nom"], ["modifie", "Modifié le"], ["taille", "Taille"]] as const).map(([champ, label]) => (
                    <button
                      key={champ}
                      type="button"
                      onClick={() => setTri((t) => ({ champ, sens: t.champ === champ && t.sens === 1 ? -1 : 1 }))}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] text-fg hover:bg-hover"
                    >
                      {label}
                      {tri.champ === champ && <span className="text-fg-subtle">{tri.sens === 1 ? "croissant" : "décroissant"}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="inline-flex gap-0.5 p-0.5 rounded-[var(--radius-sm)] border border-line bg-inset">
              <button type="button" title="Détails" aria-pressed={vue === "details"} onClick={() => setVue("details")} className={`w-7 h-6 flex items-center justify-center rounded-[4px] ${vue === "details" ? "bg-surface shadow-[var(--shadow-sm)] text-fg" : "text-fg-subtle"}`}>
                <List size={15} />
              </button>
              <button type="button" title="Grandes icônes" aria-pressed={vue === "icones"} onClick={() => setVue("icones")} className={`w-7 h-6 flex items-center justify-center rounded-[4px] ${vue === "icones" ? "bg-surface shadow-[var(--shadow-sm)] text-fg" : "text-fg-subtle"}`}>
                <LayoutGrid size={15} />
              </button>
            </div>
            <button type="button" title="Volet de détails" aria-pressed={voletOuvert} onClick={() => setVoletOuvert((v) => !v)} className={`w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius-sm)] ${voletOuvert ? "bg-primary-subtle text-primary-fg" : "text-fg-muted hover:bg-hover"}`}>
              <PanelRight size={16} />
            </button>
          </div>

          {/* Volets */}
          <div className="flex-1 min-h-0 flex">
            <div role="tree" aria-label="Arborescence du projet" className="w-[262px] flex-shrink-0 overflow-y-auto border-r border-line bg-inset p-1.5">
              {rendreNoeud(arbre, 0)}
            </div>

            <div
              className={`flex-1 min-w-0 flex flex-col ${survolDepot ? "bg-primary-subtle/40" : ""}`}
              onDragOver={(e) => { if (peutDeposer) { e.preventDefault(); setSurvolDepot(true); } }}
              onDragLeave={() => setSurvolDepot(false)}
              onDrop={(e) => { e.preventDefault(); setSurvolDepot(false); if (peutDeposer) deposer(e.dataTransfer.files); }}
            >
              {vue === "details" && (
                <div className={`${colonnes} h-8 flex-shrink-0 border-b border-line bg-inset text-[11.5px] font-semibold text-fg-muted`}>
                  <span className="px-2.5" />
                  <span className="px-2.5">Nom</span>
                  <span className="px-2.5 border-l border-line">Statut</span>
                  <span className="px-2.5 border-l border-line">Modifié le</span>
                  <span className="px-2.5 border-l border-line">Type</span>
                  <span className="px-2.5 border-l border-line text-right">Taille</span>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                {chargement ? (
                  <p className="p-6 text-[13px] text-fg-muted">Chargement des archives…</p>
                ) : erreur ? (
                  <p className="p-6 text-[13px] text-danger">{erreur}</p>
                ) : lignes.length === 0 ? (
                  <p className="p-6 text-[13px] text-fg-subtle">
                    {recherche ? "Aucun élément ne correspond à cette recherche." : courant.kind === "dossier" ? "Ce dossier est vide." : "Aucun élément ici."}
                  </p>
                ) : vue === "details" ? (
                  lignes.map((ligne) =>
                    ligne.kind === "noeud" ? (
                      <LigneNoeud key={ligne.noeud.id} noeud={ligne.noeud} onOuvrir={() => naviguer(ligne.noeud.id)} />
                    ) : (
                      <LigneDocument
                        key={ligne.doc._id}
                        doc={ligne.doc}
                        selectionne={selection.includes(ligne.doc._id)}
                        onSelection={(multiple) =>
                          setSelection((s) => (multiple ? (s.includes(ligne.doc._id) ? s.filter((id) => id !== ligne.doc._id) : [...s, ligne.doc._id]) : [ligne.doc._id]))
                        }
                        onOuvrir={() => setModale({ type: "apercu", doc: ligne.doc })}
                        onMenu={(x, y) => { setSelection([ligne.doc._id]); setMenuContextuel({ x, y, doc: ligne.doc }); }}
                      />
                    ),
                  )
                ) : (
                  <div className="flex flex-wrap gap-3 p-4">
                    {lignes.map((ligne) =>
                      ligne.kind === "noeud" ? (
                        <button key={ligne.noeud.id} type="button" onDoubleClick={() => naviguer(ligne.noeud.id)} onClick={() => naviguer(ligne.noeud.id)} className="w-[116px] flex flex-col items-center gap-2 rounded-[var(--radius-md)] p-3 text-center hover:bg-hover">
                          <GlypheDossier taille={44} />
                          <span className="text-[12px] text-fg line-clamp-2">{ligne.noeud.label}</span>
                        </button>
                      ) : (
                        <button
                          key={ligne.doc._id}
                          type="button"
                          onClick={() => setSelection([ligne.doc._id])}
                          onDoubleClick={() => setModale({ type: "apercu", doc: ligne.doc })}
                          className={`w-[116px] flex flex-col items-center gap-2 rounded-[var(--radius-md)] p-3 text-center ${selection.includes(ligne.doc._id) ? "bg-primary-subtle" : "hover:bg-hover"}`}
                        >
                          <GlypheFichier nom={ligne.doc.fileName} taille={40} />
                          <span className="text-[12px] text-fg line-clamp-2 break-words">{ligne.doc.fileName}</span>
                          <StatutBadge statut={ligne.doc.status} />
                        </button>
                      ),
                    )}
                  </div>
                )}

                {courant.kind === "dossier" && lignes.length > 0 && (
                  <p className="py-3 text-center text-[12px] text-fg-subtle">
                    {peutDeposer ? `Glissez des fichiers ici pour les déposer dans « ${courant.label} »` : "Vous n'avez pas le droit de déposer ici"}
                  </p>
                )}
              </div>
            </div>

            {voletOuvert && rendreVolet()}
          </div>

          {/* Barre d'état */}
          <div className="h-[30px] flex-shrink-0 flex items-center gap-3.5 border-t border-line bg-inset px-3.5 text-[11.5px] text-fg-muted">
            <span>{lignes.length} élément{lignes.length > 1 ? "s" : ""}</span>
            {selection.length > 0 && (
              <span>{selection.length} élément{selection.length > 1 ? "s" : ""} sélectionné{selection.length > 1 ? "s" : ""} · {formaterTaille(tailleSelection)}</span>
            )}
            <span className="flex-1" />
            <span className="flex items-center gap-1.5">
              <Lock size={13} className="text-fg-subtle" />
              {resumeDroits(can, isAdmin)}
            </span>
          </div>

          {/* Menu contextuel */}
          {menuContextuel && (
            <div
              className="absolute z-50 w-60 rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-[var(--shadow-lg)]"
              style={{ left: Math.min(menuContextuel.x, 600), top: Math.min(menuContextuel.y, 560) }}
              onClick={(e) => e.stopPropagation()}
            >
              <ItemMenu icone={<Eye size={15} />} label="Aperçu" raccourci="Espace" onClick={() => { setModale({ type: "apercu", doc: menuContextuel.doc }); setMenuContextuel(null); }} />
              <ItemMenu icone={<Download size={15} />} label="Télécharger" desactive={!can("doc:download")} onClick={() => { telecharger(menuContextuel.doc); setMenuContextuel(null); }} />
              <ItemMenu icone={<Upload size={15} />} label="Déposer une nouvelle version" desactive={!peutDeposer} onClick={() => { setCibleVersion(menuContextuel.doc); setMenuContextuel(null); entree.current?.click(); }} />
              <ItemMenu icone={<History size={15} />} label="Historique des versions" onClick={() => { setModale({ type: "versions", doc: menuContextuel.doc }); setMenuContextuel(null); }} />
              <SeparateurMenu />
              <ItemMenu icone={<Pencil size={15} />} label="Renommer" raccourci="F2" desactive titre={BIENTOT} />
              <ItemMenu icone={<Move size={15} />} label="Déplacer vers…" desactive titre={BIENTOT} />
              <SeparateurMenu />
              <ItemMenu icone={<Check size={15} />} label="Valider" couleur="text-success" desactive={menuContextuel.doc.status !== "encours" || !can("doc:validate")} onClick={() => { valider(menuContextuel.doc); setMenuContextuel(null); }} />
              <ItemMenu icone={<X size={15} />} label="Rejeter…" couleur="text-danger" desactive={menuContextuel.doc.status !== "encours" || !can("doc:reject")} onClick={() => { setMotif(""); setModale({ type: "rejet", doc: menuContextuel.doc }); setMenuContextuel(null); }} />
              <SeparateurMenu />
              <ItemMenu icone={<Trash2 size={15} />} label="Mettre à la corbeille" raccourci="Suppr" couleur="text-danger" desactive={!can("doc:delete")} onClick={() => { setMotif(""); setModale({ type: "corbeille", doc: menuContextuel.doc }); setMenuContextuel(null); }} />
            </div>
          )}
        </div>
      </div>

      <input
        ref={entree}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          const fichiers = e.target.files;
          if (fichiers && fichiers.length > 0) deposer(fichiers);
          e.target.value = "";
          setCibleVersion(null);
        }}
      />

      {/* Modales */}
      {(modale?.type === "rejet" || modale?.type === "corbeille") && (
        <Fenetre
          titre={modale.type === "rejet" ? "Rejeter le document" : "Mettre à la corbeille"}
          description={modale.type === "rejet" ? `« ${modale.doc.fileName} » sera marqué comme rejeté. Le motif est visible par le déposant.` : `« ${modale.doc.fileName} » ira à la corbeille. Indiquez pourquoi.`}
          onFermer={() => { setModale(null); setMotif(""); }}
        >
          <textarea
            autoFocus
            rows={3}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder={modale.type === "rejet" ? "ex. cartouche non signé" : "ex. doublon"}
            className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setModale(null); setMotif(""); }} className="h-9 px-4 rounded-[var(--radius-md)] border border-line text-[13px] font-medium text-fg hover:bg-hover">Annuler</button>
            <button
              type="button"
              disabled={!motif.trim()}
              onClick={() => (modale.type === "rejet" ? confirmerRejet() : confirmerCorbeille())}
              className="h-9 px-4 rounded-[var(--radius-md)] bg-danger text-white text-[13px] font-semibold disabled:opacity-40"
            >
              {modale.type === "rejet" ? "Rejeter" : "Mettre à la corbeille"}
            </button>
          </div>
        </Fenetre>
      )}

      {modale?.type === "dossier" && (
        <Fenetre titre="Nouveau dossier" description={`Dans ${courant.label}.`} onFermer={() => setModale(null)}>
          <input
            autoFocus
            type="text"
            value={nouveauDossier}
            onChange={(e) => setNouveauDossier(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") creerDossier(); }}
            placeholder="ex. Rapports de chantier"
            className="w-full h-10 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModale(null)} className="h-9 px-4 rounded-[var(--radius-md)] border border-line text-[13px] font-medium text-fg hover:bg-hover">Annuler</button>
            <button type="button" disabled={!nouveauDossier.trim()} onClick={creerDossier} className="h-9 px-4 rounded-[var(--radius-md)] bg-primary text-on-primary text-[13px] font-semibold disabled:opacity-40">Créer</button>
          </div>
        </Fenetre>
      )}

      {modale?.type === "apercu" && <ModaleApercu doc={modale.doc} onFermer={() => setModale(null)} />}

      {modale?.type === "versions" && (
        <Fenetre titre="Historique des versions" description={modale.doc.fileName} onFermer={() => setModale(null)}>
          <ul className="divide-y divide-line-subtle">
            {versionsDe(documents, modale.doc).map((v) => (
              <li key={v._id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="font-mono text-fg">v{v.version}</span>
                <span className="flex-1 min-w-0 truncate text-fg-muted">{nomAuteur(v.uploadedBy)} · {formaterDateHeure(v.createdAt)}</span>
                <StatutBadge statut={v.status} />
                <button type="button" onClick={() => telecharger(v)} className="text-primary-fg hover:underline">Télécharger</button>
              </li>
            ))}
          </ul>
        </Fenetre>
      )}

      {modale?.type === "listeCorbeille" && (
        <Fenetre titre="Corbeille" description={`${corbeille.length} document${corbeille.length > 1 ? "s" : ""} retiré${corbeille.length > 1 ? "s" : ""} des archives.`} onFermer={() => setModale(null)}>
          {corbeille.length === 0 ? (
            <p className="text-[13px] text-fg-subtle">La corbeille est vide.</p>
          ) : (
            <ul className="divide-y divide-line-subtle max-h-[50vh] overflow-y-auto">
              {corbeille.map((doc) => (
                <li key={doc._id} className="flex items-center gap-3 py-2 text-[13px]">
                  <GlypheFichier nom={doc.fileName} taille={18} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-fg">{doc.fileName}</span>
                    <span className="block text-[11.5px] text-fg-subtle">{doc.trashReason || "Sans motif"} · {formaterDateHeure(doc.trashedAt)}</span>
                  </span>
                  {can("doc:delete") && (
                    <button type="button" onClick={() => executer(() => restoreDocument(doc._id), "Document restauré")} className="text-primary-fg hover:underline">Restaurer</button>
                  )}
                  {can("doc:unlock") && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmation({
                          titre: "Supprimer définitivement",
                          message: `« ${doc.fileName} » sera effacé. Cette action est irréversible.`,
                          appliquer: () => executer(() => deleteDocument(doc._id), "Document supprimé définitivement"),
                        })
                      }
                      className="text-danger hover:underline"
                    >
                      Supprimer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Fenetre>
      )}

      <ConfirmDialog
        isOpen={confirmation !== null}
        title={confirmation?.titre ?? ""}
        message={confirmation?.message ?? ""}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => { confirmation?.appliquer(); setConfirmation(null); }}
        onCancel={() => setConfirmation(null)}
      />

    </div>
  );
}

// ══════════════════════════════════════
// Sous-composants
// ══════════════════════════════════════

function Separateur() {
  return <span className="w-px h-5 bg-line mx-1" aria-hidden />;
}

function SeparateurMenu() {
  return <div className="h-px bg-line my-1 mx-0.5" aria-hidden />;
}

function BoutonNav({ libelle, onClick, desactive, children }: { libelle: string; onClick: () => void; desactive?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={libelle}
      title={libelle}
      onClick={onClick}
      disabled={desactive}
      className="w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-30 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

function ItemMenu({ icone, label, raccourci, couleur = "text-fg", desactive, titre, onClick }: { icone: React.ReactNode; label: string; raccourci?: string; couleur?: string; desactive?: boolean; titre?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={desactive}
      title={titre}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 h-[30px] px-2.5 rounded-[var(--radius-sm)] text-left text-[12.5px] hover:bg-hover disabled:opacity-40 disabled:pointer-events-none transition-colors ${couleur}`}
    >
      {icone}
      <span className="flex-1">{label}</span>
      {raccourci && <span className="font-mono text-[10.5px] text-fg-subtle">{raccourci}</span>}
    </button>
  );
}

function LigneNoeud({ noeud, onOuvrir }: { noeud: Noeud; onOuvrir: () => void }) {
  const estPhase = noeud.kind === "phase";
  const Icone = estPhase ? ICONES_PHASE[noeud.phase!] : null;
  return (
    <div
      onDoubleClick={onOuvrir}
      onClick={onOuvrir}
      className={`${colonnes} h-[34px] border-b border-line-subtle text-[12.5px] cursor-pointer hover:bg-hover`}
    >
      <span className="px-2.5" />
      <span className="px-2.5 flex items-center gap-2 min-w-0">
        {Icone ? <Icone size={16} className="flex-shrink-0 text-fg-muted" /> : <GlypheDossier taille={18} />}
        <span className="truncate font-medium text-fg">{noeud.label}</span>
        <span className="flex-shrink-0 text-[11.5px] text-fg-subtle">{noeud.total} élément{noeud.total > 1 ? "s" : ""}</span>
      </span>
      <span className="px-2.5">
        {noeud.aValider > 0 ? (
          <span className="inline-flex items-center h-[22px] px-2 rounded-full border border-warning/20 bg-warning-subtle text-[11px] font-semibold text-warning whitespace-nowrap">{noeud.aValider} à valider</span>
        ) : noeud.total > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-success"><Check size={13} strokeWidth={2.2} /> Tout validé</span>
        ) : null}
      </span>
      <span className="px-2.5 font-mono text-[11.5px] text-fg-muted whitespace-nowrap">{noeud.modifie ? formaterDateHeure(noeud.modifie) : "—"}</span>
      <span className="px-2.5 text-fg-muted">{estPhase ? "Phase" : noeud.kind === "dossier" ? "Dossier" : "Emplacement"}</span>
      <span className="px-2.5" />
    </div>
  );
}

function LigneDocument({ doc, selectionne, onSelection, onOuvrir, onMenu }: {
  doc: DocumentMetadata;
  selectionne: boolean;
  onSelection: (multiple: boolean) => void;
  onOuvrir: () => void;
  onMenu: (x: number, y: number) => void;
}) {
  const manquant = doc.status === "manquant";
  return (
    <div
      onClick={(e) => onSelection(e.ctrlKey || e.metaKey)}
      onDoubleClick={onOuvrir}
      onContextMenu={(e) => {
        e.preventDefault();
        const cadre = (e.currentTarget.closest(".relative") as HTMLElement)?.getBoundingClientRect();
        onMenu(e.clientX - (cadre?.left ?? 0), e.clientY - (cadre?.top ?? 0));
      }}
      className={`${colonnes} h-[34px] border-b border-line-subtle text-[12.5px] cursor-default ${selectionne ? "bg-primary-subtle shadow-[inset_2px_0_0_var(--primary)]" : "hover:bg-hover"}`}
    >
      <span className="px-2.5 flex items-center">
        {!manquant && (
          <input
            type="checkbox"
            aria-label={`Sélectionner ${doc.fileName}`}
            checked={selectionne}
            onChange={() => onSelection(true)}
            onClick={(e) => e.stopPropagation()}
            className="w-[15px] h-[15px] accent-[var(--primary)]"
          />
        )}
      </span>
      <span className="px-2.5 flex items-center gap-2 min-w-0">
        {manquant ? <span className="w-[18px] h-[18px] flex-shrink-0 rounded-[3px] border-[1.5px] border-dashed border-line-strong" /> : <GlypheFichier nom={doc.fileName} taille={18} />}
        <span className={`truncate ${manquant ? "italic text-fg-muted" : selectionne ? "font-semibold text-fg" : "text-fg"}`}>{doc.fileName}</span>
        {doc.version > 1 && <span className="flex-shrink-0 font-mono text-[10.5px] px-1.5 rounded-[4px] border border-line text-fg-muted" title="Version">v{doc.version}</span>}
        {doc.status === "rejete" && doc.tracking?.rejectionReason && (
          <span className="flex-shrink-0 text-[11.5px] text-danger truncate">· {doc.tracking.rejectionReason}</span>
        )}
      </span>
      <span className="px-2.5"><StatutBadge statut={doc.status} /></span>
      <span className="px-2.5 font-mono text-[11.5px] text-fg-muted whitespace-nowrap">{formaterDateHeure(doc.updatedAt)}</span>
      <span className="px-2.5 text-fg-muted truncate">{manquant ? "—" : typeFichier(doc.fileName).libelle}</span>
      <span className="px-2.5 text-right font-mono text-[11.5px] text-fg-muted">{manquant ? "" : tailleDocument(doc)}</span>
    </div>
  );
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted flex-shrink-0">{label}</dt>
      <dd className="text-right font-medium text-fg break-words">{valeur}</dd>
    </div>
  );
}

function Etape({ couleur, titre, detail, fait, dernier }: { couleur: "success" | "warning" | "danger"; titre: string; detail: string; fait?: boolean; dernier?: boolean }) {
  const bordure = { success: "border-success", warning: "border-warning", danger: "border-danger" }[couleur];
  const fond = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[couleur];
  const texte = { success: "text-success", warning: "text-warning", danger: "text-danger" }[couleur];
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <span className={`w-4 h-4 flex-shrink-0 rounded-full border-2 ${bordure} ${fait ? fond : "bg-surface"} flex items-center justify-center`}>
          {fait && <Check size={9} strokeWidth={3.5} className="text-white" />}
        </span>
        {!dernier && <span className="w-0.5 flex-1 min-h-[14px] bg-line" />}
      </div>
      <div className={`flex flex-col ${dernier ? "" : "pb-2"}`}>
        <span className={`text-[12px] font-semibold ${fait ? "text-fg" : texte}`}>{titre}</span>
        <span className="text-[11.5px] text-fg-muted">{detail}</span>
      </div>
    </div>
  );
}

/** Vignette du volet : l'image elle-même, ou une page stylisée. */
function Apercu({ doc }: { doc: DocumentMetadata }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!estImage(doc.fileName)) return;
    let vivant = true;
    let local: string | null = null;
    getDocumentObjectUrl(doc._id)
      .then((u) => { local = u; if (vivant) setUrl(u); else URL.revokeObjectURL(u); })
      .catch(() => undefined);
    return () => { vivant = false; if (local) URL.revokeObjectURL(local); setUrl(null); };
  }, [doc._id, doc.fileName]);

  return (
    <div className="h-[132px] rounded-[var(--radius-md)] border border-line bg-inset flex items-end justify-center overflow-hidden">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.fileName} className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="w-[118px] h-[118px] rounded-t-[3px] bg-white dark:bg-[#E9EDF4] shadow-[var(--shadow-sm)] px-3 pt-3 flex flex-col gap-1.5">
          <span className="h-1.5 w-[70%] rounded-[2px] bg-[#1A3882]" />
          <span className="h-[3px] w-[45%] rounded-[2px] bg-[#C3CAD6]" />
          {[92, 100, 86, 97, 64].map((w, i) => <span key={i} className="h-[3px] rounded-[2px] bg-[#DDE2EA]" style={{ width: `${w}%` }} />)}
          <span className="h-6 mt-1 rounded-[2px] bg-[#E8EDF7]" />
        </div>
      )}
    </div>
  );
}

function ModaleApercu({ doc, onFermer }: { doc: DocumentMetadata; onFermer: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    let local: string | null = null;
    getDocumentObjectUrl(doc._id)
      .then((u) => { local = u; if (vivant) setUrl(u); else URL.revokeObjectURL(u); })
      .catch((e) => vivant && setErreur(getErrorMessage(e)));
    return () => { vivant = false; if (local) URL.revokeObjectURL(local); };
  }, [doc._id]);

  const affichable = estImage(doc.fileName) || doc.fileName.toLowerCase().endsWith(".pdf");

  return (
    <Fenetre titre={doc.fileName} description={`${typeFichier(doc.fileName).libelle} · ${tailleDocument(doc)}`} onFermer={onFermer} large>
      {erreur ? (
        <p className="text-[13px] text-danger">{erreur}</p>
      ) : !affichable ? (
        <p className="text-[13px] text-fg-muted">Ce format ne s&apos;affiche pas dans le navigateur : téléchargez le fichier pour l&apos;ouvrir.</p>
      ) : !url ? (
        <p className="text-[13px] text-fg-muted">Chargement de l&apos;aperçu…</p>
      ) : estImage(doc.fileName) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.fileName} className="max-h-[70vh] mx-auto object-contain" />
      ) : (
        <iframe src={url} title={doc.fileName} className="w-full h-[70vh] rounded-[var(--radius-md)] border border-line" />
      )}
    </Fenetre>
  );
}

function Fenetre({ titre, description, onFermer, large, children }: { titre: string; description?: string; onFermer: () => void; large?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-4" onClick={onFermer}>
      <div
        role="dialog"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${large ? "max-w-4xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-[var(--shadow-lg)] space-y-3`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-fg break-words">{titre}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-fg-muted break-words">{description}</p>}
          </div>
          <button type="button" aria-label="Fermer" onClick={onFermer} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-[var(--radius-sm)] text-fg-muted hover:bg-hover">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Résumé des droits, affiché dans la barre d'état. */
function resumeDroits(can: (p: Permission) => boolean, isAdmin: boolean): string {
  const droits = [
    can("doc:upload") && "dépôt",
    can("doc:validate") && "validation",
    can("doc:delete") && "suppression",
  ].filter(Boolean) as string[];
  const role = isAdmin ? "Administrateur" : droits.length > 0 ? "Chef de projet" : "Consultation";
  return droits.length > 0 ? `${role} : ${droits.join(", ")}` : `${role} : lecture et téléchargement`;
}

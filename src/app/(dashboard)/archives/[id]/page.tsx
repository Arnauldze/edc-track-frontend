"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { useParams } from "next/navigation";
import { getProjectById } from "@/lib/projectStore";
import {
  addTrackedDocument,
  getTrackedDocumentsLatest,
  getTrashedDocuments,
  markTrackedDocumentApproved,
  moveTrackedDocumentToTrash,
  permanentlyDeleteFromTrash,
  rejectTrackedDocumentWithReason,
  restoreTrackedDocumentFromTrash,
  type TrackedDocument,
} from "@/lib/documentTrackingStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  BarChart3,
  Network,
  Zap,
  FileText,
  FolderOpen,
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Eye,
  Download,
  File,
  XCircle,
  ChevronLeft,
  DollarSign,
  Calendar,
  Activity,
  Users,
} from "lucide-react";

// ══════════════════════════════════════
// TYPES & DATA
// ══════════════════════════════════════
type ActivityData = {
  name: string;
  pct: number;
  budget?: string;
  delai?: string;
  status?: "done" | "exec" | "idle";
  sousActivites?: { name: string; desc: string }[];
};
type SousComposant = { id: string; name: string; activities: ActivityData[] };
type Composant = {
  id: string;
  name: string;
  status: "ok" | "progress";
  desc: string;
  sousComposants: SousComposant[];
};
type FileStatus = "valide" | "encours" | "manquant";
type FileData = {
  name: string;
  size: string;
  type: "pdf" | "dwg" | "zip" | "xls" | "doc";
  status: FileStatus;
  lastModif?: string;
  lastModifBy?: string;
  file?: File;
  blobUrl?: string;
  /** Lien vers l’instance Suivi (créée au dépôt GED) */
  trackingId?: string;
  version?: number;
  rejectionReason?: string;
};
type DocStatus = "valide" | "encours" | "manquant";
type DocData = {
  name: string;
  desc: string;
  type: "pdf" | "xls" | "doc" | "plan" | "folder";
  date: string;
  status: DocStatus;
  files: FileData[];
  lastModif?: string;
  lastModifBy?: string;
};

// Helper to derive folder status from its files
const deriveFolderStatus = (files: FileData[]): DocStatus => {
  if (files.length === 0) return "manquant";
  if (files.every((f) => f.status === "valide")) return "valide";
  return "encours";
};
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
const getFileExt = (name: string): FileData["type"] => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx"].includes(ext)) return "xls";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (ext === "dwg") return "dwg";
  if (ext === "zip") return "zip";
  return "pdf";
};
const todayStr = () =>
  new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const formatUploadDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const DEFAULT_PROJECT = {
  id: "PRJ-2008-001",
  name: "Lom Pangar",
  budget: "420 Mrd FCFA",
  progress: 72,
  description: "Infrastructure Hydroélectrique",
  components: [
    {
      id: "barrage",
      name: "Barrage",
      status: "progress" as const,
      desc: "Infrastructure principale",
      sousComposants: [
        {
          id: "fond",
          name: "Fondations",
          activities: [
            {
              name: "Fouilles",
              pct: 100,
              budget: "2.5 Mrd FCFA",
              delai: "Jan 2024 → Mar 2024",
              status: "done",
            },
            {
              name: "Béton de propreté",
              pct: 80,
              budget: "800 M FCFA",
              delai: "Avr 2024 → Jun 2024",
              status: "exec",
            },
          ],
        },
        {
          id: "corps",
          name: "Corps barrage",
          activities: [
            {
              name: "Montage des murs",
              pct: 60,
              budget: "12 Mrd FCFA",
              delai: "Mar 2024 → Dec 2024",
              status: "exec",
            },
            {
              name: "Passage graviers",
              pct: 30,
              budget: "3 Mrd FCFA",
              delai: "Jun 2024 → Sep 2024",
              status: "exec",
            },
            {
              name: "Fondations profondes",
              pct: 100,
              budget: "8 Mrd FCFA",
              delai: "Jan 2024 → Avr 2024",
              status: "done",
            },
            {
              name: "Toiture & finitions",
              pct: 0,
              budget: "5 Mrd FCFA",
              delai: "Jan 2025 → Jun 2025",
              status: "idle",
            },
          ],
        },
        {
          id: "evac",
          name: "Évacuateur de crues",
          activities: [
            {
              name: "Terrassement",
              pct: 45,
              budget: "4 Mrd FCFA",
              delai: "Fév 2024 → Aoû 2024",
              status: "exec",
            },
          ],
        },
        {
          id: "prise",
          name: "Ouvrage de prise",
          activities: [
            {
              name: "Coffrage",
              pct: 10,
              budget: "2 Mrd FCFA",
              delai: "Mai 2024 → Oct 2024",
              status: "exec",
            },
          ],
        },
      ],
    },
    {
      id: "usine",
      name: "Usine",
      status: "progress" as const,
      desc: "Production électrique",
      sousComposants: [
        {
          id: "turb",
          name: "Turbines",
          activities: [
            {
              name: "Montage turbine Francis",
              pct: 15,
              budget: "25 Mrd FCFA",
              delai: "Jun 2024 → Jun 2025",
              status: "exec",
            },
          ],
        },
        {
          id: "gen",
          name: "Générateurs",
          activities: [
            {
              name: "Installation alternateurs",
              pct: 0,
              budget: "18 Mrd FCFA",
              delai: "2025",
              status: "idle",
            },
          ],
        },
        {
          id: "ctrl",
          name: "Contrôle-commande",
          activities: [
            {
              name: "Système SCADA",
              pct: 0,
              budget: "6 Mrd FCFA",
              delai: "2025",
              status: "idle",
            },
          ],
        },
      ],
    },
    {
      id: "route",
      name: "Route d'accès",
      status: "progress" as const,
      desc: "Voirie & accès chantier",
      sousComposants: [
        {
          id: "terr",
          name: "Terrassement",
          activities: [
            {
              name: "Déblais",
              pct: 70,
              budget: "1.5 Mrd FCFA",
              delai: "Jan 2024 → Mai 2024",
              status: "exec",
            },
          ],
        },
        {
          id: "chau",
          name: "Chaussée",
          activities: [
            {
              name: "Enrobé",
              pct: 0,
              budget: "3 Mrd FCFA",
              delai: "Jun 2024 → Dec 2024",
              status: "idle",
            },
          ],
        },
      ],
    },
    {
      id: "cite",
      name: "Cité",
      status: "ok" as const,
      desc: "Logements & services",
      sousComposants: [
        {
          id: "log",
          name: "Logements",
          activities: [
            {
              name: "Construction",
              pct: 100,
              budget: "10 Mrd FCFA",
              delai: "2023 → 2024",
              status: "done",
            },
            {
              name: "Aménagement",
              pct: 90,
              budget: "2 Mrd FCFA",
              delai: "2024",
              status: "exec",
            },
          ],
        },
        {
          id: "vrd",
          name: "VRD",
          activities: [
            {
              name: "Voirie",
              pct: 100,
              budget: "4 Mrd FCFA",
              delai: "2023 → 2024",
              status: "done",
            },
            {
              name: "Réseaux",
              pct: 85,
              budget: "3 Mrd FCFA",
              delai: "2024",
              status: "exec",
            },
          ],
        },
      ],
    },
  ] as Composant[],
};

// ══════════════════════════════════════
// PAGE
// ══════════════════════════════════════
export default function ProjectConfigPage() {
  const params = useParams();
  const projectId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";
  
  const [PROJECT, setPROJECT] = useState<typeof DEFAULT_PROJECT>(DEFAULT_PROJECT);
  
  useEffect(() => {
    async function loadProject() {
      const stored = await getProjectById(projectId);
      if (!stored) {
        setPROJECT(DEFAULT_PROJECT);
        return;
      }
      // For the default Lom Pangar, use the rich hardcoded data
      if (stored.code === "PRJ-2008-001") {
        setPROJECT(DEFAULT_PROJECT);
        return;
      }
      // For other projects, build from store data
      setPROJECT({
        id: stored.code,
        name: stored.name,
        budget: stored.budget?.toString() || "—",
        progress: stored.progress,
        description: stored.description || "Projet d'infrastructure",
        components: (stored.components || []).map((c) => ({
          id: c.id,
          name: c.name,
          status: "progress" as const,
          desc: c.name,
          sousComposants: (c.sousComposants || []).map((sc) => ({
            id: sc.id,
            name: sc.name,
            activities: (sc.activities || []).map((a) => ({
              name: typeof a === "string" ? a : a.name,
              pct: 0,
              budget: "—",
              delai: "—",
              status: "idle" as const,
            })),
          })),
        })) as Composant[],
      });
    }
    loadProject();
  }, [projectId]);
  
  const [currentComp, setCurrentComp] = useState<string | null>(null);
  const [currentSComp, setCurrentSComp] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<
    "etude" | "passation" | "execution"
  >("etude");
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(
    null,
  );
  const [showComposantes, setShowComposantes] = useState(false);

  // Déterminer le niveau le plus bas (où afficher les 3 phases)
  const lowestLevel = useMemo(() => {
    if (!currentComp) return "global"; // Étude globale
    
    const comp = PROJECT.components.find((c) => c.id === currentComp);
    if (!comp) return "component";
    
    // Si la composante a des sous-composantes
    if (comp.sousComposants && comp.sousComposants.length > 0) {
      if (!currentSComp) return "not-lowest"; // On est au niveau composante (pas le plus bas)
      
      const sc = comp.sousComposants.find((s) => s.id === currentSComp);
      if (!sc) return "subcomponent";
      
      // Si le sous-composant a des activités
      if (sc.activities && sc.activities.length > 0) {
        // Le niveau le plus bas est "activity", pas "subcomponent"
        // Donc si on n'a pas sélectionné d'activité, on n'est PAS au niveau le plus bas
        if (!selectedActivity) return "not-lowest"; // Pas le niveau le plus bas
        return "activity"; // On est au niveau le plus bas
      }
      // Pas d'activités → le niveau le plus bas est "subcomponent"
      return "subcomponent";
    }
    
    // Pas de sous-composantes → le niveau le plus bas est "component"
    return "component";
  }, [currentComp, currentSComp, selectedActivity, PROJECT.components]);

  // Calculer le contexte actuel basé sur la navigation
  const context = useMemo(() => {
    if (selectedActivity) {
      // Niveau activité: composante/sous-composante/activite
      const activityName = selectedActivity.name.toLowerCase().replace(/\s+/g, '-');
      return `${currentComp}/${currentSComp}/${activityName}`;
    }
    if (currentSComp) {
      // Niveau sous-composante: composante/sous-composante
      return `${currentComp}/${currentSComp}`;
    }
    if (currentComp) {
      // Niveau composante: composante
      return currentComp;
    }
    // Niveau global
    return "global";
  }, [currentComp, currentSComp, selectedActivity]);

  const [activeTab, setActiveTab] = useState<
    "etude" | "structure" | "planning"
  >("etude");
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [showValidateModal, setShowValidateModal] = useState<{
    docIdx: number;
    fileIdx: number;
    fileName: string;
  } | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    phase: string;
    docIdx: number;
  } | null>(null);
  const [createFolderModal, setCreateFolderModal] = useState<{
    phase: string;
  } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<{
    phase: string;
    docIdx: number;
    fileIdx: number;
    fileName: string;
  } | null>(null);
  const [showTrashMoveModal, setShowTrashMoveModal] = useState<{
    phase: string;
    docIdx: number;
    fileIdx: number;
    fileName: string;
  } | null>(null);
  const [showTrashModal, setShowTrashModal] = useState<{ phase: string } | null>(
    null,
  );
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState<{
    docId: string;
    fileName: string;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [confirmDeleteFolderState, setConfirmDeleteFolder] = useState<{
    phase: string;
    docIdx: number;
    name: string;
  } | null>(null);

  // GED document state (mutable) — chargé depuis le backend
  const [etudeDocs, setEtudeDocs] = useState<DocData[]>([]);
  const [passationDocs, setPassationDocs] = useState<DocData[]>([]);
  const [executionDocs, setExecutionDocs] = useState<DocData[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Charger les documents depuis le backend
  useEffect(() => {
    if (!PROJECT.id || typeof window === "undefined") return;
    
    async function loadDocsFromBackend() {
      setIsLoadingDocs(true);
      try {
        const [etudeTracked, passationTracked, executionTracked] = await Promise.all([
          getTrackedDocumentsLatest(PROJECT.id, "etude", undefined, context),
          getTrackedDocumentsLatest(PROJECT.id, "passation", undefined, context),
          getTrackedDocumentsLatest(PROJECT.id, "execution", undefined, context),
        ]);

        // Grouper les documents par dossier
        const groupByFolder = (docs: TrackedDocument[]): DocData[] => {
          const folderMap = new Map<string, FileData[]>();
          
          docs.forEach((doc) => {
            const files = folderMap.get(doc.folderName) || [];
            files.push({
              name: doc.fileName,
              size: doc.fileSize || "0 KB",
              type: (["pdf", "dwg", "zip", "xls", "doc"].includes(doc.fileType || "")
                ? doc.fileType
                : "pdf") as FileData["type"],
              status: (doc.status === "valide"
                ? "valide"
                : doc.status === "rejete"
                  ? "manquant"
                  : "encours") as FileStatus,
              lastModif: formatUploadDate(doc.createdAt || new Date().toISOString()),
              lastModifBy: doc.uploadedBy,
              trackingId: doc._id,
              version: doc.version || 1,
              rejectionReason: doc.tracking?.rejectionReason,
            });
            folderMap.set(doc.folderName, files);
          });

          return Array.from(folderMap.entries()).map(([folderName, files]) => ({
            name: folderName,
            desc: `${files.length} fichier${files.length > 1 ? "s" : ""}`,
            type: "folder" as const,
            date: files[0]?.lastModif || todayStr(),
            status: deriveFolderStatus(files),
            files,
            lastModif: files.length > 0 ? files[files.length - 1]?.lastModif : undefined,
            lastModifBy: files.length > 0 ? files[files.length - 1]?.lastModifBy : undefined,
          }));
        };

        setEtudeDocs(groupByFolder(etudeTracked));
        setPassationDocs(groupByFolder(passationTracked));
        setExecutionDocs(groupByFolder(executionTracked));
      } catch (error) {
        console.error("Erreur lors du chargement des documents:", error);
        toast.error("Erreur lors du chargement des documents");
      } finally {
        setIsLoadingDocs(false);
      }
    }
    
    loadDocsFromBackend();
  }, [PROJECT.id, context]);

  const getPhaseDocsAndSetter = (
    phase: string,
  ): [DocData[], React.Dispatch<React.SetStateAction<DocData[]>>] => {
    if (phase === "etude") return [etudeDocs, setEtudeDocs];
    if (phase === "passation") return [passationDocs, setPassationDocs];
    return [executionDocs, setExecutionDocs];
  };

  const handleSelectComp = useCallback((id: string) => {
    setCurrentComp(id);
    setCurrentSComp(null);
    setCurrentPhase("etude");
    setSelectedActivity(null);
    setExpandedRows([]);
    setShowComposantes(true); // Activer l'affichage des composantes
  }, []);
  const handleSelectSComp = useCallback((id: string) => {
    setCurrentSComp(id);
    setCurrentPhase("etude");
    setSelectedActivity(null);
    setExpandedRows([]);
  }, []);
  const handleSelectActivity = useCallback((act: ActivityData) => {
    setSelectedActivity(act);
    setCurrentPhase("etude"); // Commencer par Étude au lieu de Passation
    setExpandedRows([]);
  }, []);

  const toggleRow = useCallback((index: number) => {
    setExpandedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  }, []);

  const getDocIcon = (type: string) => {
    const styles: Record<string, string> = {
      pdf: "bg-red-500/10 text-red-500",
      xls: "bg-green-500/10 text-green-600",
      doc: "bg-blue-500/10 text-blue-500",
      plan: "bg-purple-500/10 text-purple-500",
    };
    return (
      <div
        className={`w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center flex-shrink-0 ${styles[type] || "bg-[var(--bg-inset)] text-[var(--text-tertiary)]"}`}
      >
        <FolderOpen size={15} />
      </div>
    );
  };
  const getFileIcon = (type: string) => {
    const styles: Record<string, { color: string; icon: React.ReactNode }> = {
      pdf: { color: "text-red-500", icon: <FileText size={14} /> },
      dwg: { color: "text-purple-500", icon: <File size={14} /> },
      zip: { color: "text-amber-500", icon: <File size={14} /> },
      xls: { color: "text-green-500", icon: <File size={14} /> },
      doc: { color: "text-blue-500", icon: <File size={14} /> },
    };
    const s = styles[type] || {
      color: "text-[var(--text-tertiary)]",
      icon: <File size={14} />,
    };
    return <span className={s.color}>{s.icon}</span>;
  };
  const getStatusBadge = (status: DocStatus | FileStatus) => {
    const config: Record<
      string,
      { icon: React.ReactNode; label: string; style: string }
    > = {
      valide: {
        icon: <CheckCircle2 size={10} />,
        label: "Validé",
        style: "bg-green-500/10 text-green-600 border-green-500/20",
      },
      encours: {
        icon: <Clock size={10} />,
        label: "En cours",
        style: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      },
      manquant: {
        icon: <AlertCircle size={10} />,
        label: "Manquant",
        style: "bg-red-500/10 text-red-600 border-red-500/20",
      },
    };
    const c = config[status];
    if (!c) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${c.style}`}
      >
        {c.icon}
        {c.label}
      </span>
    );
  };

  // ── FILE UPLOAD & FOLDER HANDLER ──
  const handleCreateFolder = async () => {
    if (!createFolderModal || !newFolderName.trim()) return;
    const [docs, setter] = getPhaseDocsAndSetter(createFolderModal.phase);

    const newDoc: DocData = {
      name: newFolderName.trim(),
      type: "folder",
      date: todayStr(),
      status: "manquant",
      files: [],
      desc: "Aucun fichier",
    };
    setter([...docs, newDoc]);
    setCreateFolderModal(null);
    setNewFolderName("");
    toast.success("Dossier créé");
  };

  const handleUploadClick = (phase: string, docIdx: number) => {
    setUploadTarget({ phase, docIdx });
    fileInputRef.current?.click();
  };
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !uploadTarget) return;
    const [docs, setter] = getPhaseDocsAndSetter(uploadTarget.phase);
    const folderName = docs[uploadTarget.docIdx]?.name || "Dossier";
    const newFiles: FileData[] = await Promise.all(
      Array.from(selectedFiles).map(async (f) => {
        const sizeStr = formatFileSize(f.size);
        const ext = getFileExt(f.name);
        const tracked = await addTrackedDocument(f, {
          projectId: PROJECT.id,
          phase: uploadTarget.phase,
          folderName,
          context: context,
        });
        return {
          name: f.name,
          size: sizeStr,
          type: ext,
          status: "encours" as FileStatus,
          lastModif: todayStr(),
          lastModifBy: "Chef de Projet",
          file: f,
          blobUrl: URL.createObjectURL(f),
          trackingId: tracked._id,
          version: tracked.version || 1,
        };
      })
    );
    setter((prev) =>
      prev.map((doc, i) => {
        if (i !== uploadTarget.docIdx) return doc;
        const updatedFiles = [...doc.files, ...newFiles];
        return {
          ...doc,
          files: updatedFiles,
          desc: `${updatedFiles.length} fichier${updatedFiles.length > 1 ? "s" : ""}`,
          status: deriveFolderStatus(updatedFiles),
          lastModif: todayStr(),
          lastModifBy: "Chef de Projet",
        };
      }),
    );
    e.target.value = "";
    setUploadTarget(null);
    toast.success(
      `${newFiles.length} fichier${newFiles.length > 1 ? "s" : ""} déposé${newFiles.length > 1 ? "s" : ""} dans "${folderName}"`,
    );
  };

  // ── FILE ACTIONS (state-mutating) ──
  const handleValidateFile = async (
    phase: string,
    docIdx: number,
    fileIdx: number,
  ) => {
    const [docs, setter] = getPhaseDocsAndSetter(phase);
    const file = docs[docIdx]?.files[fileIdx];
    
    if (!file?.trackingId) {
      toast.error("Impossible de valider ce fichier");
      return;
    }

    try {
      await markTrackedDocumentApproved(file.trackingId);
      if (file?.name) toast.success(`Fichier validé : ${file.name}`);
      
      setter((prev) =>
        prev.map((doc, di) => {
          if (di !== docIdx) return doc;
          const updatedFiles = doc.files.map((f, fi) =>
            fi === fileIdx ? { ...f, status: "valide" as FileStatus } : f,
          );
          return {
            ...doc,
            files: updatedFiles,
            status: deriveFolderStatus(updatedFiles),
          };
        }),
      );
    } catch (error) {
      console.error("Erreur lors de la validation:", error);
      toast.error("Erreur lors de la validation du fichier");
    }
  };

  const handleRejectFile = async (
    phase: string,
    docIdx: number,
    fileIdx: number,
    reason: string,
  ) => {
    const [docs, setter] = getPhaseDocsAndSetter(phase);
    const file = docs[docIdx]?.files[fileIdx];
    
    if (!file?.trackingId) {
      toast.error("Impossible de rejeter ce fichier");
      return;
    }

    try {
      await rejectTrackedDocumentWithReason(file.trackingId, reason);
      if (file?.name) toast.info(`Fichier rejeté : ${file.name}`);
      
      setter((prev) =>
        prev.map((doc, di) => {
          if (di !== docIdx) return doc;
          const updatedFiles = doc.files.map((f, fi) =>
            fi === fileIdx
              ? { ...f, status: "manquant" as FileStatus, rejectionReason: reason }
              : f,
          );
          return {
            ...doc,
            files: updatedFiles,
            status: deriveFolderStatus(updatedFiles),
          };
        }),
      );
    } catch (error) {
      console.error("Erreur lors du rejet:", error);
      toast.error("Erreur lors du rejet du fichier");
    }
  };
  const handleDeleteDocFolder = async (phase: string, docIdx: number) => {
    const [docs, setter] = getPhaseDocsAndSetter(phase);
    const docToDelete = docs[docIdx];
    
    // Check if it has files
    if (docToDelete.files && docToDelete.files.length > 0) {
      toast.error(`Impossible de supprimer le dossier "${docToDelete.name}" car il contient des fichiers. Videz-le d'abord.`);
      return;
    }
    
    setConfirmDeleteFolder({ phase, docIdx, name: docToDelete.name });
  };

  const confirmDeleteFolder = () => {
    if (confirmDeleteFolderState) {
      const [docs, setter] = getPhaseDocsAndSetter(confirmDeleteFolderState.phase);
      setter((prev) => prev.filter((_, idx) => idx !== confirmDeleteFolderState.docIdx));
      toast.info(`Dossier supprimé : ${confirmDeleteFolderState.name}`);
    }
  };

  const handleDeleteFileToTrash = async (
    phase: string,
    docIdx: number,
    fileIdx: number,
    reason: string,
  ) => {
    const [docs, setter] = getPhaseDocsAndSetter(phase);
    const doc = docs[docIdx];
    const file = doc?.files[fileIdx];
    
    if (!file?.trackingId) {
      toast.error("Impossible de déplacer ce fichier en corbeille");
      return;
    }

    try {
      await moveTrackedDocumentToTrash(file.trackingId, reason);
      if (file?.name) toast.info(`Fichier déplacé en corbeille : ${file.name}`);
      
      setter((prev) =>
        prev.map((docRow, di) => {
          if (di !== docIdx) return docRow;
          const updatedFiles = docRow.files.filter((_, fi) => fi !== fileIdx);
          return {
            ...docRow,
            files: updatedFiles,
            desc:
              updatedFiles.length > 0
                ? `${updatedFiles.length} fichier${updatedFiles.length > 1 ? "s" : ""}`
                : "Aucun fichier",
            status: deriveFolderStatus(updatedFiles),
          };
        }),
      );
    } catch (error) {
      console.error("Erreur lors du déplacement en corbeille:", error);
      toast.error("Erreur lors du déplacement en corbeille");
    }
  };
  const handleRollbackValidation = async (
    phase: string,
    docIdx: number,
    fileIdx: number,
  ) => {
    const [docs, setter] = getPhaseDocsAndSetter(phase);
    const file = docs[docIdx]?.files[fileIdx];
    if (!file?.trackingId) return;
    
    // Pour annuler une validation, on rejette puis on remet en cours
    // Note: Le backend ne supporte pas directement le rollback, 
    // donc on change juste le statut côté frontend
    setter((prev) =>
      prev.map((doc, di) => {
        if (di !== docIdx) return doc;
        const updatedFiles = doc.files.map((f, fi) =>
          fi === fileIdx
            ? {
                ...f,
                status: "encours" as FileStatus,
                lastModif: todayStr(),
              }
            : f,
        );
        return {
          ...doc,
          files: updatedFiles,
          status: deriveFolderStatus(updatedFiles),
        };
      }),
    );
    toast.success(`Validation annulée pour ${file.name}`);
  };
  const handlePreviewFile = async (file: FileData) => {
    if (file.blobUrl) {
      setPreviewFile({ url: file.blobUrl, name: file.name, type: file.type });
    } else if (file.trackingId) {
      // Télécharger le fichier depuis le backend pour prévisualisation
      try {
        toast.info("Chargement du fichier...");
        // Note: Pour l'instant, on affiche juste un message
        // TODO: Implémenter la prévisualisation depuis le backend
        toast.info(`Prévisualisation de "${file.name}" (fonctionnalité à venir)`);
      } catch (error) {
        console.error("Erreur lors du chargement du fichier:", error);
        toast.error("Erreur lors du chargement du fichier");
      }
    } else {
      toast.info(`Aucun fichier réel pour "${file.name}".`);
    }
  };

  const handleDownloadFile = async (file: FileData) => {
    if (file.blobUrl) {
      const a = document.createElement("a");
      a.href = file.blobUrl;
      a.download = file.name;
      a.click();
    } else if (file.trackingId) {
      // Télécharger depuis le backend
      try {
        toast.info("Téléchargement en cours...");
        // Note: Pour l'instant, on affiche juste un message
        // TODO: Implémenter le téléchargement depuis le backend
        toast.info(`Téléchargement de "${file.name}" (fonctionnalité à venir)`);
      } catch (error) {
        console.error("Erreur lors du téléchargement:", error);
        toast.error("Erreur lors du téléchargement");
      }
    } else {
      toast.info(`Aucun fichier réel pour "${file.name}".`);
    }
  };

  // ── FILE ACTION DROPDOWN (Valider / Rejeter / Supprimer) ──
  const FileActionDropdown = ({
    fileKey,
    fileName,
    phase,
    docIdx,
    fileIdx,
  }: {
    fileKey: string;
    fileName: string;
    phase: string;
    docIdx: number;
    fileIdx: number;
  }) => {
    const isOpen = openActionMenu === fileKey;
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpenActionMenu(isOpen ? null : fileKey)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-[11px] font-semibold border transition-all ${isOpen ? "bg-[var(--accent)] text-white border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--text-tertiary)]"}`}
        >
          <MoreHorizontal size={13} />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] shadow-[var(--shadow-lg)] z-50 py-1 overflow-hidden">
            <button
              onClick={() => {
                setShowValidateModal({ docIdx, fileIdx, fileName });
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-green-600 hover:bg-green-500/10 transition-colors"
            >
              <CheckCircle2 size={14} /> Valider
            </button>
            <button
              onClick={() => {
                setShowRejectModal({
                  phase,
                  docIdx,
                  fileIdx,
                  fileName,
                });
                setReasonInput("");
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-orange-600 hover:bg-orange-500/10 transition-colors"
            >
              <XCircle size={14} /> Rejeter
            </button>
            {(() => {
              const [docs] = getPhaseDocsAndSetter(phase);
              const row = docs[docIdx]?.files[fileIdx];
              if (row?.status !== "valide") return null;
              return (
                <button
                  onClick={() => {
                    handleRollbackValidation(phase, docIdx, fileIdx);
                    setOpenActionMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-blue-600 hover:bg-blue-500/10 transition-colors"
                >
                  <Edit2 size={14} /> Annuler validation
                </button>
              );
            })()}
            <div className="h-px bg-[var(--border-subtle)] my-1" />
            <button
              onClick={() => {
                setShowTrashMoveModal({
                  phase,
                  docIdx,
                  fileIdx,
                  fileName,
                });
                setReasonInput("");
                setOpenActionMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} /> Envoyer corbeille
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── LIVRABLES TABLE (GED) ──
  const LivrablesTable = ({
    docs,
    contextTitle,
    phase,
  }: {
    docs: DocData[];
    contextTitle: string;
    phase: string;
  }) => {
    const validCount = docs.filter((d) => d.status === "valide").length;
    const pct =
      docs.length > 0 ? Math.round((validCount / docs.length) * 100) : 0;
    const barColor =
      pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";
    const gridStyle = {
      gridTemplateColumns:
        "minmax(250px,2.5fr) 100px minmax(120px,1.5fr) 130px",
    };
    
    if (isLoadingDocs) {
      return (
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden shadow-[var(--shadow-sm)] p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-secondary)]">Chargement des documents...</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden shadow-[var(--shadow-sm)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Dossiers{" "}
              <span className="font-normal text-[var(--text-tertiary)] ml-1">
                ({contextTitle})
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-[var(--text-primary)]">
                {pct}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const trashed = await getTrashedDocuments(PROJECT.id, phase, context);
                setShowTrashModal({ phase });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors border border-[var(--border-default)] shadow-sm"
            >
              <Trash2 size={13} /> Corbeille
            </button>
            <button
              onClick={() => setCreateFolderModal({ phase })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors border border-[var(--accent-subtle)] hover:border-[var(--accent)] shadow-sm"
            >
              <Plus size={13} /> Nouveau dossier
            </button>
          </div>
        </div>
        {/* Column headers */}
        <div
          style={gridStyle}
          className={`grid gap-3 px-5 py-2.5 bg-[var(--bg-inset)] border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider`}
        >
          <span>Document</span>
          <span>Statut</span>
          <span>Dernière Modif.</span>
          <span></span>
        </div>
        {/* Rows */}
        {docs.length === 0 ? (
          <div className="p-8 text-center">
            <FolderOpen size={48} className="mx-auto text-[var(--text-tertiary)] mb-3 opacity-50" />
            <p className="text-sm text-[var(--text-secondary)] font-medium mb-1">
              Aucun dossier pour cette phase
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Créez un nouveau dossier pour commencer à organiser vos documents
            </p>
          </div>
        ) : (
          docs.map((doc, idx) => {
            const isExpanded = expandedRows.includes(idx);
            const hasFiles = doc.files.length > 0;
            return (
            <div key={idx}>
              {/* ── FOLDER ROW ── */}
              <div
                style={gridStyle}
                onClick={() => hasFiles && toggleRow(idx)}
                className={`grid gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)] items-center transition-colors hover:bg-[var(--bg-surface-hover)] ${hasFiles ? "cursor-pointer" : ""}`}
              >
                {/* Document */}
                <div className="flex items-center gap-3 min-w-0">
                  {hasFiles && (
                    <ChevronRight
                      size={13}
                      className={`text-[var(--text-tertiary)] transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                    />
                  )}
                  {!hasFiles && <div className="w-[13px]" />}
                  {getDocIcon(doc.type)}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                      {doc.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {hasFiles
                        ? `${doc.files.length} fichier${doc.files.length > 1 ? "s" : ""}`
                        : "Aucun fichier"}
                    </div>
                  </div>
                </div>
                {/* Statut */}
                <div>{getStatusBadge(doc.status)}</div>
                {/* Dernière Modif */}
                <div className="text-[11px] min-w-0">
                  {doc.lastModif ? (
                    <>
                      <div className="font-medium text-[var(--text-secondary)] truncate">
                        {doc.lastModif}
                      </div>
                      <div className="text-[var(--text-tertiary)] mt-0.5 truncate">
                        par {doc.lastModifBy}
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--text-tertiary)] italic">
                      —
                    </span>
                  )}
                </div>
                {/* Action (folder = Déposer + Supprimer) */}
                <div
                  className="flex justify-end items-center gap-1.5 pr-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleUploadClick(phase, idx)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-[11px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-[var(--shadow-sm)] transition-all"
                  >
                    <Upload size={12} /> Déposer
                  </button>
                  <button
                    onClick={() => handleDeleteDocFolder(phase, idx)}
                    className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Supprimer le dossier"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {/* ── EXPANDED FILES ── */}
              {hasFiles && isExpanded && (
                <div className="bg-[var(--bg-inset)] border-b border-[var(--border-subtle)]">
                  {doc.files.map((file, fidx) => {
                    const fileKey = `${idx}-${fidx}`;
                    return (
                      <div
                        key={fidx}
                        style={gridStyle}
                        className={`grid gap-3 px-5 py-3 items-center hover:bg-[var(--bg-surface-hover)] transition-colors`}
                      >
                        {/* Document (file) */}
                        <div className="flex items-center gap-3 pl-[26px] min-w-0">
                          {getFileIcon(file.type)}
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                              {file.name}
                            </div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">
                              {file.size}
                              {file.version ? ` • v${file.version}` : ""}
                            </div>
                            {file.rejectionReason && (
                              <div className="text-[10px] text-orange-600 truncate">
                                Motif rejet : {file.rejectionReason}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Statut */}
                        <div>{getStatusBadge(file.status)}</div>
                        {/* Dernière Modif */}
                        <div className="text-[10px] min-w-0">
                          {file.lastModif ? (
                            <>
                              <div className="text-[var(--text-secondary)] truncate">
                                {file.lastModif}
                              </div>
                              <div className="text-[var(--text-tertiary)] mt-0.5 truncate">
                                par {file.lastModifBy}
                              </div>
                            </>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">
                              —
                            </span>
                          )}
                        </div>
                        {/* Action (Preview + Download + Dropdown on file) */}
                        <div
                          className="flex items-center justify-end gap-1 pr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handlePreviewFile(file)}
                            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent)] transition-colors"
                            title="Prévisualiser"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent)] transition-colors"
                            title="Télécharger"
                          >
                            <Download size={14} />
                          </button>
                          <FileActionDropdown
                            fileKey={fileKey}
                            fileName={file.name}
                            phase={phase}
                            docIdx={idx}
                            fileIdx={fidx}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {/* Add file button */}
                  <div className="px-5 py-2.5 pl-[70px]">
                    <button
                      onClick={() => handleUploadClick(phase, idx)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                    >
                      <Plus size={12} /> Ajouter un fichier
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    );
  };

  // ── VALIDATION MODAL ──
  const ValidateModal = () => {
    if (!showValidateModal) return null;
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={() => setShowValidateModal(null)}
      >
        <div
          className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md p-6 border border-[var(--border-default)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lock size={18} className="text-amber-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Confirmer la validation
              </h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Action irréversible
              </p>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-[var(--radius-md)] border border-amber-500/20 mb-4">
            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>⚠️ Attention :</strong> En validant{" "}
              <strong>&quot;{showValidateModal.fileName}&quot;</strong>, cette
              action sera <strong>définitive</strong>. Seul un administrateur
              pourra la débloquer.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowValidateModal(null)}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                handleValidateFile(
                  currentPhase,
                  showValidateModal.docIdx,
                  showValidateModal.fileIdx,
                );
                setShowValidateModal(null);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] transition-colors flex items-center gap-1.5"
            >
              <Lock size={12} /> Valider définitivement
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── PREVIEW MODAL ──
  const PreviewModal = () => {
    if (!previewFile) return null;
    const isPdf =
      previewFile.type === "pdf" || previewFile.name.endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
      previewFile.name,
    );
    return (
      <div
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={() => setPreviewFile(null)}
      >
        <div
          className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] border border-[var(--border-default)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <Eye size={16} className="text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {previewFile.name}
              </h3>
            </div>
            <button
              onClick={() => setPreviewFile(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <XCircle size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 bg-[var(--bg-inset)] min-h-[400px]">
            {isPdf ? (
              <iframe
                src={previewFile.url}
                className="w-full h-full min-h-[500px] rounded-[var(--radius-md)] border-0"
              />
            ) : isImage ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-[70vh] mx-auto rounded-[var(--radius-md)]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <File size={48} className="text-[var(--text-tertiary)] mb-4" />
                <p className="text-sm text-[var(--text-secondary)] font-medium">
                  Aperçu non disponible pour ce type de fichier
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                  {previewFile.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── CREATE FOLDER MODAL ──
  const CreateFolderModal = () => {
    if (!createFolderModal) return null;
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={() => {
          setCreateFolderModal(null);
          setNewFolderName("");
        }}
      >
        <div
          className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-sm p-6 border border-[var(--border-default)]"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <FolderOpen size={16} className="text-[var(--accent)]" /> Nouveau
            dossier
          </h4>
          <input
            type="text"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nom du dossier..."
            className="w-full px-3 py-2 text-sm bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-subtle)] mb-5"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setCreateFolderModal(null);
                setNewFolderName("");
              }}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] transition-colors disabled:opacity-50"
            >
              Créer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ReasonModal = ({
    title,
    confirmLabel,
    onCancel,
    onConfirm,
  }: {
    title: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: (reason: string) => void;
  }) => (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md p-6 border border-[var(--border-default)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">
          {title}
        </h4>
        <textarea
          value={reasonInput}
          onChange={(e) => setReasonInput(e.target.value)}
          placeholder="Saisissez le motif..."
          rows={4}
          className="w-full px-3 py-2 text-sm bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)]"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reasonInput)}
            disabled={!reasonInput.trim()}
            className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-[var(--radius-md)] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  const TrashModal = () => {
    if (!showTrashModal) return null;
    const [items, setItems] = React.useState<any[]>([]);
    
    React.useEffect(() => {
      if (showTrashModal) {
        getTrashedDocuments(PROJECT.id, showTrashModal.phase, context).then(setItems);
      }
    }, [showTrashModal]);
    
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={() => setShowTrashModal(null)}
      >
        <div
          className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-3xl p-6 border border-[var(--border-default)] max-h-[85vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4">
            Corbeille ({items.length})
          </h4>
          <div className="space-y-2">
            {items.map((d) => (
              <div
                key={d._id}
                className="flex items-center justify-between border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {d.fileName} • v{d.currentVersion || 1}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                    Motif corbeille : {d.trashReason || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await restoreTrackedDocumentFromTrash(d._id);
                      const updated = await getTrashedDocuments(PROJECT.id, showTrashModal.phase, context);
                      setItems(updated);
                      toast.success("Document restauré");
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold border border-[var(--border-default)] rounded-[var(--radius-sm)]"
                  >
                    Restaurer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPermanentDeleteModal({
                        docId: d._id,
                        fileName: d.fileName,
                      });
                      setReasonInput("");
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-red-600 border border-red-300 rounded-[var(--radius-sm)]"
                  >
                    Suppr. définitive
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)] italic">
                La corbeille est vide.
              </p>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={() => setShowTrashModal(null)}
              className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)]"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── ACTIVITY DETAIL ──
  const ActivityDetail = ({ activity }: { activity: ActivityData }) => {
    const statusText =
      activity.status === "done"
        ? "Terminée"
        : activity.status === "exec"
          ? "En cours"
          : "Non démarrée";
    const statusStyle =
      activity.status === "done"
        ? "bg-green-500/10 text-green-600 border-green-500/20"
        : activity.status === "exec"
          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
          : "bg-[var(--bg-inset)] text-[var(--text-tertiary)] border-[var(--border-default)]";
    const barColor =
      activity.pct === 100
        ? "bg-green-500"
        : activity.pct > 0
          ? "bg-blue-500"
          : "";
    return (
      <div>
        <button
          onClick={() => setSelectedActivity(null)}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] mb-4 transition-colors"
        >
          <ChevronLeft size={14} /> Retour à l'exécution
        </button>
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="p-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {activity.name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusStyle}`}
                >
                  {statusText}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {activity.pct}%
                </div>
                <div className="w-24 h-1.5 bg-[var(--bg-inset)] rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${activity.pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
            <div className="p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                <DollarSign size={12} /> Budget
              </div>
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {activity.budget}
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                <Calendar size={12} /> Délai
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                {activity.delai}
              </div>
            </div>
          </div>
          {activity.sousActivites && activity.sousActivites.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] p-5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                <Activity size={12} /> Sous-activités
              </div>
              <div className="space-y-2">
                {activity.sousActivites.map((sa, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-[var(--bg-inset)] rounded-[var(--radius-md)]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        {sa.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">
                        {sa.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  alert(`Ajouter une sous-activité à ${activity.name}`)
                }
                className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline"
              >
                <Plus size={12} /> Ajouter une sous-activité
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  const comp = PROJECT.components.find((c) => c.id === currentComp);
  const sc = comp?.sousComposants.find((s) => s.id === currentSComp);

  const handleGoBack = useCallback(() => {
    if (selectedActivity) {
      setSelectedActivity(null);
    } else if (currentSComp) {
      setCurrentSComp(null);
      setSelectedActivity(null);
      setExpandedRows([]);
    } else if (currentComp) {
      setCurrentComp(null);
      setCurrentSComp(null);
      setSelectedActivity(null);
      setExpandedRows([]);
    }
  }, [selectedActivity, currentSComp, currentComp]);

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-4 pb-4 flex-shrink-0">
        {/* Breadcrumb en haut */}
        <div className="mb-3">
          <Link
            href="/archives"
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors inline-flex"
          >
            <ChevronLeft size={14} /> Tous les projets
          </Link>
        </div>
        
        {/* Titre et bouton */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                {PROJECT.name}
                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">
                  {PROJECT.id}
                </span>
              </h1>
            </div>
          </div>
          <Link
            href={`/projects/${PROJECT.id}/team`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Users size={16} />
            Équipe projet
          </Link>
        </div>
      </div>

      {/* NAV BAR — Onglets réorganisés */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex-shrink-0">
        {/* Row 1: Étude Globale + COMPOSANTES pills */}
        <div className="flex items-center gap-2 px-8 py-2 border-b border-[var(--border-subtle)]">
          <button
            onClick={() => {
              setCurrentComp(null);
              setCurrentSComp(null);
              setSelectedActivity(null);
              setExpandedRows([]);
              setShowComposantes(false);
            }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all flex-shrink-0 ${
              !currentComp && !showComposantes
                ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                : "text-[var(--text-secondary)] hover:text-emerald-600 hover:bg-emerald-500/8 border border-transparent"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Étude Globale
          </button>

          {PROJECT.components.length > 0 && (
            <button
              onClick={() => {
                setShowComposantes(!showComposantes);
                if (!showComposantes) {
                  // Si on ouvre les composantes, ne pas sélectionner de composante par défaut
                  setCurrentComp(null);
                  setCurrentSComp(null);
                  setSelectedActivity(null);
                }
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all flex-shrink-0 ${
                showComposantes || currentComp
                  ? "bg-blue-500/15 text-blue-600 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                  : "text-[var(--text-secondary)] hover:text-blue-600 hover:bg-blue-500/8 border border-transparent"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Composantes
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-[10px] font-bold">
                {PROJECT.components.length}
              </span>
            </button>
          )}
        </div>

        {/* Row 2: Component tabs (conditionnelle - affichée seulement si showComposantes ou currentComp) */}
        {PROJECT.components.length > 0 && (showComposantes || currentComp) && (
          <div className="flex items-center px-8 py-2">
            <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
              {PROJECT.components.map((c, idx) => {
                const dotColors = [
                  "bg-emerald-500", "bg-blue-500", "bg-amber-500",
                  "bg-purple-500", "bg-cyan-500", "bg-rose-500",
                  "bg-teal-500", "bg-indigo-500", "bg-orange-500", "bg-pink-500",
                ];
                const dotColor = dotColors[idx % dotColors.length];
                const isActive = currentComp === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectComp(c.id)}
                    className={`flex items-center gap-2 py-2 px-3.5 text-[12px] font-medium border-b-2 transition-all whitespace-nowrap ${
                      isActive
                        ? "border-[var(--accent)] text-[var(--text-primary)] font-bold"
                        : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? dotColor : "bg-[var(--text-tertiary)] opacity-50"} transition-all`} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex">
        {/* LEFT PANEL — Only when a component is selected */}
        {currentComp && comp && (
          <div className="w-[240px] bg-[var(--bg-surface)] border-r border-[var(--border-default)] overflow-y-auto flex-shrink-0 py-5">
            {/* Afficher les sous-composants seulement s'il y en a */}
            {comp.sousComposants && comp.sousComposants.length > 0 && (
              <>
                <div className="px-5 mb-3 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Sous-composants
                </div>
                <div className="mb-1">
                  {comp.sousComposants.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSComp(s.id)}
                      className={`flex items-center gap-3 px-5 py-2 cursor-pointer border-l-[3px] transition-all text-[13px] ${currentSComp === s.id ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)] font-bold" : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"}`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentSComp === s.id ? "bg-[var(--accent)]" : "bg-[var(--text-tertiary)]"}`}
                      />
                      {s.name}
                    </div>
                  ))}
                </div>
                <div className="h-px bg-[var(--border-subtle)] mx-5 mb-4" />
              </>
            )}
            
            {/* Afficher les activités seulement si on a un sous-composant sélectionné ET qu'il a des activités */}
            {currentSComp && sc && sc.activities && sc.activities.length > 0 && (
              <>
                <div className="px-5 mb-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Activités — {sc.name}
                </div>
                <div>
                  {sc.activities.map((a, idx) => {
                    const dotColor =
                      a.pct === 100
                        ? "bg-green-500"
                        : a.pct > 0
                          ? "bg-blue-500"
                          : "bg-[var(--text-tertiary)]";
                    const isSelected = selectedActivity?.name === a.name;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectActivity(a)}
                        className={`flex items-center gap-3 px-5 py-2 cursor-pointer transition-colors text-[13px] ${isSelected ? "text-[var(--accent)] font-semibold bg-[var(--accent-subtle)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"}`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`}
                        />
                        <span className="truncate flex-1">{a.name}</span>
                        <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                          {a.pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {/* Message si pas de sous-composants */}
            {(!comp.sousComposants || comp.sousComposants.length === 0) && (
              <div className="px-5 text-[11px] text-[var(--text-tertiary)] italic">
                Aucun sous-composant
              </div>
            )}
          </div>
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Étude Globale (default — no component selected) */}
          {!currentComp && (
            <>
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Étude Globale du Projet
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Dossiers fondateurs de l&apos;étude générale
                </p>
              </div>
              <LivrablesTable
                docs={etudeDocs}
                contextTitle="Projet"
                phase="etude"
              />
            </>
          )}

          {/* Component selected — Étude du composant (sans SC) */}
          {currentComp && comp && !currentSComp && !selectedActivity && (
            <div className="space-y-4">
              {/* Si c'est le niveau le plus bas (pas de sous-composantes), afficher les 3 phases */}
              {lowestLevel === "component" ? (
                <>
                  {/* Phase tabs (Étude / Passation / Exécution) */}
                  <div className="flex items-center gap-1 mb-5 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] p-1 w-fit shadow-[var(--shadow-sm)]">
                    <button onClick={() => { setCurrentPhase("etude"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "etude" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Étude</button>
                    <button onClick={() => { setCurrentPhase("passation"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "passation" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Passation</button>
                    <button onClick={() => { setCurrentPhase("execution"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "execution" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Exécution</button>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-blue-500/15 text-blue-500 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"><FileText size={13} /></div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{currentPhase === "etude" ? "Étude" : currentPhase === "passation" ? "Passation" : "Exécution"} — {comp.name}</h2>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 ml-8">Documents de {currentPhase} du composant.</p>
                  </div>
                  <LivrablesTable 
                    docs={currentPhase === "etude" ? etudeDocs : currentPhase === "passation" ? passationDocs : executionDocs} 
                    contextTitle={comp.name} 
                    phase={currentPhase} 
                  />
                </>
              ) : (
                <>
                  {/* Phase tabs (Étude only at this level) */}
                  <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] p-1 w-fit shadow-[var(--shadow-sm)]">
                    <button className="px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)] cursor-default">
                      Étude
                    </button>
                  </div>
                  <div className="mb-2 mt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-blue-500/15 text-blue-500 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"><FileText size={13} /></div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Étude — {comp.name}</h2>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 ml-8">Documents d&apos;étude du composant. Sélectionnez un sous-composant pour voir son étude spécifique.</p>
                  </div>
                  <LivrablesTable docs={etudeDocs} contextTitle={comp.name} phase="etude" />
                </>
              )}
            </div>
          )}

          {/* Sous-composant selected — Étude du SC */}
          {currentComp && currentSComp && sc && !selectedActivity && (
            <div className="space-y-4">
              {/* Si c'est le niveau le plus bas (pas d'activités), afficher les 3 phases */}
              {lowestLevel === "subcomponent" ? (
                <>
                  {/* Phase tabs (Étude / Passation / Exécution) */}
                  <div className="flex items-center gap-1 mb-5 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] p-1 w-fit shadow-[var(--shadow-sm)]">
                    <button onClick={() => { setCurrentPhase("etude"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "etude" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Étude</button>
                    <button onClick={() => { setCurrentPhase("passation"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "passation" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Passation</button>
                    <button onClick={() => { setCurrentPhase("execution"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "execution" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Exécution</button>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-amber-500/15 text-amber-500 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"><FileText size={13} /></div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{currentPhase === "etude" ? "Étude" : currentPhase === "passation" ? "Passation" : "Exécution"} — {sc.name}</h2>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 ml-8">Documents de {currentPhase} du sous-composant.</p>
                  </div>
                  <LivrablesTable 
                    docs={currentPhase === "etude" ? etudeDocs : currentPhase === "passation" ? passationDocs : executionDocs} 
                    contextTitle={sc.name} 
                    phase={currentPhase} 
                  />
                </>
              ) : (
                <>
                  {/* Phase tabs (Étude only at this level) */}
                  <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] p-1 w-fit shadow-[var(--shadow-sm)]">
                    <button className="px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)] cursor-default">
                      Étude
                    </button>
                  </div>
                  <div className="mb-2 mt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-amber-500/15 text-amber-500 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"><FileText size={13} /></div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Étude — {sc.name}</h2>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 ml-8">Documents d&apos;étude du sous-composant. Cliquez sur une activité pour voir toutes ses phases.</p>
                  </div>
                  <LivrablesTable docs={etudeDocs} contextTitle={sc.name} phase="etude" />
                </>
              )}
            </div>
          )}

          {/* Activity selected — Étude / Passation / Exécution */}
          {currentComp && selectedActivity && lowestLevel === "activity" && (
            <div>
              <button onClick={() => setSelectedActivity(null)} className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] mb-4 transition-colors"><ChevronLeft size={14} /> Retour</button>

              {/* Titre simple de l'activité au lieu du gros dashboard */}
              <div className="mb-4">
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{selectedActivity.name}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Gérez les documents d'étude, de passation et d'exécution pour cette activité.</p>
              </div>

              {/* Étude / Passation / Exécution tabs */}
              <div className="flex items-center gap-1 mb-5 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] p-1 w-fit shadow-[var(--shadow-sm)]">
                <button onClick={() => { setCurrentPhase("etude"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "etude" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Étude</button>
                <button onClick={() => { setCurrentPhase("passation"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "passation" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Passation</button>
                <button onClick={() => { setCurrentPhase("execution"); setExpandedRows([]); }} className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all ${currentPhase === "execution" ? "bg-[var(--text-primary)] text-[var(--text-inverted)] shadow-[var(--shadow-sm)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"}`}>Exécution</button>
              </div>

              <LivrablesTable
                docs={currentPhase === "etude" ? etudeDocs : currentPhase === "passation" ? passationDocs : executionDocs}
                contextTitle={selectedActivity.name}
                phase={currentPhase}
              />
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={handleFileSelected}
      />

      {/* Modals */}
      <ValidateModal />
      <PreviewModal />
      <CreateFolderModal />
      <TrashModal />
      {showRejectModal && (
        <ReasonModal
          title={`Motif du rejet : ${showRejectModal.fileName}`}
          confirmLabel="Confirmer le rejet"
          onCancel={() => {
            setShowRejectModal(null);
            setReasonInput("");
          }}
          onConfirm={(reason) => {
            handleRejectFile(
              showRejectModal.phase,
              showRejectModal.docIdx,
              showRejectModal.fileIdx,
              reason,
            );
            setShowRejectModal(null);
            setReasonInput("");
          }}
        />
      )}
      {showTrashMoveModal && (
        <ReasonModal
          title={`Motif de mise en corbeille : ${showTrashMoveModal.fileName}`}
          confirmLabel="Envoyer en corbeille"
          onCancel={() => {
            setShowTrashMoveModal(null);
            setReasonInput("");
          }}
          onConfirm={(reason) => {
            handleDeleteFileToTrash(
              showTrashMoveModal.phase,
              showTrashMoveModal.docIdx,
              showTrashMoveModal.fileIdx,
              reason,
            );
            setShowTrashMoveModal(null);
            setReasonInput("");
          }}
        />
      )}
      {showPermanentDeleteModal && (
        <ReasonModal
          title={`Motif de suppression définitive : ${showPermanentDeleteModal.fileName}`}
          confirmLabel="Supprimer définitivement"
          onCancel={() => {
            setShowPermanentDeleteModal(null);
            setReasonInput("");
          }}
          onConfirm={(reason) => {
            permanentlyDeleteFromTrash(showPermanentDeleteModal.docId, reason);
            setShowPermanentDeleteModal(null);
            setReasonInput("");
            toast.info("Document supprimé définitivement");
          }}
        />
      )}

      {/* Dialog de confirmation pour suppression de dossier */}
      <ConfirmDialog
        isOpen={confirmDeleteFolderState !== null}
        title="Supprimer le dossier"
        message={`Êtes-vous sûr de vouloir supprimer le dossier "${confirmDeleteFolderState?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => {
          confirmDeleteFolder();
          setConfirmDeleteFolder(null);
        }}
        onCancel={() => setConfirmDeleteFolder(null)}
      />
    </div>
  );
}
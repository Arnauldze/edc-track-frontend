"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Briefcase, AlertCircle, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import { usePermissions } from "@/hooks/usePermissions";

// ══════════════════════════════════════════════════════════════
// PPM 2024 - Structure fidèle au tableau Excel EDC
// ══════════════════════════════════════════════════════════════

interface LignePassation {
  numero: string;
  designation: string;
  typeAO: string;
  typePrestation: string;
  montantPrevisionnel: string;
  sourceFinancement: string;
  imputationBudgetaire: string;
  // ── Processus de sélection ──
  saisineCIPM: string;
  examenDAOCIPM: string;
  nonObjectionBF1: string;
  lancementAO: string;
  depouillementOffres: string;
  rapportAnalyseSCA: string;
  examenRapportCIPM: string;
  nonObjectionBF2: string;
  // ── Offres financières ──
  ouvertureOF: string;
  rapportAnalyseOF: string;
  propositionAttributionCIPM: string;
  nonObjectionBF3: string;
  publicationResultats: string;
  // ── Contractualisation ──
  souscriptionMarche: string;
  saisineCIPM2: string;
  examenMarcheCIPM: string;
  visaCA: string;
  nonObjectionBF4: string;
  signatureMarche: string;
  notificationMarche: string;
  enregistrementMarche: string;
  // ── Synthèse ──
  delaiGlobalPassation: string;
  osDeDemarrage: string;
  delaiGlobalExecution: string;
  dateReceptionProvisoire: string;
  periodeGarantie: string;
  dateReceptionDefinitive: string;
}

const EMPTY_LIGNE: LignePassation = {
  numero: "", designation: "", typeAO: "", typePrestation: "",
  montantPrevisionnel: "", sourceFinancement: "", imputationBudgetaire: "",
  saisineCIPM: "", examenDAOCIPM: "", nonObjectionBF1: "", lancementAO: "",
  depouillementOffres: "", rapportAnalyseSCA: "", examenRapportCIPM: "", nonObjectionBF2: "",
  ouvertureOF: "", rapportAnalyseOF: "", propositionAttributionCIPM: "", nonObjectionBF3: "",
  publicationResultats: "", souscriptionMarche: "", saisineCIPM2: "", examenMarcheCIPM: "",
  visaCA: "", nonObjectionBF4: "", signatureMarche: "", notificationMarche: "",
  enregistrementMarche: "", delaiGlobalPassation: "", osDeDemarrage: "",
  delaiGlobalExecution: "", dateReceptionProvisoire: "", periodeGarantie: "", dateReceptionDefinitive: "",
};

// Types d'AO
const TYPES_AO = ["DC", "AONO", "AONR", "AOIO", "AMI", "Gré à gré"];
const TYPES_PRESTATION = ["Travaux", "Fourniture", "SPI", "Services"];

// Définition des colonnes par groupe
interface ColDef {
  key: keyof LignePassation;
  label: string;
  width: number;
  type: "text" | "date" | "number" | "select";
  options?: string[];
  computed?: boolean;
}

interface ColGroup {
  label: string;
  color: string;
  cols: ColDef[];
}

const COL_GROUPS: ColGroup[] = [
  {
    label: "Identification",
    color: "rgb(59, 130, 246)", // blue
    cols: [
      { key: "numero", label: "N°", width: 50, type: "text" },
      { key: "designation", label: "Désignation du Projet", width: 250, type: "text" },
      { key: "typeAO", label: "Type d'AO", width: 80, type: "select", options: TYPES_AO },
      { key: "typePrestation", label: "Type prestation", width: 90, type: "select", options: TYPES_PRESTATION },
      { key: "montantPrevisionnel", label: "Montant prév. (FCFA)", width: 130, type: "text" },
      { key: "sourceFinancement", label: "Source financement", width: 120, type: "text" },
      { key: "imputationBudgetaire", label: "Imputation budg.", width: 120, type: "text" },
    ],
  },
  {
    label: "Processus de sélection",
    color: "rgb(234, 179, 8)", // yellow
    cols: [
      { key: "saisineCIPM", label: "Saisine CIPM", width: 100, type: "date" },
      { key: "examenDAOCIPM", label: "Examen DAO CIPM", width: 100, type: "date" },
      { key: "nonObjectionBF1", label: "Non obj. BF", width: 100, type: "date" },
      { key: "lancementAO", label: "Lancement AO", width: 100, type: "date" },
      { key: "depouillementOffres", label: "Dépouillement", width: 100, type: "date" },
      { key: "rapportAnalyseSCA", label: "Rapport SCA", width: 100, type: "date" },
      { key: "examenRapportCIPM", label: "Examen rapp. CIPM", width: 100, type: "date" },
      { key: "nonObjectionBF2", label: "Non obj. BF", width: 100, type: "date" },
    ],
  },
  {
    label: "Offres financières",
    color: "rgb(168, 85, 247)", // purple
    cols: [
      { key: "ouvertureOF", label: "Ouverture OF", width: 100, type: "date" },
      { key: "rapportAnalyseOF", label: "Rapport OF", width: 100, type: "date" },
      { key: "propositionAttributionCIPM", label: "Proposition CIPM", width: 100, type: "date" },
      { key: "nonObjectionBF3", label: "Non obj. BF", width: 100, type: "date" },
      { key: "publicationResultats", label: "Publication rés.", width: 100, type: "date" },
    ],
  },
  {
    label: "Contractualisation",
    color: "rgb(34, 197, 94)", // green
    cols: [
      { key: "souscriptionMarche", label: "Souscription marché", width: 100, type: "date" },
      { key: "saisineCIPM2", label: "Saisine CIPM", width: 100, type: "date" },
      { key: "examenMarcheCIPM", label: "Examen marché CIPM", width: 100, type: "date" },
      { key: "visaCA", label: "VISA CA", width: 80, type: "select", options: ["OUI", "NON", "N/A"] },
      { key: "nonObjectionBF4", label: "Non obj. BF", width: 100, type: "date" },
      { key: "signatureMarche", label: "Signature", width: 100, type: "date" },
      { key: "notificationMarche", label: "Notification", width: 100, type: "date" },
      { key: "enregistrementMarche", label: "Enregistrement", width: 100, type: "date" },
    ],
  },
  {
    label: "Synthèse & Exécution",
    color: "rgb(239, 68, 68)", // red
    cols: [
      { key: "delaiGlobalPassation", label: "Délai passation (j)", width: 90, type: "number", computed: true },
      { key: "osDeDemarrage", label: "OS démarrage", width: 100, type: "date" },
      { key: "delaiGlobalExecution", label: "Délai exéc. (j)", width: 90, type: "number" },
      { key: "dateReceptionProvisoire", label: "Réception prov.", width: 100, type: "date" },
      { key: "periodeGarantie", label: "Garantie (j)", width: 80, type: "number" },
      { key: "dateReceptionDefinitive", label: "Réception déf.", width: 100, type: "date" },
    ],
  },
];

// Toutes les colonnes à plat
const ALL_COLS = COL_GROUPS.flatMap((g) => g.cols);
const TOTAL_WIDTH = ALL_COLS.reduce((s, c) => s + c.width, 0) + 50; // +50 pour colonne actions

interface PassationData {
  typePassation: string;
  etapesPassation: any[];
  lignesPassation?: LignePassation[];
}

interface Props {
  data: PassationData | null;
  onChange: (data: PassationData) => void;
  projectId?: string;
}

export function PlanningFormPassation({ data, onChange, projectId }: Props) {
  const { can, isView } = usePermissions(projectId);
  const [lignes, setLignes] = useState<LignePassation[]>(
    data?.lignesPassation || [{ ...EMPTY_LIGNE, numero: "1" }]
  );
  const [showImportModal, setShowImportModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync vers le parent
  useEffect(() => {
    onChange({
      typePassation: "PPM",
      etapesPassation: [],
      lignesPassation: lignes,
    });
  }, [lignes]);

  // Calcul auto du délai global de passation
  const computeDelaiGlobal = (ligne: LignePassation): string => {
    if (ligne.saisineCIPM && ligne.enregistrementMarche) {
      const d1 = new Date(ligne.saisineCIPM);
      const d2 = new Date(ligne.enregistrementMarche);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        return String(diff);
      }
    }
    return ligne.delaiGlobalPassation || "";
  };

  const addLigne = () => {
    const next = { ...EMPTY_LIGNE, numero: String(lignes.length + 1) };
    setLignes([...lignes, next]);
  };

  const removeLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const updateLigne = (index: number, key: keyof LignePassation, value: string) => {
    setLignes(
      lignes.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [key]: value };
        // Auto-compute délai global
        if (key === "saisineCIPM" || key === "enregistrementMarche") {
          updated.delaiGlobalPassation = computeDelaiGlobal(updated);
        }
        return updated;
      })
    );
  };

  const scrollBy = (dx: number) => {
    scrollRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  const handleImport = (importedData: any[]) => {
    const imported: LignePassation[] = importedData.map((row, i) => ({
      ...EMPTY_LIGNE,
      numero: row.numero || String(i + 1),
      designation: row.designation || row.nom || "",
      typeAO: row.typeAO || "",
      typePrestation: row.typePrestation || "",
      montantPrevisionnel: row.montantPrevisionnel || row.montant || "",
      sourceFinancement: row.sourceFinancement || "",
    }));
    setLignes(imported);
  };

  const renderCell = (ligne: LignePassation, col: ColDef, rowIndex: number) => {
    const value = ligne[col.key];

    if (col.type === "select" && col.options) {
      return (
        <select
          value={value}
          onChange={(e) => updateLigne(rowIndex, col.key, e.target.value)}
          disabled={isView}
          className="w-full h-full px-1 py-1 bg-transparent text-[10px] focus:outline-none focus:bg-[var(--bg-inset)] rounded border-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">—</option>
          {col.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }

    if (col.type === "date") {
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => updateLigne(rowIndex, col.key, e.target.value)}
          disabled={isView}
          className="w-full h-full px-1 py-0.5 bg-transparent text-[9px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
        />
      );
    }

    if (col.type === "number") {
      return (
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => updateLigne(rowIndex, col.key, e.target.value)}
          disabled={isView || col.computed}
          className="w-full h-full px-1 py-1 bg-transparent text-[10px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="0"
        />
      );
    }

    // text
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updateLigne(rowIndex, col.key, e.target.value)}
        disabled={isView}
        className={`w-full h-full px-1 py-1 bg-transparent focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed ${
          col.key === "designation" ? "text-[11px]" : "text-[10px] text-center"
        }`}
        placeholder={col.key === "designation" ? "Désignation..." : ""}
      />
    );
  };

  return (
    <>
      <FileImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        importType="passation"
      />

      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Briefcase size={16} />
              Plan de Passation des Marchés (PPM)
            </h2>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              Tableau conforme au modèle PPM EDC — Scroll horizontal pour naviguer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Légende des groupes - inline */}
            {COL_GROUPS.map((g) => (
              <div key={g.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: g.color }} />
                <span className="text-[9px] font-medium text-[var(--text-tertiary)]">{g.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-3">
          {isView && (
            <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                <strong>Mode lecture seule :</strong> Vous ne pouvez pas modifier la planification.
              </div>
            </div>
          )}

          {/* Navigation horizontale */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-[var(--text-tertiary)]">
              {lignes.length} ligne{lignes.length > 1 ? "s" : ""} • {ALL_COLS.length} colonnes
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollBy(-400)}
                className="p-1 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => scrollBy(400)}
                className="p-1.5 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
                title="Défiler à droite"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Tableau PPM */}
          <div className="border-2 border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden">
            <div ref={scrollRef} className="overflow-x-auto">
              <div style={{ minWidth: `${TOTAL_WIDTH}px` }}>

                {/* Row 1: Group headers */}
                <div className="flex">
                  {COL_GROUPS.map((g) => {
                    const groupWidth = g.cols.reduce((s, c) => s + c.width, 0);
                    return (
                      <div
                        key={g.label}
                        className="text-center text-[9px] font-bold text-white py-1.5 border-r border-white/20 tracking-wide uppercase"
                        style={{ width: `${groupWidth}px`, backgroundColor: g.color }}
                      >
                        {g.label}
                      </div>
                    );
                  })}
                  <div
                    className="text-center text-[9px] font-bold text-white py-1.5 bg-gray-500 uppercase"
                    style={{ width: "50px" }}
                  >
                    Act.
                  </div>
                </div>

                {/* Row 2: Column headers */}
                <div className="flex bg-[var(--bg-inset)] border-b-2 border-[var(--border-default)]">
                  {ALL_COLS.map((col) => (
                    <div
                      key={col.key}
                      className="text-[8px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-1 py-2 border-r border-[var(--border-default)] text-center leading-tight flex items-center justify-center"
                      style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                      title={col.label}
                    >
                      {col.label}
                    </div>
                  ))}
                  <div
                    className="text-[8px] font-semibold text-[var(--text-tertiary)] uppercase px-1 py-2 text-center flex items-center justify-center"
                    style={{ width: "50px", minWidth: "50px" }}
                  >
                    Suppr.
                  </div>
                </div>

                {/* Data rows */}
                {lignes.map((ligne, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex hover:bg-[var(--bg-surface-hover)] transition-colors border-b border-[var(--border-default)]"
                  >
                    {ALL_COLS.map((col) => (
                      <div
                        key={col.key}
                        className="border-r border-[var(--border-default)] flex items-center"
                        style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                      >
                        {renderCell(ligne, col, rowIndex)}
                      </div>
                    ))}
                    <div
                      className="flex items-center justify-center"
                      style={{ width: "50px", minWidth: "50px" }}
                    >
                      {can("structure:edit") && (
                        <button
                          onClick={() => removeLigne(rowIndex)}
                          className="p-1 rounded hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add row */}
                <div className="px-3 py-2 bg-[var(--bg-inset)]/30 border-t border-[var(--border-default)]">
                  {can("structure:edit") && (
                    <button
                      onClick={addLigne}
                      className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-md)] transition-colors"
                    >
                      <Plus size={14} />
                      Ajouter une ligne
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {can("structure:edit") && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded-[var(--radius-md)] transition-colors"
              >
                <Upload size={14} />
                Importer depuis Excel
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
              <strong>Plan de Passation des Marchés :</strong>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li><strong>Délai global</strong> : Calculé automatiquement entre la Saisine CIPM et l'Enregistrement</li>
                <li><strong>Non obj. BF</strong> : Non objection du Bailleur de Fonds (si applicable)</li>
                <li><strong>N/A</strong> : Saisissez N/A dans les champs date non applicables</li>
                <li>Utilisez les flèches ◀ ▶ ou le scroll horizontal pour naviguer dans le tableau</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

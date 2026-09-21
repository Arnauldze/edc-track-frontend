"use client";

import { useState, useRef } from "react";
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportedRow {
  [key: string]: any;
}

interface ColumnMapping {
  field: string;
  label: string;
  required: boolean;
  columnIndex: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any, calibrage: Record<string, number>) => void;
  importType: "etude" | "passation" | "execution" | "dqe";
}

/** Toutes les feuilles du classeur : chacune devient une serie de prix. */
const TOUTES = "*";

/** Ce qu'une cellule de tableur peut contenir une fois lue par XLSX. */
type CelluleExcel = string | number | boolean | Date | null | undefined;
type LigneExcel = CelluleExcel[];

/** Lettre de colonne du tableur : 0 -> A, 26 -> AA. */
function lettreColonne(index: number): string {
  let reste = index;
  let lettre = "";
  do {
    lettre = String.fromCharCode(65 + (reste % 26)) + lettre;
    reste = Math.floor(reste / 26) - 1;
  } while (reste >= 0);
  return lettre;
}

/**
 * Premiere ligne qui ressemble a des en-tetes. Les devis d'EDC commencent par
 * un cartouche - titre du projet, du lot - et la vraie ligne d'en-tetes n'est
 * souvent qu'en troisieme ou quatrieme position.
 */
function ligneEntetesProbable(rows: LigneExcel[]): number {
  const remplies = (row: LigneExcel = []) =>
    row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
  let meilleure = 0;
  let score = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const n = remplies(rows[i]);
    if (n > score) {
      score = n;
      meilleure = i;
    }
  }
  return meilleure;
}

const COLUMN_MAPPINGS = {
  etude: [
    { field: "numero", label: "Numéro du livrable", required: true },
    { field: "intitule", label: "Intitulé", required: true },
    { field: "ponderation", label: "Pondération (%)", required: true },
    { field: "delai", label: "Délai depuis T0 (mois)", required: false },
    { field: "duree", label: "Durée d'exécution (mois)", required: false },
    { field: "dateDebut", label: "Date de début", required: false },
    { field: "dateFin", label: "Date de fin", required: false },
    { field: "predecesseur", label: "Prédécesseur", required: false },
    { field: "successeur", label: "Successeur", required: false },
    { field: "description", label: "Description", required: false },
  ],
  passation: [
    { field: "ordre", label: "Ordre", required: true },
    { field: "nom", label: "Nom de l'étape", required: true },
    { field: "delaiJours", label: "Délai (jours)", required: true },
  ],
  dqe: [
    { field: "numero", label: "N° de prix", required: true },
    { field: "designation", label: "Désignation des prix", required: true },
    { field: "unite", label: "Unité", required: false },
    { field: "quantite", label: "Quantité", required: false },
    { field: "prixUnitaire", label: "Prix unitaire retenu", required: false },
  ],
  execution: [
    { field: "numero", label: "Numéro", required: true },
    { field: "designation", label: "Désignation", required: true },
    { field: "ponderation", label: "Pondération (%)", required: false },
    { field: "delai", label: "Délai depuis T0 (mois)", required: false },
    { field: "duree", label: "Durée d'exécution (mois)", required: false },
    { field: "dateDebut", label: "Date de début", required: false },
    { field: "dateFin", label: "Date de fin", required: false },
    { field: "predecesseur", label: "Prédécesseur", required: false },
    { field: "successeur", label: "Successeur", required: false },
    { field: "unite", label: "Unité", required: false },
    { field: "quantite", label: "Quantité", required: false },
    { field: "prixUnitaire", label: "Prix unitaire", required: false },
  ],
};

export function FileImportModal({ isOpen, onClose, onImport, importType }: Props) {
  const [step, setStep] = useState<"upload" | "calibrate" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [feuilles, setFeuilles] = useState<string[]>([]);
  const [feuille, setFeuille] = useState<string>("");
  const [ligneEntetes, setLigneEntetes] = useState(0);
  const [rawData, setRawData] = useState<any[][]>([]);
  /** Feuille d'origine de chaque ligne, alignée sur rawData. */
  const [origines, setOrigines] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  /**
   * Ligne au-dessus des en-têtes. Un devis d'EDC présente plusieurs blocs de
   * prix côte à côte — « Base », « Proposition finale (EDC) » — dont les
   * colonnes portent exactement les mêmes intitulés. Sans ce surtitre, les
   * deux « Quantité » sont indiscernables dans la liste.
   */
  const [surEntetes, setSurEntetes] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    parseExcelFile(selectedFile);
  };

  const lignesDe = (wb: XLSX.WorkBook, nom: string) =>
    XLSX.utils.sheet_to_json(wb.Sheets[nom], { header: 1 }) as LigneExcel[];

  /**
   * Relit le classeur pour la feuille et la ligne d'en-têtes choisies. Sur
   * « toutes les feuilles », chaque feuille apporte ses lignes et donne son nom
   * à la série ; les en-têtes sont ceux de la première.
   */
  const recharger = (wb: XLSX.WorkBook, choix: string, entetes: number) => {
    const noms = choix === TOUTES ? wb.SheetNames : [choix];
    const utile = (row: LigneExcel = []) =>
      row.some((c) => c !== null && c !== undefined && String(c).trim() !== "");

    const lignes: LigneExcel[] = [];
    const sources: string[] = [];
    for (const nom of noms) {
      for (const row of lignesDe(wb, nom).slice(entetes + 1)) {
        if (!utile(row)) continue;
        lignes.push(row);
        sources.push(nom);
      }
    }

    const feuilleRef = lignesDe(wb, noms[0]);
    setHeaders((feuilleRef[entetes] ?? []).map((h) => String(h ?? "")));
    setSurEntetes(entetes > 0 ? (feuilleRef[entetes - 1] ?? []).map((h) => String(h ?? "")) : []);
    setRawData(lignes);
    setOrigines(sources);
  };

  const changerFeuille = (choix: string) => {
    setFeuille(choix);
    if (!workbook) return;
    // Chaque feuille peut avoir son propre cartouche : on redétecte.
    const entetes = ligneEntetesProbable(lignesDe(workbook, choix === TOUTES ? workbook.SheetNames[0] : choix));
    setLigneEntetes(entetes);
    recharger(workbook, choix, entetes);
  };

  const changerLigneEntetes = (index: number) => {
    setLigneEntetes(index);
    if (workbook) recharger(workbook, feuille, index);
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        if (!wb.SheetNames.length) {
          alert("Le fichier est vide");
          return;
        }

        const premiere = wb.SheetNames[0];
        const entetes = ligneEntetesProbable(lignesDe(wb, premiere));

        setWorkbook(wb);
        setFeuilles(wb.SheetNames);
        setFeuille(premiere);
        setLigneEntetes(entetes);
        recharger(wb, premiere, entetes);
        setMappings(COLUMN_MAPPINGS[importType].map((m) => ({ ...m, columnIndex: null })));
        setStep("calibrate");
      } catch (error) {
        console.error("Erreur parsing Excel:", error);
        alert("Erreur lors de la lecture du fichier");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (fieldIndex: number, columnIndex: number) => {
    setMappings(
      mappings.map((m, i) => {
        if (i === fieldIndex) {
          return { ...m, columnIndex: columnIndex === -1 ? null : columnIndex };
        }
        return m;
      })
    );
  };

  /**
   * Bloc auquel appartient une colonne : la dernière valeur non vide du
   * surtitre, à cette colonne ou avant. C'est ainsi que se lisent les cellules
   * fusionnées d'un tableur, qui ne remplissent que leur première colonne.
   */
  const blocDe = (colIndex: number): string => {
    for (let i = colIndex; i >= 0; i--) {
      const valeur = (surEntetes[i] ?? "").trim();
      if (valeur) return valeur;
    }
    return "";
  };

  const validateMappings = (): boolean => {
    const requiredMappings = mappings.filter((m) => m.required);
    return requiredMappings.every((m) => m.columnIndex !== null);
  };

  const handlePreview = () => {
    if (!validateMappings()) {
      alert("Veuillez mapper tous les champs obligatoires");
      return;
    }

    // Transformer les données selon le mapping
    const transformed = rawData
      .map((row, indexLigne) => {
        // La feuille d'origine suit la ligne : c'est elle qui nomme la série.
        const obj: any = { __feuille: origines[indexLigne] };
        mappings.forEach((mapping) => {
          if (mapping.columnIndex !== null) {
            const value = row[mapping.columnIndex];
            // Conversion selon le type
            if (mapping.field === "ponderation" || mapping.field === "delai" || mapping.field === "duree" || mapping.field === "delaiJours" || mapping.field === "ordre") {
              obj[mapping.field] = value ? parseInt(value) || 0 : undefined;
            } else if (mapping.field === "quantite" || mapping.field === "prixUnitaire") {
              obj[mapping.field] = value ? parseFloat(value) || 0 : undefined;
            } else if (mapping.field === "dateDebut" || mapping.field === "dateFin") {
              // Gérer les dates Excel (nombre de jours depuis 1900)
              if (typeof value === 'number') {
                const date = XLSX.SSF.parse_date_code(value);
                obj[mapping.field] = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } else if (value) {
                obj[mapping.field] = value;
              }
            } else {
              obj[mapping.field] = value || "";
            }
          }
        });
        // Ajouter le statut par défaut pour les livrables
        if (importType === "etude" || importType === "execution") {
          obj.statut = "en_attente";
        }
        return obj;
      });

    setPreviewData(transformed);
    setStep("preview");
  };

  const handleConfirmImport = () => {
    console.log("🔄 Confirmation de l'import...");
    console.log("📊 Données à importer:", previewData);
    
    const calibrage: Record<string, number> = {};
    mappings.forEach((m) => {
      if (m.columnIndex !== null) {
        calibrage[m.field] = m.columnIndex;
      }
    });

    console.log("🗺️ Calibrage:", calibrage);
    console.log("✅ Appel de onImport avec", previewData.length, "éléments");
    
    onImport(previewData, calibrage);
    
    console.log("🚪 Fermeture du modal");
    handleClose();
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setWorkbook(null);
    setFeuilles([]);
    setFeuille("");
    setLigneEntetes(0);
    setRawData([]);
    setOrigines([]);
    setHeaders([]);
    setSurEntetes([]);
    setMappings([]);
    setPreviewData([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileSpreadsheet size={20} />
              Import de fichier Excel
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">
              {step === "upload" && "Sélectionnez un fichier Excel (.xlsx, .xls)"}
              {step === "calibrate" && "Mappez les colonnes de votre fichier"}
              {step === "preview" && "Vérifiez les données avant import"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[var(--bg-inset)] rounded-[var(--radius-md)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-[var(--radius-lg)] border border-primary/20 bg-primary-subtle">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-primary-fg" />
                <div className="text-[12px] leading-relaxed text-primary-fg">
                  <strong>Format attendu :</strong> une ligne d&apos;en-têtes, puis les données. Si le fichier
                  commence par un cartouche, vous indiquerez à l&apos;étape suivante à quelle ligne se trouvent les
                  en-têtes - et, pour un classeur à plusieurs feuilles, laquelle importer.
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-default)] rounded-[var(--radius-lg)] p-12 text-center hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all cursor-pointer"
              >
                <Upload size={48} className="mx-auto mb-4 text-[var(--text-tertiary)]" />
                <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                  Cliquez pour sélectionner un fichier
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Formats supportés : .xlsx, .xls
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Calibrate */}
          {step === "calibrate" && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-[var(--radius-lg)] border border-warning/20 bg-warning-subtle">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-warning" />
                <div className="text-[12px] leading-relaxed text-warning">
                  <strong>Calibrage des colonnes :</strong> Indiquez quelle colonne de votre fichier correspond
                  à chaque champ requis. Les champs marqués d'un * sont obligatoires.
                </div>
              </div>

              <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-4">
                <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                  Fichier : {file?.name}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {rawData.length} ligne(s) de données • {headers.length} colonne(s)
                </div>

                <div className="mt-3 flex flex-wrap gap-4">
                  {feuilles.length > 1 && (
                    <label className="flex items-center gap-2 text-[11px]">
                      <span className="font-semibold text-[var(--text-secondary)]">Feuille</span>
                      <select
                        value={feuille}
                        onChange={(e) => changerFeuille(e.target.value)}
                        className="px-2 py-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[11px]"
                      >
                        {feuilles.map((nom) => (
                          <option key={nom} value={nom}>
                            {nom}
                          </option>
                        ))}
                        <option value={TOUTES}>Toutes les feuilles ({feuilles.length})</option>
                      </select>
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-[11px]">
                    <span className="font-semibold text-[var(--text-secondary)]">Ligne des en-têtes</span>
                    <input
                      type="number"
                      min={1}
                      value={ligneEntetes + 1}
                      onChange={(e) => changerLigneEntetes(Math.max(0, (parseInt(e.target.value) || 1) - 1))}
                      className="w-16 px-2 py-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] text-[11px]"
                    />
                  </label>
                </div>

                {headers.length > 0 && (
                  <div className="mt-2 text-[10px] text-[var(--text-tertiary)] truncate" title={headers.join(" | ")}>
                    En-têtes lus : {headers.filter(Boolean).join(" | ") || "(ligne vide - corrigez le numéro de ligne)"}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div
                    key={mapping.field}
                    className="flex items-center gap-4 p-3 bg-[var(--bg-inset)] rounded-[var(--radius-md)] border border-[var(--border-default)]"
                  >
                    <div className="flex-1">
                      <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {mapping.label}
                        {mapping.required && <span className="ml-1 text-danger">*</span>}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        Champ : {mapping.field}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
                    <select
                      value={mapping.columnIndex ?? -1}
                      onChange={(e) => handleMappingChange(index, parseInt(e.target.value))}
                      className="w-64 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                    >
                      <option value={-1}>-- Sélectionnez une colonne --</option>
                      {headers.map((header, colIndex) => (
                        <option key={colIndex} value={colIndex}>
                          {lettreColonne(colIndex)} · {blocDe(colIndex) ? `${blocDe(colIndex)} · ` : ""}
                          {header || "(vide)"}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-[var(--radius-lg)] border border-success/20 bg-success-subtle">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
                <div className="text-[12px] leading-relaxed text-success">
                  <strong>Aperçu des données :</strong> Vérifiez que les données sont correctement importées
                  avant de confirmer. {previewData.length} élément(s) seront importés.
                </div>
              </div>

              <div className="overflow-x-auto border border-[var(--border-default)] rounded-[var(--radius-md)]">
                <table className="w-full text-[11px]">
                  <thead className="bg-[var(--bg-inset)] border-b border-[var(--border-default)]">
                    <tr>
                      {mappings
                        .filter((m) => m.columnIndex !== null)
                        .map((m) => (
                          <th
                            key={m.field}
                            className="px-3 py-2 text-left font-bold text-[var(--text-tertiary)] uppercase tracking-wider"
                          >
                            {m.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {previewData.slice(0, 10).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-[var(--bg-surface-hover)]">
                        {mappings
                          .filter((m) => m.columnIndex !== null)
                          .map((m) => (
                            <td
                              key={m.field}
                              className="px-3 py-2 text-[var(--text-secondary)]"
                            >
                              {row[m.field] || "—"}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewData.length > 10 && (
                <p className="text-[10px] text-[var(--text-tertiary)] text-center">
                  ... et {previewData.length - 10} autre(s) ligne(s)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-[var(--border-default)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] rounded-[var(--radius-md)] transition-colors"
          >
            Annuler
          </button>

          <div className="flex items-center gap-2">
            {step === "calibrate" && (
              <button
                onClick={() => setStep("upload")}
                className="px-4 py-2 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] rounded-[var(--radius-md)] transition-colors"
              >
                Retour
              </button>
            )}
            {step === "preview" && (
              <button
                onClick={() => setStep("calibrate")}
                className="px-4 py-2 text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] rounded-[var(--radius-md)] transition-colors"
              >
                Retour
              </button>
            )}

            {step === "calibrate" && (
              <button
                onClick={handlePreview}
                disabled={!validateMappings()}
                className="px-4 py-2 bg-[var(--primary)] text-on-primary text-[13px] font-semibold rounded-[var(--radius-md)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aperçu
              </button>
            )}

            {step === "preview" && (
              <button
                onClick={handleConfirmImport}
                className="rounded-md border border-primary bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
              >
                Confirmer l'import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

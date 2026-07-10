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
  importType: "etude" | "passation" | "execution";
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
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    parseExcelFile(selectedFile);
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        if (jsonData.length === 0) {
          alert("Le fichier est vide");
          return;
        }

        // Première ligne = headers
        const fileHeaders = jsonData[0].map((h: any) => String(h || ""));
        const dataRows = jsonData.slice(1);

        setHeaders(fileHeaders);
        setRawData(dataRows);

        // Initialiser les mappings
        const initialMappings = COLUMN_MAPPINGS[importType].map((m) => ({
          ...m,
          columnIndex: null,
        }));
        setMappings(initialMappings);

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
      .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
      .map((row) => {
        const obj: any = {};
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
    setRawData([]);
    setHeaders([]);
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
              <div className="flex gap-3 p-4 rounded-[var(--radius-lg)] bg-blue-500/10 border border-blue-500/20">
                <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-blue-600 dark:text-blue-400 leading-relaxed">
                  <strong>Format attendu :</strong> La première ligne doit contenir les en-têtes de colonnes.
                  Les données commencent à la ligne 2. Vous pourrez mapper les colonnes à l'étape suivante.
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-default)] rounded-[var(--radius-lg)] p-12 text-center hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all cursor-pointer"
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
              <div className="flex gap-3 p-4 rounded-[var(--radius-lg)] bg-amber-500/10 border border-amber-500/20">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-amber-600 dark:text-amber-400 leading-relaxed">
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
                        {mapping.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        Champ : {mapping.field}
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
                    <select
                      value={mapping.columnIndex ?? -1}
                      onChange={(e) => handleMappingChange(index, parseInt(e.target.value))}
                      className="w-64 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      <option value={-1}>-- Sélectionnez une colonne --</option>
                      {headers.map((header, colIndex) => (
                        <option key={colIndex} value={colIndex}>
                          Colonne {colIndex + 1}: {header || "(vide)"}
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
              <div className="flex gap-3 p-4 rounded-[var(--radius-lg)] bg-green-500/10 border border-green-500/20">
                <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                <div className="text-[12px] text-green-600 dark:text-green-400 leading-relaxed">
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
                className="px-4 py-2 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[var(--radius-md)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aperçu
              </button>
            )}

            {step === "preview" && (
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-green-600 text-white text-[13px] font-semibold rounded-[var(--radius-md)] hover:bg-green-700 transition-colors"
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

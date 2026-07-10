"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Hammer, AlertCircle, Upload } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import { usePermissions } from "@/hooks/usePermissions";

interface TacheExecution {
  numero: string;
  designation: string;
  ponderation: number;
  delai?: number;
  delaiUnite?: 'jours' | 'semaines' | 'mois';
  duree?: number;
  dureeUnite?: 'jours' | 'semaines' | 'mois';
  dateDebut?: string;
  dateFin?: string;
  dateEcheance?: Date;
  description?: string;
  predecesseur?: string;
  successeur?: string;
  statut?: "en_attente" | "soumis" | "valide" | "rejete";
}

// Convertir une durée en jours selon l'unité
const dureeToDays = (value: number, unite: string = 'jours'): number => {
  if (unite === 'semaines') return value * 7;
  if (unite === 'mois') return value * 30;
  return value; // jours
};

interface ExecutionData {
  tachesExecution: TacheExecution[]; // changed from livrables
}

interface Props {
  data: ExecutionData | null;
  onChange: (data: ExecutionData) => void;
  dateT0: string; // Date T0 vient du parent
  projectId?: string;
}

export function PlanningFormExecution({ data, onChange, dateT0, projectId }: Props) {
  const { can, isView } = usePermissions(projectId);
  const [taches, setTaches] = useState<TacheExecution[]>(
    data?.tachesExecution || [
      { numero: "T1", designation: "", ponderation: 0, duree: 1, dureeUnite: "jours", delaiUnite: "jours", statut: "en_attente", predecesseur: "" },
    ]
  );
  const [showImportModal, setShowImportModal] = useState(false);

  // Mettre à jour les tâches quand les données changent
  useEffect(() => {
    if (data?.tachesExecution && data.tachesExecution.length > 0) {
      setTaches(data.tachesExecution);
    } else if (data?.tachesExecution && data.tachesExecution.length === 0) {
      setTaches([
        { numero: "T1", designation: "", ponderation: 0, duree: 1, dureeUnite: "jours", delaiUnite: "jours", statut: "en_attente", predecesseur: "" },
      ]);
    }
  }, [data]);

  const notifyChange = (newTaches: TacheExecution[]) => {
    const updated = newTaches.map((t) => calculateDatesForTache(t));
    onChange({ tachesExecution: updated }); // changed
  };

  const addTache = () => {
    const nextNum = `T${taches.length + 1}`;
    const newTaches: TacheExecution[] = [
      ...taches,
      { numero: nextNum, designation: "", ponderation: 0, duree: 1, dureeUnite: "jours", delaiUnite: "jours", statut: "en_attente" as const, predecesseur: "", successeur: "" },
    ];
    setTaches(newTaches);
    notifyChange(newTaches);
  };

  const removeTache = (index: number) => {
    const removed = taches[index];
    const updated = taches.filter((_, i) => i !== index);
    
    const cleaned = updated.map(t => ({
      ...t,
      predecesseur: t.predecesseur === removed.numero ? "" : t.predecesseur,
      successeur: t.successeur === removed.numero ? "" : t.successeur,
    }));
    
    setTaches(cleaned);
    notifyChange(cleaned);
  };

  const updateTache = (index: number, field: keyof TacheExecution, value: any) => {
    const newTaches = taches.map((t, i) => {
      if (i !== index) return t;
      return { ...t, [field]: value };
    });
    
    const recalculated = recalculateAllTaches(newTaches);
    setTaches(recalculated);
    notifyChange(recalculated);
  };

  const recalculateAllTaches = (items: TacheExecution[]): TacheExecution[] => {
    const result = [...items];
    const map = new Map<string, TacheExecution>();

    result.forEach(t => {
      if (t.numero) map.set(t.numero, t);
    });

    result.forEach((tache, idx) => {
      if (tache.predecesseur) {
        const pred = map.get(tache.predecesseur);
        if (pred && pred.dateFin) {
          tache.dateDebut = pred.dateFin;
        }
      }

      result[idx] = calculateDatesForTache(tache);

      if (tache.numero) map.set(tache.numero, result[idx]);

      if (tache.predecesseur) {
        const predIndex = result.findIndex(t => t.numero === tache.predecesseur);
        if (predIndex !== -1 && !result[predIndex].successeur) {
          result[predIndex].successeur = tache.numero;
        }
      }
    });

    return result;
  };

  const calculateDatesForTache = (tache: TacheExecution): TacheExecution => {
    const result = { ...tache };
    if (!dateT0) return result;

    if (result.predecesseur) {
      const pred = taches.find((t) => t.numero === result.predecesseur);
      if (pred && pred.dateFin) {
        result.dateDebut = pred.dateFin;
      }
    }

    if (result.dateDebut && result.duree && !result.dateFin) {
      const dateFin = new Date(result.dateDebut);
      const days = dureeToDays(result.duree, result.dureeUnite || 'jours');
      dateFin.setDate(dateFin.getDate() + days);
      result.dateFin = dateFin.toISOString().split("T")[0];
      result.dateEcheance = dateFin;
    }

    if (result.dateDebut && result.dateFin && !result.duree) {
      const debut = new Date(result.dateDebut);
      const fin = new Date(result.dateFin);
      const diffDays = Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
      const unite = result.dureeUnite || 'jours';
      if (unite === 'jours') result.duree = Math.max(0, diffDays);
      else if (unite === 'semaines') result.duree = Math.max(0, Math.round(diffDays / 7));
      else result.duree = Math.max(0, Math.round(diffDays / 30));
      result.dateEcheance = fin;
    }

    if (result.delai && !result.dateEcheance) {
      const echeance = new Date(dateT0);
      const days = dureeToDays(result.delai, result.delaiUnite || 'jours');
      echeance.setDate(echeance.getDate() + days);
      result.dateEcheance = echeance;
    }

    if (result.dateFin) {
      result.dateEcheance = new Date(result.dateFin);
    }

    if (result.dateEcheance && !result.delai) {
      const t0 = new Date(dateT0);
      const echeance = new Date(result.dateEcheance);
      const diffDays = Math.round((echeance.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
      const unite = result.delaiUnite || 'jours';
      if (unite === 'jours') result.delai = Math.max(0, diffDays);
      else if (unite === 'semaines') result.delai = Math.max(0, Math.round(diffDays / 7));
      else result.delai = Math.max(0, Math.round(diffDays / 30));
    }

    return result;
  };

  const formatDate = (date?: string | Date): string => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const totalPonderation = taches.reduce((sum, t) => sum + (t.ponderation || 0), 0);
  const isValidPonderation = totalPonderation === 100;

  const handleImport = (importedData: any[]) => {
    const imported = importedData.map((row) => ({
      numero: row.numero || "",
      designation: row.designation || row.intitule || "",
      ponderation: row.ponderation || 0,
      delai: row.delai,
      duree: row.duree,
      dateDebut: row.dateDebut || "",
      dateFin: row.dateFin || "",
      dateEcheance: row.dateEcheance,
      predecesseur: row.predecesseur || "",
      successeur: row.successeur || "",
      description: row.description || "",
      statut: "en_attente" as const,
    }));
    
    setTaches(imported);
    notifyChange(imported);
  };

  return (
    <>
      <FileImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        importType="execution"
      />

      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Hammer size={16} />
            Planification Exécution
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Définissez les tâches d'exécution avec leur pondération et délais. Tableau style MS Project.
          </p>
        </div>

        <div className="p-5 space-y-5">
          {isView && (
            <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                <strong>Mode lecture seule :</strong> Vous ne pouvez pas modifier la planification. Seul le chef de projet peut effectuer des modifications.
              </div>
            </div>
          )}

          <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-600 dark:text-blue-400">
              <strong>Date T0 :</strong> {dateT0 ? new Date(dateT0).toLocaleDateString("fr-FR") : "Non définie"} (définie dans Informations Générales)
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--bg-inset)] rounded-[var(--radius-md)] border border-[var(--border-default)]">
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Total Pondération
            </span>
            <div
              className={`px-3 py-1 rounded-[var(--radius-sm)] text-[11px] font-bold ${
                isValidPonderation
                  ? "bg-green-500/10 text-green-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {totalPonderation}% {isValidPonderation ? "✓ Valide" : "⚠ Doit être 100%"}
            </div>
          </div>

          <div className="border-2 border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="grid grid-cols-[60px_1fr_80px_120px_120px_120px_120px_60px_60px_80px] bg-[var(--bg-inset)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">N°</div>
              <div className="px-2 py-2 border-r border-b-2 border-[var(--border-default)]">Désignation de la tâche</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Pond. (%)</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Délai</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Durée</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Date début</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Échéance</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Préd.</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Succ.</div>
              <div className="px-2 py-2 text-center border-b-2 border-[var(--border-default)]">Actions</div>
            </div>

            <div>
              {taches.map((tache, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[60px_1fr_80px_120px_120px_120px_120px_60px_60px_80px] hover:bg-[var(--bg-surface-hover)] transition-colors text-[12px]"
                >
                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={tache.numero}
                      onChange={(e) => updateTache(index, "numero", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[11px] font-bold text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="T1"
                    />
                  </div>

                  <div className="px-2 py-2 flex items-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={tache.designation}
                      onChange={(e) => updateTache(index, "designation", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[12px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Désignation..."
                    />
                  </div>

                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tache.ponderation || ""}
                      onChange={(e) => updateTache(index, "ponderation", parseFloat(e.target.value) || 0)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[11px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="20"
                    />
                  </div>

                  <div className="px-1 py-2 flex items-center gap-1 border-r border-b border-[var(--border-default)]">
                    <input
                      type="number"
                      min="0"
                      value={tache.delai || ""}
                      onChange={(e) => updateTache(index, "delai", parseInt(e.target.value) || undefined)}
                      disabled={isView || (!!tache.dateEcheance && !tache.delai)}
                      className="w-[45px] px-1 py-1 bg-transparent text-[11px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      placeholder="1"
                    />
                    <select
                      value={tache.delaiUnite || 'jours'}
                      onChange={(e) => updateTache(index, "delaiUnite", e.target.value)}
                      disabled={isView}
                      className="w-[65px] px-0.5 py-1 bg-transparent text-[9px] focus:outline-none focus:bg-[var(--bg-inset)] rounded border border-[var(--border-subtle)] disabled:opacity-50"
                    >
                      <option value="jours">jours</option>
                      <option value="semaines">semaines</option>
                      <option value="mois">mois</option>
                    </select>
                  </div>

                  <div className="px-1 py-2 flex items-center gap-1 border-r border-b border-[var(--border-default)]">
                    <input
                      type="number"
                      min="0"
                      value={tache.duree || ""}
                      onChange={(e) => updateTache(index, "duree", parseInt(e.target.value) || undefined)}
                      disabled={isView || (!!tache.dateDebut && !!tache.dateFin && !tache.duree)}
                      className="w-[45px] px-1 py-1 bg-transparent text-[11px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      placeholder="1"
                    />
                    <select
                      value={tache.dureeUnite || 'jours'}
                      onChange={(e) => updateTache(index, "dureeUnite", e.target.value)}
                      disabled={isView}
                      className="w-[65px] px-0.5 py-1 bg-transparent text-[9px] focus:outline-none focus:bg-[var(--bg-inset)] rounded border border-[var(--border-subtle)] disabled:opacity-50"
                    >
                      <option value="jours">jours</option>
                      <option value="semaines">semaines</option>
                      <option value="mois">mois</option>
                    </select>
                  </div>

                  <div className="px-2 py-2 flex items-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="date"
                      value={tache.dateDebut || ""}
                      onChange={(e) => updateTache(index, "dateDebut", e.target.value)}
                      disabled={isView || !!tache.predecesseur}
                      className="w-full px-1 py-1 bg-transparent text-[10px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                    />
                  </div>

                  <div className="px-2 py-2 flex items-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="date"
                      value={tache.dateFin || ""}
                      onChange={(e) => updateTache(index, "dateFin", e.target.value)}
                      disabled={isView || (!!tache.dateDebut && !!tache.duree)}
                      className="w-full px-1 py-1 bg-transparent text-[10px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      placeholder={formatDate(tache.dateEcheance)}
                    />
                  </div>

                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={tache.predecesseur || ""}
                      onChange={(e) => updateTache(index, "predecesseur", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[10px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="T1"
                    />
                  </div>

                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={tache.successeur || ""}
                      onChange={(e) => updateTache(index, "successeur", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[10px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="T3"
                    />
                  </div>

                  <div className="px-2 py-2 flex items-center justify-center border-b border-[var(--border-default)]">
                    {can("structure:edit") && (
                      <button
                        onClick={() => removeTache(index)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="px-3 py-2 bg-[var(--bg-inset)]/30 border-t border-[var(--border-default)]">
                {can("structure:edit") && (
                  <button
                    onClick={addTache}
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-md)] transition-colors"
                  >
                    <Plus size={14} />
                    Ajouter une tâche
                  </button>
                )}
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

          {/* Aide */}
          <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
              <strong>Calculs intelligents automatiques :</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li><strong>Délai</strong> : Temps depuis T0 jusqu'à l'échéance (ex: T0 + 3 mois = échéance)</li>
                <li><strong>Durée</strong> : Temps d'exécution du livrable (ex: début + 1 mois = fin)</li>
                <li><strong>Prédécesseur</strong> : Si renseigné, la date de début est calculée automatiquement (= date fin du prédécesseur)</li>
                <li><strong>Successeur</strong> : Synchronisé automatiquement quand vous définissez un prédécesseur</li>
                <li><strong>Date fin</strong> : Calculée automatiquement si vous renseignez Date début + Durée (grisée)</li>
                <li><strong>Durée</strong> : Calculée automatiquement si vous renseignez Date début + Date fin (grisée)</li>
                <li><strong>Délai</strong> : Calculé automatiquement si vous renseignez l'échéance (grisé)</li>
                <li><strong>Parallèle</strong> : Laissez "Préd." vide → Commence à la date T0 ou date de début saisie</li>
                <li><strong>Série</strong> : Indiquez le prédécesseur (ex: R1) → Commence après R1 automatiquement</li>
              </ul>
            </div>
          </div>

          {/* Alerte pondération */}
          {!isValidPonderation && taches.length > 0 && (
            <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                <strong>Attention :</strong> La somme des pondérations doit être égale à 100%. Actuellement : {totalPonderation}%
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

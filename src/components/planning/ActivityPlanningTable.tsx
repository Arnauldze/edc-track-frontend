"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, AlertCircle, CheckCircle } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Livrable {
  numero: string;
  intitule: string;
  ponderation: number;
  dateDebut?: string;
  dateFin?: string;
  duree?: number;
  delai?: number;
  dateEcheance?: string;
  predecesseur?: string;
  successeur?: string;
  description?: string;
  statut?: string;
}

interface ActivityPlanningTableProps {
  activityPath: string;
  activityName: string;
  dateT0?: string; // Date de référence T0
  livrables: Livrable[];
  onSave: (livrables: Livrable[]) => Promise<void>;
  readOnly?: boolean;
}

interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const calculateMonthsDiff = (start: Date, end: Date): number => {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  return Math.max(0, months);
};

// ─── Composant Principal ───────────────────────────────────────────────────

export function ActivityPlanningTable({
  activityPath,
  activityName,
  dateT0,
  livrables: initialLivrables,
  onSave,
  readOnly = false,
}: ActivityPlanningTableProps) {
  const [livrables, setLivrables] = useState<Livrable[]>(initialLivrables);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Calculs Automatiques ──────────────────────────────────────────────

  const recalculateLivrable = useCallback((livrable: Livrable): Livrable => {
    const result = { ...livrable };

    // Calcul de la date de fin si date début + durée sont présents
    if (result.dateDebut && result.duree !== undefined && !result.dateFin) {
      const debut = parseDate(result.dateDebut);
      if (debut) {
        result.dateFin = addMonths(debut, result.duree).toISOString().split('T')[0];
      }
    }

    // Calcul de la durée si date début + date fin sont présents
    if (result.dateDebut && result.dateFin && result.duree === undefined) {
      const debut = parseDate(result.dateDebut);
      const fin = parseDate(result.dateFin);
      if (debut && fin) {
        result.duree = calculateMonthsDiff(debut, fin);
      }
    }

    // Calcul de l'échéance si T0 + délai sont présents
    if (dateT0 && result.delai !== undefined) {
      const t0 = parseDate(dateT0);
      if (t0) {
        result.dateEcheance = addMonths(t0, result.delai).toISOString().split('T')[0];
      }
    }

    return result;
  }, [dateT0]);

  const recalculateAll = useCallback((items: Livrable[]): Livrable[] => {
    const result = [...items];
    const livrableMap = new Map<string, Livrable>();

    // Créer une map pour accès rapide
    result.forEach(liv => {
      if (liv.numero) {
        livrableMap.set(liv.numero, liv);
      }
    });

    // Recalculer chaque livrable
    result.forEach((livrable, index) => {
      // Si un prédécesseur est défini, calculer la date de début
      if (livrable.predecesseur) {
        const pred = livrableMap.get(livrable.predecesseur);
        if (pred && pred.dateFin) {
          livrable.dateDebut = pred.dateFin;
        }
      }

      // Recalculer les champs
      result[index] = recalculateLivrable(livrable);

      // Mettre à jour la map
      if (livrable.numero) {
        livrableMap.set(livrable.numero, result[index]);
      }

      // Synchroniser le successeur
      if (livrable.predecesseur) {
        const predIndex = result.findIndex(l => l.numero === livrable.predecesseur);
        if (predIndex !== -1 && !result[predIndex].successeur) {
          result[predIndex].successeur = livrable.numero;
        }
      }
    });

    return result;
  }, [recalculateLivrable]);

  // ─── Validation ────────────────────────────────────────────────────────

  const validateLivrables = useCallback((items: Livrable[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Vérifier la somme des pondérations
    const totalPonderation = items.reduce((sum, liv) => sum + (liv.ponderation || 0), 0);
    if (Math.abs(totalPonderation - 100) > 0.01) {
      errors.push({
        rowIndex: -1,
        field: 'ponderation',
        message: `La somme des pondérations est ${totalPonderation.toFixed(1)}% au lieu de 100%`,
      });
    }

    // Vérifier chaque livrable
    items.forEach((liv, index) => {
      // Vérifier que la date de fin est après la date de début
      if (liv.dateDebut && liv.dateFin) {
        const debut = parseDate(liv.dateDebut);
        const fin = parseDate(liv.dateFin);
        if (debut && fin && fin < debut) {
          errors.push({
            rowIndex: index,
            field: 'dateFin',
            message: 'La date de fin doit être après la date de début',
          });
        }
      }

      // Vérifier la cohérence entre échéance et date de fin
      if (liv.dateEcheance && liv.dateFin) {
        const echeance = parseDate(liv.dateEcheance);
        const dateFin = parseDate(liv.dateFin);
        if (echeance && dateFin && dateFin > echeance) {
          errors.push({
            rowIndex: index,
            field: 'dateFin',
            message: `La date de fin dépasse l'échéance (${formatDate(liv.dateEcheance)})`,
          });
        }
      }

      // Vérifier que le prédécesseur existe
      if (liv.predecesseur) {
        const predExists = items.some(l => l.numero === liv.predecesseur);
        if (!predExists) {
          errors.push({
            rowIndex: index,
            field: 'predecesseur',
            message: `Le prédécesseur "${liv.predecesseur}" n'existe pas`,
          });
        }
      }
    });

    return errors;
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleCellChange = (rowIndex: number, field: keyof Livrable, value: any) => {
    const newLivrables = [...livrables];
    
    // Convertir la valeur selon le type de champ
    if (field === 'ponderation' || field === 'duree' || field === 'delai') {
      (newLivrables[rowIndex] as any)[field] = value ? parseFloat(value) : (field === 'ponderation' ? 0 : undefined);
    } else {
      (newLivrables[rowIndex] as any)[field] = value || undefined;
    }

    // Recalculer tous les livrables
    const recalculated = recalculateAll(newLivrables);
    setLivrables(recalculated);
    setHasChanges(true);

    // Valider
    const errors = validateLivrables(recalculated);
    setValidationErrors(errors);
  };

  const handleAddRow = () => {
    const newNumero = `R${livrables.length + 1}`;
    const newLivrable: Livrable = {
      numero: newNumero,
      intitule: '',
      ponderation: 0,
    };
    setLivrables([...livrables, newLivrable]);
    setHasChanges(true);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (!confirm('Supprimer ce livrable ?')) return;
    const newLivrables = livrables.filter((_, index) => index !== rowIndex);
    const recalculated = recalculateAll(newLivrables);
    setLivrables(recalculated);
    setHasChanges(true);
    setValidationErrors(validateLivrables(recalculated));
  };

  const handleSave = async () => {
    const errors = validateLivrables(livrables);
    if (errors.length > 0) {
      alert('Veuillez corriger les erreurs avant de sauvegarder');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(livrables);
      setHasChanges(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!confirm('Annuler toutes les modifications ?')) return;
    setLivrables(initialLivrables);
    setHasChanges(false);
    setValidationErrors([]);
  };

  // ─── Rendu des cellules ────────────────────────────────────────────────

  const renderCell = (livrable: Livrable, rowIndex: number, field: keyof Livrable) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === field;
    const value = livrable[field];
    const isCalculated = (field === 'dateFin' && livrable.dateDebut && livrable.duree) ||
                         (field === 'dateEcheance' && dateT0 && livrable.delai !== undefined);
    const hasError = validationErrors.some(e => e.rowIndex === rowIndex && e.field === field);

    if (readOnly || isCalculated) {
      let displayValue = value?.toString() || '—';
      if (field === 'dateDebut' || field === 'dateFin' || field === 'dateEcheance') {
        displayValue = formatDate(value as string) || '—';
      } else if (field === 'ponderation') {
        displayValue = value ? `${value}%` : '—';
      } else if (field === 'duree') {
        displayValue = value ? `${value} m` : '—';
      } else if (field === 'delai') {
        displayValue = value ? `${value} m` : '—';
      }

      return (
        <div
          className={`px-2 py-1 text-sm ${isCalculated ? 'bg-gray-50 text-gray-600 italic' : ''} ${hasError ? 'bg-red-50 text-red-600' : ''}`}
          style={{ minHeight: '32px', display: 'flex', alignItems: 'center' }}
        >
          {displayValue}
        </div>
      );
    }

    if (isEditing) {
      const inputType = (field === 'dateDebut' || field === 'dateFin') ? 'date'
        : (field === 'ponderation' || field === 'duree' || field === 'delai') ? 'number'
          : 'text';

      return (
        <input
          type={inputType}
          value={value?.toString() || ''}
          onChange={(e) => handleCellChange(rowIndex, field, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
          }}
          autoFocus
          className={`w-full px-2 py-1 text-sm border-2 border-blue-500 focus:outline-none ${hasError ? 'border-red-500' : ''}`}
          style={{ minHeight: '32px' }}
          step={inputType === 'number' ? '0.1' : undefined}
          min={inputType === 'number' ? '0' : undefined}
          max={(field === 'ponderation') ? '100' : undefined}
        />
      );
    }

    let displayValue = value?.toString() || '';
    if (field === 'dateDebut' || field === 'dateFin' || field === 'dateEcheance') {
      displayValue = formatDate(value as string);
    } else if (field === 'ponderation') {
      displayValue = value ? `${value}%` : '';
    } else if (field === 'duree') {
      displayValue = value ? `${value} m` : '';
    } else if (field === 'delai') {
      displayValue = value ? `${value} m` : '';
    }

    return (
      <div
        onClick={() => setEditingCell({ rowIndex, field })}
        className={`px-2 py-1 text-sm cursor-text hover:bg-blue-50 ${hasError ? 'bg-red-50 text-red-600' : ''}`}
        style={{ minHeight: '32px', display: 'flex', alignItems: 'center' }}
      >
        {displayValue || <span className="text-gray-400">Cliquer pour éditer</span>}
      </div>
    );
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────

  const totalPonderation = livrables.reduce((sum, liv) => sum + (liv.ponderation || 0), 0);
  const ponderationValid = Math.abs(totalPonderation - 100) < 0.01;

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{activityName}</h3>
          <p className="text-sm text-gray-600">{activityPath}</p>
          {dateT0 && (
            <p className="text-sm text-gray-600">
              Date T0 : <span className="font-medium">{formatDate(dateT0)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || validationErrors.length > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </>
          )}
          {!readOnly && (
            <button
              onClick={handleAddRow}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Alertes de validation */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Erreurs de validation</h4>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>
                    {error.rowIndex >= 0 ? `Ligne ${error.rowIndex + 1}: ` : ''}
                    {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Indicateur pondération */}
      <div className={`flex items-center gap-2 text-sm ${ponderationValid ? 'text-green-700' : 'text-orange-700'}`}>
        {ponderationValid ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
        <span>
          Total pondération : <strong>{totalPonderation.toFixed(1)}%</strong>
          {ponderationValid ? ' ✓' : ` (doit être 100%)`}
        </span>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-16">N°</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 min-w-[200px]">Nom du livrable</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Pond.</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-28">Date début</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-28">Date fin</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Durée</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-20">Délai</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-28">Échéance</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Préd.</th>
              <th className="px-2 py-2 text-left font-medium text-gray-700 w-24">Succ.</th>
              {!readOnly && <th className="px-2 py-2 w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {livrables.map((livrable, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border-r">{renderCell(livrable, index, 'numero')}</td>
                <td className="border-r">{renderCell(livrable, index, 'intitule')}</td>
                <td className="border-r">{renderCell(livrable, index, 'ponderation')}</td>
                <td className="border-r">{renderCell(livrable, index, 'dateDebut')}</td>
                <td className="border-r">{renderCell(livrable, index, 'dateFin')}</td>
                <td className="border-r">{renderCell(livrable, index, 'duree')}</td>
                <td className="border-r">{renderCell(livrable, index, 'delai')}</td>
                <td className="border-r">{renderCell(livrable, index, 'dateEcheance')}</td>
                <td className="border-r">{renderCell(livrable, index, 'predecesseur')}</td>
                <td className="border-r">{renderCell(livrable, index, 'successeur')}</td>
                {!readOnly && (
                  <td className="text-center">
                    <button
                      onClick={() => handleDeleteRow(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {livrables.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Aucun livrable. Cliquez sur "Ajouter" pour commencer.
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, AlertCircle, Upload, GripVertical } from "lucide-react";
import { FileImportModal } from "./FileImportModal";
import { usePermissions } from "@/hooks/usePermissions";

interface Livrable {
  numero: string;
  intitule: string;
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
const dureeToDays = (value: number, unite: string = 'mois'): number => {
  if (unite === 'semaines') return value * 7;
  if (unite === 'mois') return value * 30;
  return value; // jours
};

interface EtudeData {
  livrables: Livrable[];
}

interface Props {
  data: EtudeData | null;
  onChange: (data: EtudeData) => void;
  dateT0: string; // Date T0 vient du parent (Informations Générales)
  projectId?: string; // Ajout pour les permissions
}

export function PlanningFormEtude({ data, onChange, dateT0, projectId }: Props) {
  const { can, isView } = usePermissions(projectId);
  const [livrables, setLivrables] = useState<Livrable[]>(
    data?.livrables || [
      { numero: "R1", intitule: "", ponderation: 0, duree: 1, dureeUnite: "mois", delaiUnite: "mois", statut: "en_attente", predecesseur: "" },
    ]
  );
  const [showImportModal, setShowImportModal] = useState(false);

  // Mettre à jour les livrables quand les données changent
  useEffect(() => {
    console.log("🔄 PlanningFormEtude - Props data changed:", data);
    if (data?.livrables && data.livrables.length > 0) {
      console.log("🔄 Mise à jour des livrables depuis les props:", data.livrables);
      setLivrables(data.livrables);
    } else if (data?.livrables && data.livrables.length === 0) {
      // Si data existe mais livrables est vide, réinitialiser avec un livrable par défaut
      console.log("⚠️ Données vides, initialisation avec livrable par défaut");
      setLivrables([
        { numero: "R1", intitule: "", ponderation: 0, duree: 1, dureeUnite: "mois", delaiUnite: "mois", statut: "en_attente", predecesseur: "" },
      ]);
    }
  }, [data]);

  // Ne pas appeler onChange dans useEffect pour éviter les boucles infinies
  // À la place, on appelle onChange directement dans les fonctions qui modifient les livrables
  
  const notifyChange = (newLivrables: Livrable[]) => {
    const updatedLivrables = newLivrables.map((livrable) => {
      return calculateDatesForLivrable(livrable);
    });
    onChange({ livrables: updatedLivrables });
  };

  const addLivrable = () => {
    const nextNum = `R${livrables.length + 1}`;
    const newLivrables: Livrable[] = [
      ...livrables,
      { numero: nextNum, intitule: "", ponderation: 0, duree: 1, dureeUnite: "mois", delaiUnite: "mois", statut: "en_attente" as const, predecesseur: "", successeur: "" },
    ];
    setLivrables(newLivrables);
    notifyChange(newLivrables);
  };

  const removeLivrable = (index: number) => {
    const removed = livrables[index];
    const updated = livrables.filter((_, i) => i !== index);
    
    // Nettoyer les références au livrable supprimé
    const cleaned = updated.map(liv => ({
      ...liv,
      predecesseur: liv.predecesseur === removed.numero ? "" : liv.predecesseur,
      successeur: liv.successeur === removed.numero ? "" : liv.successeur,
    }));
    
    setLivrables(cleaned);
    notifyChange(cleaned);
  };

  const updateLivrable = (index: number, field: keyof Livrable, value: any) => {
    const newLivrables = livrables.map((l, i) => {
      if (i !== index) return l;
      return { ...l, [field]: value };
    });
    
    // Recalculer tous les livrables avec dépendances
    const recalculated = recalculateAllLivrables(newLivrables);
    setLivrables(recalculated);
    notifyChange(recalculated);
  };

  // Recalcul intelligent de tous les livrables
  const recalculateAllLivrables = (items: Livrable[]): Livrable[] => {
    const result = [...items];
    const livrableMap = new Map<string, Livrable>();

    // Créer une map pour accès rapide
    result.forEach(liv => {
      if (liv.numero) {
        livrableMap.set(liv.numero, liv);
      }
    });

    // Recalculer chaque livrable
    result.forEach((livrable, idx) => {
      // Si prédécesseur défini, calculer date de début
      if (livrable.predecesseur) {
        const pred = livrableMap.get(livrable.predecesseur);
        if (pred && pred.dateFin) {
          livrable.dateDebut = pred.dateFin;
        }
      }

      // Recalculer les champs
      result[idx] = calculateDatesForLivrable(livrable);

      // Mettre à jour la map
      if (livrable.numero) {
        livrableMap.set(livrable.numero, result[idx]);
      }

      // Synchroniser le successeur automatiquement
      if (livrable.predecesseur) {
        const predIndex = result.findIndex(l => l.numero === livrable.predecesseur);
        if (predIndex !== -1 && !result[predIndex].successeur) {
          result[predIndex].successeur = livrable.numero;
        }
      }
    });

    return result;
  };

  // Calcul intelligent des dates selon ce qui est rempli
  const calculateDatesForLivrable = (livrable: Livrable): Livrable => {
    const result = { ...livrable };
    
    if (!dateT0) return result;

    // Déterminer la date de début effective
    let dateDebutEffective = result.dateDebut ? new Date(result.dateDebut) : new Date(dateT0);

    // Si prédécesseur, la date de début vient de la fin du prédécesseur
    if (result.predecesseur) {
      const pred = livrables.find((l) => l.numero === result.predecesseur);
      if (pred && pred.dateFin) {
        dateDebutEffective = new Date(pred.dateFin);
        result.dateDebut = pred.dateFin;
      }
    }

    // Calcul 1: Date début + Durée → Date fin (calculée automatiquement)
    if (result.dateDebut && result.duree && !result.dateFin) {
      const dateFin = new Date(result.dateDebut);
      const days = dureeToDays(result.duree, result.dureeUnite || 'mois');
      dateFin.setDate(dateFin.getDate() + days);
      result.dateFin = dateFin.toISOString().split("T")[0];
      result.dateEcheance = dateFin;
    }

    // Calcul 2: Date début + Date fin → Durée (calculée automatiquement)
    if (result.dateDebut && result.dateFin && !result.duree) {
      const debut = new Date(result.dateDebut);
      const fin = new Date(result.dateFin);
      const diffDays = Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24));
      const unite = result.dureeUnite || 'mois';
      if (unite === 'jours') result.duree = Math.max(0, diffDays);
      else if (unite === 'semaines') result.duree = Math.max(0, Math.round(diffDays / 7));
      else result.duree = Math.max(0, Math.round(diffDays / 30));
      result.dateEcheance = fin;
    }

    // Calcul 3: T0 + Délai → Échéance (calculée automatiquement)
    if (result.delai && !result.dateEcheance) {
      const echeance = new Date(dateT0);
      const days = dureeToDays(result.delai, result.delaiUnite || 'mois');
      echeance.setDate(echeance.getDate() + days);
      result.dateEcheance = echeance;
    }

    // Calcul 4: Si date fin existe, mettre à jour l'échéance
    if (result.dateFin) {
      result.dateEcheance = new Date(result.dateFin);
    }

    // Calcul 5: Si échéance existe, calculer le délai depuis T0
    if (result.dateEcheance && !result.delai) {
      const t0 = new Date(dateT0);
      const echeance = new Date(result.dateEcheance);
      const diffDays = Math.round((echeance.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24));
      const unite = result.delaiUnite || 'mois';
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

  const totalPonderation = livrables.reduce((sum, l) => sum + (l.ponderation || 0), 0);
  const isValidPonderation = totalPonderation === 100;

  const handleImport = (importedData: any[], calibrage: Record<string, number>) => {
    console.log("📥 Import de", importedData.length, "livrables:", importedData);
    
    const imported = importedData.map((row) => ({
      numero: row.numero || "",
      intitule: row.intitule || "",
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
    
    console.log("✅ Livrables importés et transformés:", imported);
    setLivrables(imported);
    notifyChange(imported);
  };

  return (
    <>
      <FileImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        importType="etude"
      />

      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={16} />
            Planification Étude Préalable
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Définissez les livrables (rapports) avec leur pondération et délais. Tableau style MS Project.
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* Message d'avertissement pour mode View */}
          {isView && (
            <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-600 dark:text-amber-400">
                <strong>Mode lecture seule :</strong> Vous ne pouvez pas modifier la planification. Seul le chef de projet peut effectuer des modifications.
              </div>
            </div>
          )}

          {/* Info Date T0 */}
          <div className="flex gap-3 p-3 rounded-[var(--radius-md)] bg-blue-500/10 border border-blue-500/20">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-600 dark:text-blue-400">
              <strong>Date T0 :</strong> {dateT0 ? new Date(dateT0).toLocaleDateString("fr-FR") : "Non définie"} (définie dans Informations Générales)
            </div>
          </div>

          {/* Indicateur pondération */}
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

          {/* Tableau des livrables - Style Excel/MS Project avec bordures */}
          <div className="border-2 border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[60px_1fr_80px_120px_120px_120px_120px_60px_60px_80px] bg-[var(--bg-inset)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">N°</div>
              <div className="px-2 py-2 border-r border-b-2 border-[var(--border-default)]">Intitulé du livrable</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Pond. (%)</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Délai</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Durée</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Date début</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Échéance</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Préd.</div>
              <div className="px-2 py-2 text-center border-r border-b-2 border-[var(--border-default)]">Succ.</div>
              <div className="px-2 py-2 text-center border-b-2 border-[var(--border-default)]">Actions</div>
            </div>

            {/* Rows */}
            <div>
              {livrables.map((livrable, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[60px_1fr_80px_120px_120px_120px_120px_60px_60px_80px] hover:bg-[var(--bg-surface-hover)] transition-colors text-[12px]"
                >
                  {/* Numéro */}
                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={livrable.numero}
                      onChange={(e) => updateLivrable(index, "numero", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[11px] font-bold text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="R1"
                    />
                  </div>

                  {/* Intitulé */}
                  <div className="px-2 py-2 flex items-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={livrable.intitule}
                      onChange={(e) => updateLivrable(index, "intitule", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[12px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Nom du livrable..."
                    />
                  </div>

                  {/* Pondération */}
                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={livrable.ponderation || ""}
                      onChange={(e) => updateLivrable(index, "ponderation", parseFloat(e.target.value) || 0)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[11px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="20"
                    />
                  </div>

                  {/* Délai (depuis T0) + unité */}
                  <div className="px-1 py-2 flex items-center gap-1 border-r border-b border-[var(--border-default)]">
                    <input
                      type="number"
                      min="0"
                      value={livrable.delai || ""}
                      onChange={(e) => updateLivrable(index, "delai", parseInt(e.target.value) || undefined)}
                      disabled={isView || (!!livrable.dateEcheance && !livrable.delai)}
                      className="w-[45px] px-1 py-1 bg-transparent text-[11px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      placeholder="1"
                    />
                    <select
                      value={livrable.delaiUnite || 'mois'}
                      onChange={(e) => updateLivrable(index, "delaiUnite", e.target.value)}
                      disabled={isView}
                      className="w-[65px] px-0.5 py-1 bg-transparent text-[9px] focus:outline-none focus:bg-[var(--bg-inset)] rounded border border-[var(--border-subtle)] disabled:opacity-50"
                    >
                      <option value="jours">jours</option>
                      <option value="semaines">semaines</option>
                      <option value="mois">mois</option>
                    </select>
                  </div>

                  {/* Durée + unité */}
                  <div className="px-1 py-2 flex items-center gap-1 border-r border-b border-[var(--border-default)]">
                    <input
                      type="number"
                      min="0"
                      value={livrable.duree || ""}
                      onChange={(e) => updateLivrable(index, "duree", parseInt(e.target.value) || undefined)}
                      disabled={isView || (!!livrable.dateDebut && !!livrable.dateFin && !livrable.duree)}
                      className="w-[45px] px-1 py-1 bg-transparent text-[11px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      placeholder="1"
                    />
                    <select
                      value={livrable.dureeUnite || 'mois'}
                      onChange={(e) => updateLivrable(index, "dureeUnite", e.target.value)}
                      disabled={isView}
                      className="w-[65px] px-0.5 py-1 bg-transparent text-[9px] focus:outline-none focus:bg-[var(--bg-inset)] rounded border border-[var(--border-subtle)] disabled:opacity-50"
                    >
                      <option value="jours">jours</option>
                      <option value="semaines">semaines</option>
                      <option value="mois">mois</option>
                    </select>
                  </div>

                  {/* Date début */}
                  <div className="px-2 py-2 flex items-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="date"
                      value={livrable.dateDebut || ""}
                      onChange={(e) => updateLivrable(index, "dateDebut", e.target.value)}
                      disabled={isView || !!livrable.predecesseur}
                      className="w-full px-1 py-1 bg-transparent text-[10px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      title={livrable.predecesseur ? "Calculé depuis le prédécesseur" : ""}
                    />
                  </div>

                  {/* Échéance (Date fin) */}
                  <div className="px-2 py-2 flex items-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="date"
                      value={livrable.dateFin || ""}
                      onChange={(e) => updateLivrable(index, "dateFin", e.target.value)}
                      disabled={isView || (!!livrable.dateDebut && !!livrable.duree)}
                      className="w-full px-1 py-1 bg-transparent text-[10px] focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:italic"
                      placeholder={formatDate(livrable.dateEcheance)}
                      title={(livrable.dateDebut && livrable.duree) ? "Calculé automatiquement (Date début + Durée)" : ""}
                    />
                  </div>

                  {/* Prédécesseur */}
                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={livrable.predecesseur || ""}
                      onChange={(e) => updateLivrable(index, "predecesseur", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[10px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="R1"
                      title="Numéro du livrable qui doit être terminé avant"
                    />
                  </div>

                  {/* Successeur */}
                  <div className="px-2 py-2 flex items-center justify-center border-r border-b border-[var(--border-default)]">
                    <input
                      type="text"
                      value={livrable.successeur || ""}
                      onChange={(e) => updateLivrable(index, "successeur", e.target.value)}
                      disabled={isView}
                      className="w-full px-1 py-1 bg-transparent text-[10px] text-center focus:outline-none focus:bg-[var(--bg-inset)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="R3"
                      title="Numéro du livrable qui commence après"
                    />
                  </div>

                  {/* Actions */}
                  <div className="px-2 py-2 flex items-center justify-center border-b border-[var(--border-default)]">
                    {can("structure:edit") && (
                      <button
                        onClick={() => removeLivrable(index)}
                        className="p-1 rounded hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Bouton ajouter ligne */}
              <div className="px-3 py-2 bg-[var(--bg-inset)]/30 border-t border-[var(--border-default)]">
                {can("structure:edit") && (
                  <button
                    onClick={addLivrable}
                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-[var(--radius-md)] transition-colors"
                  >
                    <Plus size={14} />
                    Ajouter un livrable
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
          {!isValidPonderation && livrables.length > 0 && (
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

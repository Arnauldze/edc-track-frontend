"use client";

import { formatMoney, formatDate } from "@/lib/utils";

interface Bailleur {
  nom: string;
  montant: number;
  devise: string;
  pourcentage?: number;
}

interface PartieFinancement {
  nom: string;
  montant: number;
  devise: string;
  pourcentage?: number;
}

interface Financement {
  type: "MOP" | "PPP";
  budgetNational?: boolean;
  budgetNationalMontant?: number;
  budgetNationalDevise?: string;
  budgetNationalPct?: number;
  bailleurs?: Bailleur[];
  partiesPubliques?: PartieFinancement[];
  partiesPrivees?: PartieFinancement[];
  tauxChange?: Record<string, number>;
}

interface Localisation {
  region?: string;
  departement?: string;
  ville?: string;
  localite?: string;
}

interface Project {
  code: string;
  name: string;
  description?: string;
  budget?: number;
  devise?: string;
  progress?: number;
  localisation?: Localisation;
  financement?: Financement;
  dateDebut?: string;
  dateFin?: string;
  status?: string;
  priority?: string;
  category?: string;
}

interface ProjectInfoCardProps {
  project: Project;
}

export function ProjectInfoCard({ project }: ProjectInfoCardProps) {
  const getLocation = () => {
    const parts = [
      project.localisation?.ville,
      project.localisation?.departement,
      project.localisation?.region,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
  };

  const getAllFunders = (): Array<{ name: string; amount: number; currency: string; percentage?: number }> => {
    const funders: Array<{ name: string; amount: number; currency: string; percentage?: number }> = [];
    
    if (!project.financement) return funders;

    // MOP : Budget national + Bailleurs
    if (project.financement.type === "MOP") {
      if (project.financement.budgetNational && project.financement.budgetNationalMontant) {
        funders.push({
          name: "Budget National",
          amount: project.financement.budgetNationalMontant,
          currency: project.financement.budgetNationalDevise || "FCFA",
          percentage: project.financement.budgetNationalPct,
        });
      }
      if (project.financement.bailleurs) {
        project.financement.bailleurs.forEach(b => {
          funders.push({
            name: b.nom,
            amount: b.montant,
            currency: b.devise,
            percentage: b.pourcentage,
          });
        });
      }
    }

    // PPP : Parties publiques + Parties privées
    if (project.financement.type === "PPP") {
      if (project.financement.partiesPubliques) {
        project.financement.partiesPubliques.forEach(p => {
          funders.push({
            name: `${p.nom} (Public)`,
            amount: p.montant,
            currency: p.devise,
            percentage: p.pourcentage,
          });
        });
      }
      if (project.financement.partiesPrivees) {
        project.financement.partiesPrivees.forEach(p => {
          funders.push({
            name: `${p.nom} (Privé)`,
            amount: p.montant,
            currency: p.devise,
            percentage: p.pourcentage,
          });
        });
      }
    }

    return funders;
  };

  const funders = getAllFunders();
  const fundersCount = funders.length;

  const getStatusBadge = () => {
    const statusColors: Record<string, string> = {
      planifie: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      en_cours: "bg-green-500/10 text-green-600 border-green-500/20",
      termine: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      suspendu: "bg-red-500/10 text-red-600 border-red-500/20",
    };
    const color = statusColors[project.status || ""] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
    return color;
  };

  const getPriorityBadge = () => {
    const priorityColors: Record<string, string> = {
      haute: "bg-red-500/10 text-red-600 border-red-500/20",
      moyenne: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      basse: "bg-green-500/10 text-green-600 border-green-500/20",
    };
    const color = priorityColors[project.priority || ""] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
    return color;
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Métriques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-[var(--border-subtle)]">
        {/* Budget */}
        <div>
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
            Budget total
          </div>
          <div className="text-base font-bold text-[var(--text-primary)] leading-tight">
            {project.budget ? formatMoney(project.budget, 2) : "—"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {project.devise || "FCFA"}
          </div>
        </div>

        {/* Date de début */}
        <div>
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
            Date de début
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {formatDate(project.dateDebut)}
          </div>
        </div>

        {/* Date de fin */}
        <div>
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
            Date de fin
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {formatDate(project.dateFin)}
          </div>
        </div>

        {/* Localisation */}
        <div>
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
            Localisation
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">
            {getLocation()}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
          Description
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {project.description || "Aucune description disponible."}
        </p>
      </div>

      {/* Type de financement */}
      {project.financement && (
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
            Type de financement
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {project.financement.type}
            {fundersCount > 0 && (
              <span className="text-[var(--text-secondary)] font-normal ml-2">
                ({fundersCount} financeur{fundersCount > 1 ? "s" : ""})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Financeurs */}
      {funders.length > 0 && (
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">
            Financeurs
          </div>
          <div className="space-y-2">
            {funders.map((funder, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {funder.name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formatMoney(funder.amount, 2)} {funder.currency}
                  </span>
                  {funder.percentage !== undefined && (
                    <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[3ch] text-right">
                      {formatMoney(funder.percentage, 2)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Total & Taux de Change */}
      <div className="p-6">
        <div className="space-y-4">
          {/* Budget total en FCFA */}
          <div>
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
              Budget Total (FCFA)
            </span>
            <div className="text-base font-bold text-[var(--text-primary)] mt-1 leading-tight">
              {project.budget ? formatMoney(project.budget, 2) : "—"} FCFA
            </div>
          </div>

          {/* Taux de change */}
          {project.financement?.tauxChange && Object.keys(project.financement.tauxChange).length > 0 && (
            <div>
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                Taux de Change
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(project.financement.tauxChange).map(([devise, taux]) => (
                  <div key={devise} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--text-secondary)]">1 {devise}</span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatMoney(taux, 2)} FCFA</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tags (Statut, Priorité, Catégorie) */}
      {(project.status || project.priority || project.category) && (
        <div className="p-6 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
          {project.status && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge()}`}>
              Statut: {project.status.replace("_", " ")}
            </span>
          )}
          {project.priority && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityBadge()}`}>
              Priorité: {project.priority}
            </span>
          )}
          {project.category && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
              {project.category}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

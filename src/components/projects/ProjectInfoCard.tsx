"use client";

import { formatMoney, formatDate } from "@/lib/utils";

interface Bailleur {
  nom: string;
  /** Apports par devise ; absent pour un bailleur enregistré avant ce détail. */
  contributions?: { montant: number; devise: string }[];
  montant: number; // Équivalent FCFA calculé par le serveur
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
  components?: { budget?: number; devise?: string }[];
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

  type Funder = {
    name: string;
    amount: number;
    currency: string;
    percentage?: number;
    /** Montants saisis dans leurs devises, quand ils diffèrent de l'équivalent affiché. */
    detail?: string;
  };

  const getAllFunders = (): Funder[] => {
    const funders: Funder[] = [];
    
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
          const contributions = (b.contributions ?? []).filter(c => c.montant > 0);
          const isForeignOrSplit =
            contributions.length > 1 || (contributions.length === 1 && contributions[0].devise !== b.devise);
          funders.push({
            name: b.nom,
            amount: b.montant,
            currency: b.devise,
            percentage: b.pourcentage,
            detail: isForeignOrSplit
              ? contributions.map(c => `${formatMoney(c.montant, 2)} ${c.devise}`).join(" + ")
              : undefined,
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

  const rates: Record<string, number> = (project.financement?.tauxChange as Record<string, number> | undefined) ?? {};

  // Taux affichés : seulement ceux des devises réellement utilisées (hors FCFA)
  const usedCurrencies = new Set<string>();
  if (project.financement?.type === "MOP") {
    if (project.financement.budgetNational && project.financement.budgetNationalDevise) {
      usedCurrencies.add(project.financement.budgetNationalDevise);
    }
    project.financement.bailleurs?.forEach(b => (b.contributions ?? [{ devise: b.devise }]).forEach(c => usedCurrencies.add(c.devise)));
  } else {
    [...(project.financement?.partiesPubliques ?? []), ...(project.financement?.partiesPrivees ?? [])].forEach(p => usedCurrencies.add(p.devise));
  }
  const displayedRates = Object.entries(rates).filter(([devise]) => devise !== "FCFA" && usedCurrencies.has(devise));

  // Budget alloué aux composants au-delà du budget financé
  const allocatedFCFA = (project.components ?? []).reduce(
    (sum, c) => sum + (c.budget ?? 0) * (rates[c.devise || "FCFA"] ?? 1),
    0,
  );
  const overAllocation = project.budget ? allocatedFCFA - project.budget : 0;

  const getStatusBadge = () => {
    const statusColors: Record<string, string> = {
      planifie: "bg-inset text-fg-muted border-line",
      en_cours: "bg-success-subtle text-success border-success/20",
      termine: "bg-primary-subtle text-primary border-primary/20",
      suspendu: "bg-danger-subtle text-danger border-danger/20",
    };
    const color = statusColors[project.status || ""] || "bg-inset text-fg-muted border-line";
    return color;
  };

  const getPriorityBadge = () => {
    const priorityColors: Record<string, string> = {
      haute: "bg-danger-subtle text-danger border-danger/20",
      moyenne: "bg-warning-subtle text-warning border-warning/20",
      basse: "bg-success-subtle text-success border-success/20",
    };
    const color = priorityColors[project.priority || ""] || "bg-inset text-fg-muted border-line";
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
                  <span className="text-sm text-[var(--text-secondary)] text-right">
                    {funder.detail ?? `${formatMoney(funder.amount, 2)} ${funder.currency}`}
                    {funder.detail && (
                      <span className="block text-xs text-[var(--text-tertiary)]">
                        ≈ {formatMoney(funder.amount, 2)} {funder.currency}
                      </span>
                    )}
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
            {overAllocation >= 1 && (
              <div className="mt-2 p-2.5 rounded-[var(--radius-md)] bg-warning-subtle border border-warning/20 text-xs text-warning">
                Les composants totalisent {formatMoney(allocatedFCFA, 2)} FCFA, soit {formatMoney(overAllocation, 2)} FCFA
                de plus que le budget financé.
              </div>
            )}
          </div>

          {/* Taux de change */}
          {displayedRates.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                Taux de Change
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {displayedRates.map(([devise, taux]) => (
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
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-subtle text-primary border border-primary/20">
              {project.category}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Financement {
  type: "MOP" | "PPP";
}

interface Project {
  code: string;
  name: string;
  description?: string;
  budget?: number;
  devise?: string;
  progress?: number;
  localisation?: {
    region?: string;
    departement?: string;
    ville?: string;
  };
  financement?: Financement;
  components?: any[];
  status?: string;
  dateDebut?: string;
  dateFin?: string;
}

interface ProjectCardProps {
  project: Project;
  teamMembers?: Array<{ initials: string; color: string }>;
}

// Couleurs pour les tags de secteur
const SECTOR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  santé: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/20" },
  énergie: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
  éducation: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" },
  tourisme: { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/20" },
  infrastructure: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/20" },
  défaut: { bg: "bg-gray-500/10", text: "text-gray-600", border: "border-gray-500/20" },
};

// Couleurs pour le type de financement
const FINANCEMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MOP: { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-500/20" },
  PPP: { bg: "bg-indigo-500/10", text: "text-indigo-700", border: "border-indigo-500/20" },
};

export function ProjectCard({ project, teamMembers = [] }: ProjectCardProps) {
  const router = useRouter();

  // Détecter le secteur basé sur le nom ou la description
  const getSector = (): string => {
    const text = `${project.name} ${project.description || ""}`.toLowerCase();
    if (text.includes("hôpital") || text.includes("santé") || text.includes("médical")) return "santé";
    if (text.includes("électrique") || text.includes("énergie") || text.includes("réseau")) return "énergie";
    if (text.includes("école") || text.includes("lycée") || text.includes("éducation") || text.includes("formation")) return "éducation";
    if (text.includes("tourisme") || text.includes("hôtel")) return "tourisme";
    if (text.includes("route") || text.includes("pont") || text.includes("infrastructure")) return "infrastructure";
    return "défaut";
  };

  const sector = getSector();
  const sectorStyle = SECTOR_COLORS[sector];
  const financementType = project.financement?.type || "MOP";
  const financementStyle = FINANCEMENT_COLORS[financementType];

  const progress = project.progress || 0;
  
  // Couleur de la barre de progression selon le niveau
  const getProgressColor = () => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 40) return "bg-blue-500";
    if (progress > 0) return "bg-amber-500";
    return "bg-gray-400";
  };

  return (
    <div
      onClick={() => router.push(`/projects/${project.code}`)}
      className="group bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-200 cursor-pointer"
    >
      <div className="p-5 space-y-3.5">
        {/* Tags colorés en haut */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-[20px] text-[10px] font-bold uppercase tracking-wide border ${sectorStyle.bg} ${sectorStyle.text} ${sectorStyle.border}`}
          >
            {sector === "défaut" ? "Infrastructure" : sector}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-[20px] text-[10px] font-bold uppercase tracking-wide border ${financementStyle.bg} ${financementStyle.text} ${financementStyle.border}`}
          >
            {financementType}
          </span>
        </div>

        {/* Titre */}
        <h3 className="text-[15px] font-bold text-[var(--text-primary)] line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-[var(--accent)] transition-colors">
          {project.name}
        </h3>

        {/* Code projet */}
        <div className="text-[11px] text-[var(--text-tertiary)] font-semibold">
          {project.code}
        </div>

        {/* Description tronquée */}
        {project.description && (
          <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Progression avec label */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">
              Progression
            </span>
            <span className="text-[13px] font-bold text-[var(--text-primary)]">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-[var(--bg-inset)] rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} rounded-full transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer: Badge date + Avatars */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
          {/* Badge date */}
          {project.dateFin && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-inset)] rounded-[20px] border border-[var(--border-subtle)]">
              <Calendar size={12} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                {formatDate(project.dateFin)}
              </span>
            </div>
          )}
          {!project.dateFin && <div />}

          {/* Stack d'avatars */}
          {teamMembers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {teamMembers.slice(0, 3).map((member, index) => (
                <div
                  key={index}
                  className={`w-7 h-7 rounded-full ${member.color} border-2 border-[var(--bg-surface)] flex items-center justify-center text-white text-[9px] font-bold shadow-sm`}
                  title={member.initials}
                >
                  {member.initials}
                </div>
              ))}
              {teamMembers.length > 3 && (
                <div className="w-7 h-7 rounded-full bg-[var(--bg-inset)] border-2 border-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)] text-[9px] font-bold shadow-sm">
                  +{teamMembers.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

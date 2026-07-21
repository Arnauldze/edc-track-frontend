"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { teamService, type TeamAssignment } from "@/services/api/teamService";
import { getUserById } from "@/lib/userStore";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { PROJECT_ROLE_LABELS, type ProjectRole } from "@/lib/rbacStore";

interface ProjectTeamCardProps {
  projectId: string;
}

interface TeamMemberDisplay extends TeamAssignment {
  userName?: string;
  userInitials?: string;
}

const ROLE_COLORS: Record<string, string> = {
  coordinateur_general: "bg-purple-500",
  coordinateur: "bg-indigo-500",
  chef_projet: "bg-blue-500",
  contributeur: "bg-amber-500",
  view: "bg-gray-500",
};

export function ProjectTeamCard({ projectId }: ProjectTeamCardProps) {
  const [members, setMembers] = useState<TeamMemberDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeam();
  }, [projectId]);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      setError(null);
      const assignments = await teamService.getProjectTeam(projectId);

      // Enrichir avec les noms des utilisateurs
      const enriched = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const user = await getUserById(assignment.userId);
            if (user) {
              const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
              return {
                ...assignment,
                userName: `${user.firstName} ${user.lastName}`,
                userInitials: initials,
              };
            }
          } catch (err) {
            console.error("Error fetching user:", err);
          }
          return {
            ...assignment,
            userName: "Utilisateur inconnu",
            userInitials: "??",
          };
        })
      );

      setMembers(enriched);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement de l'équipe");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    return ROLE_COLORS[role] || "bg-gray-500";
  };

  const getAssignmentText = (member: TeamMemberDisplay) => {
    if (member.level === "project") {
      return null;
    }
    return member.entityName || `${member.level} non spécifié`;
  };

  if (loading) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6">
        <LoadingSpinner size="sm" className="min-h-[200px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6">
        <ErrorDisplay error={error} />
      </div>
    );
  }

  const visibleMembers = members.slice(0, 4);
  const remainingCount = members.length - 4;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Équipe</h3>
        <button
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-inset)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
          title="Inviter un membre"
        >
          <Plus size={14} />
          Inviter
        </button>
      </div>

      {/* Liste des membres */}
      <div className="p-6">
        {members.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)]">
            <p className="text-sm">Aucun membre assigné</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleMembers.map((member, index) => (
              <div key={index} className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full ${getRoleColor(
                    member.projectRole
                  )} flex items-center justify-center text-white text-sm font-bold shadow-sm`}
                >
                  {member.userInitials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {member.userName}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {PROJECT_ROLE_LABELS[member.projectRole as ProjectRole] || member.projectRole}
                  </div>
                  {member.functionalRole && (
                    <div className="text-xs text-[var(--text-tertiary)] mt-0.5 italic">
                      {member.functionalRole}
                    </div>
                  )}
                  {getAssignmentText(member) && (
                    <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {getAssignmentText(member)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Badge total */}
            {remainingCount > 0 && (
              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--bg-inset)] border-2 border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] text-sm font-bold">
                    +{remainingCount}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {members.length} membre{members.length > 1 ? "s" : ""} au total
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

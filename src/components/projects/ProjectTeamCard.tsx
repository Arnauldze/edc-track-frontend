"use client";

import { Plus } from "lucide-react";
import type { TeamAssignment } from "@/services/api/teamService";
import type { DirectoryUser } from "@/services/api/userService";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PROJECT_ROLE_LABELS, rolePastille, type ProjectRole } from "@/lib/rbacStore";

// Carte de présentation : les données et la modale d'ajout appartiennent à la
// page, qui les partage avec l'onglet Équipe. Un ajout fait depuis l'une des
// deux vues se reflète ainsi immédiatement dans l'autre.
interface ProjectTeamCardProps {
  assignments: TeamAssignment[];
  usersById: Map<string, DirectoryUser>;
  loading?: boolean;
  /** Absent si l'utilisateur n'a pas la permission team:add : le bouton est masqué. */
  onInvite?: () => void;
}

interface TeamMemberDisplay extends TeamAssignment {
  userName: string;
  userInitials: string;
}

export function ProjectTeamCard({ assignments, usersById, loading = false, onInvite }: ProjectTeamCardProps) {
  const members: TeamMemberDisplay[] = assignments.map((assignment) => {
    const user = usersById.get(assignment.userId);
    return {
      ...assignment,
      userName: user ? `${user.firstName} ${user.lastName}` : "Utilisateur inconnu",
      userInitials: user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "??",
    };
  });

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

  const visibleMembers = members.slice(0, 4);
  const remainingCount = members.length - 4;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Équipe</h3>
        {onInvite && (
          <button
            onClick={onInvite}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-inset)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
            title="Inviter un membre"
          >
            <Plus size={14} />
            Inviter
          </button>
        )}
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
              <div key={member._id ?? index} className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full ${rolePastille(member.projectRole)} flex items-center justify-center text-sm font-bold shadow-sm`}
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

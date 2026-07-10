"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Users,
  Plus,
  Trash2,
  Search,
  Edit2,
  Settings,
  Layers,
} from "lucide-react";
import { getProjectById } from "@/lib/projectStore";
import { getActivityName } from "@/lib/projectStore";
import {
  getUsers,
  getProjectTeam,
  addTeamAssignment,
  removeTeamAssignment,
  type User,
  type TeamAssignment,
} from "@/lib/userStore";
import { type ProjectRole, PROJECT_ROLE_LABELS, PROJECT_ROLE_COLORS } from "@/lib/rbacStore";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import AddMemberModal, { type MemberFormData } from "@/components/team/AddMemberModal";

export default function ProjectTeamPage() {
  const params = useParams();
  const projectId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [project, setProject] = useState<any>(null);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<TeamAssignment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Load project
  useEffect(() => {
    async function loadProject() {
      const proj = await getProjectById(projectId);
      setProject(proj);
    }
    loadProject();
  }, [projectId]);

  useEffect(() => {
    refreshData();
  }, [projectId]);

  const refreshData = async () => {
    try {
      const [team, users] = await Promise.all([
        getProjectTeam(projectId),
        getUsers()
      ]);
      setTeamAssignments(team);
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading team data:', error);
      setTeamAssignments([]);
      setAllUsers([]);
    }
  };

  const handleOpenModal = (assignment?: TeamAssignment) => {
    setEditingAssignment(assignment || null);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingAssignment(null);
  };

  const handleSubmit = async (data: MemberFormData) => {
    if (!data.userId) {
      toast.error("Veuillez sélectionner un utilisateur");
      return;
    }

    try {
      if (editingAssignment) {
        // Pour modifier: supprimer l'ancien et créer un nouveau
        await removeTeamAssignment(editingAssignment._id);
        await addTeamAssignment({
          projectId,
          userId: data.userId,
          projectRole: data.projectRole,
          level: data.level,
          entityId: data.entityId,
          entityName: data.entityName,
        });
        toast.success("Affectation modifiée");
      } else {
        await addTeamAssignment({
          projectId,
          userId: data.userId,
          projectRole: data.projectRole,
          level: data.level,
          entityId: data.entityId,
          entityName: data.entityName,
        });
        toast.success("Membre ajouté à l'équipe");
      }

      await refreshData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving team assignment:', error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await removeTeamAssignment(deleteConfirm.id);
        toast.success("Membre retiré de l'équipe");
        await refreshData();
        setDeleteConfirm(null);
      } catch (error) {
        console.error('Error removing team member:', error);
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "project":
        return "Projet";
      case "component":
        return "Composant";
      case "subcomponent":
        return "Sous-composant";
      case "activity":
        return "Activité";
      default:
        return level;
    }
  };

  const filteredAssignments = (teamAssignments || []).filter((assignment) => {
    const user = allUsers.find(u => u.id === assignment.userId);
    if (!user) return false;
    const roleLabel = PROJECT_ROLE_LABELS[assignment.projectRole] || assignment.projectRole;
    const searchStr = `${user.firstName} ${user.lastName} ${roleLabel} ${assignment.entityName || ""}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-[var(--text-secondary)]">Projet introuvable</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-8 pt-4 pb-4 flex-shrink-0">
        {/* Breadcrumb en haut */}
        <div className="mb-3">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors inline-flex"
          >
            <ChevronLeft size={14} /> Retour au projet
          </Link>
        </div>
        
        {/* Titre */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                {project.name}
                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] bg-[var(--bg-inset)] text-[var(--text-tertiary)] font-bold">
                  {project.code}
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* NAV BAR */}
      <div className="flex items-center px-8 bg-[var(--bg-surface)] border-b border-[var(--border-default)] flex-shrink-0">
        <div className="flex gap-0.5">
          <Link
            href={`/projects/${projectId}?tab=info`}
            className="py-3 px-4 text-[13px] font-medium border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <Settings size={14} /> Informations
          </Link>
          <Link
            href={`/projects/${projectId}?tab=structure`}
            className="py-3 px-4 text-[13px] font-medium border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <Layers size={14} /> Structure & Activités
          </Link>
          <Link
            href={`/projects/${projectId}/team`}
            className="py-3 px-4 text-[13px] font-bold border-b-2 border-[var(--text-primary)] text-[var(--text-primary)] transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <Users size={14} /> Équipe
          </Link>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="text"
              placeholder="Rechercher un membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
            />
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={16} />
            Ajouter un membre
          </button>
        </div>

        {/* Team table */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-[var(--bg-inset)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Membre
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Niveau
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Affectation
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredAssignments.map((assignment) => {
                const user = allUsers.find(u => u.id === assignment.userId);
                if (!user) return null;

                return (
                  <tr
                    key={assignment._id}
                    className="hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.firstName?.[0] || ""}
                          {user.lastName?.[0] || ""}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)]">
                            {user.position || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit ${PROJECT_ROLE_COLORS[assignment.projectRole]?.bg || ''} ${PROJECT_ROLE_COLORS[assignment.projectRole]?.text || ''} border ${PROJECT_ROLE_COLORS[assignment.projectRole]?.border || ''}`}>
                        {PROJECT_ROLE_LABELS[assignment.projectRole]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-secondary)]">
                        {getLevelLabel(assignment.level)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--text-secondary)]">
                        {assignment.entityName || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(assignment)}
                          className="p-2 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[var(--radius-md)] transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(assignment._id, `${user.firstName} ${user.lastName}`)}
                          className="p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-[var(--radius-md)] transition-colors"
                          title="Retirer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredAssignments.length === 0 && (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {searchQuery
                  ? "Aucun membre trouvé"
                  : "Aucun membre dans l'équipe"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        projectId={projectId}
        project={project}
        editingAssignment={editingAssignment}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={!!deleteConfirm}
          title="Retirer le membre"
          message={`Êtes-vous sûr de vouloir retirer ${deleteConfirm.name} de l'équipe ?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

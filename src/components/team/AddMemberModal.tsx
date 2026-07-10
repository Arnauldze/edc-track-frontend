"use client";

import { useState, useEffect } from "react";
import { X, Search, CheckCircle2, AlertCircle, Info, Shield } from "lucide-react";
import { getUsers, type User } from "@/lib/userStore";
import {
  type ProjectRole,
  PROJECT_ROLE_LABELS,
  PROJECT_ROLE_DESCRIPTIONS,
  PROJECT_ROLE_COLORS,
  ALL_PROJECT_ROLES,
} from "@/lib/rbacStore";
import { toast } from "@/lib/toastStore";
import { usePermissions } from "@/hooks/usePermissions";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MemberFormData) => Promise<void>;
  projectId: string;
  project: any;
  editingAssignment?: any;
}

export interface MemberFormData {
  userId: string;
  projectRole: ProjectRole;
  level: "project" | "component" | "subcomponent" | "activity";
  entityId: string;
  entityName: string;
  selectedComponent: string;
  selectedSubcomponent: string;
}

export default function AddMemberModal({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  project,
  editingAssignment,
}: AddMemberModalProps) {
  const { isAdmin, isChefProjet } = usePermissions(projectId);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<MemberFormData>({
    userId: "",
    projectRole: "view",
    level: "project",
    entityId: "",
    entityName: "",
    selectedComponent: "",
    selectedSubcomponent: "",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (editingAssignment) {
      setFormData({
        userId: editingAssignment.userId,
        projectRole: editingAssignment.projectRole,
        level: editingAssignment.level,
        entityId: editingAssignment.entityId || "",
        entityName: editingAssignment.entityName || "",
        selectedComponent: "",
        selectedSubcomponent: "",
      });
      const user = allUsers.find((u) => u.id === editingAssignment.userId);
      if (user) setSelectedUser(user);
    }
  }, [editingAssignment, allUsers]);

  const loadUsers = async () => {
    try {
      const users = await getUsers();
      setAllUsers(users.filter((u) => u.status === "active"));
    } catch (error) {
      console.error("Error loading users:", error);
      setAllUsers([]);
    }
  };

  const filteredUsers = allUsers.filter((user) => {
    const searchStr =
      `${user.firstName} ${user.lastName} ${user.email} ${user.position || ""}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setFormData({ ...formData, userId: user.id });
    setSearchQuery(`${user.firstName} ${user.lastName}`);
    setShowUserDropdown(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowUserDropdown(true);
    setSelectedUser(null);
    setFormData({ ...formData, userId: "" });
  };

  // Rôles assignables selon le rôle de l'utilisateur courant
  const getAssignableRoles = (): ProjectRole[] => {
    if (isAdmin) {
      // Admin peut assigner tous les rôles
      return ALL_PROJECT_ROLES;
    }
    // Chef de projet peut assigner contributeur et view uniquement
    return ["contributeur", "view"] as ProjectRole[];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId) {
      toast.error("Veuillez sélectionner un utilisateur");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error submitting:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const assignableRoles = getAssignableRoles();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between sticky top-0 bg-[var(--bg-surface)] z-10">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {editingAssignment ? "Modifier l'affectation" : "Ajouter un membre"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] transition-colors"
          >
            <X size={20} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ── Recherche utilisateur ── */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Sélectionner un utilisateur *
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => !selectedUser && setShowUserDropdown(true)}
                placeholder="Rechercher par nom, email ou poste..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
              />

              {/* Dropdown des résultats */}
              {showUserDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserDropdown(false)}
                  />
                  <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] max-h-60 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleUserSelect(user)}
                          className="w-full text-left px-4 py-3 hover:bg-[var(--bg-surface-hover)] transition-colors border-b border-[var(--border-subtle)] last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {user.firstName?.[0]}
                              {user.lastName?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[var(--text-primary)]">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-[var(--text-tertiary)] truncate">
                                {user.email} • {user.position || "N/A"}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <AlertCircle
                          size={32}
                          className="mx-auto mb-2 text-[var(--text-tertiary)] opacity-50"
                        />
                        <p className="text-sm text-[var(--text-tertiary)] mb-1">
                          Aucun utilisateur trouvé
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          Contactez l'administrateur pour créer un nouveau compte.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Utilisateur sélectionné */}
            {selectedUser && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-[var(--radius-md)] flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {selectedUser.email} • {selectedUser.position || "N/A"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                    setFormData({ ...formData, userId: "" });
                  }}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* ── Rôle projet (RBAC simplifié) ── */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
              <Shield size={12} className="inline mr-1.5 -mt-0.5" />
              Rôle dans le projet *
            </label>
            <div className="space-y-2">
              {assignableRoles.map((role) => {
                const isSelected = formData.projectRole === role;
                const colors = PROJECT_ROLE_COLORS[role];
                return (
                  <label
                    key={role}
                    className={`
                      flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] cursor-pointer transition-all duration-150 border
                      ${isSelected
                        ? `${colors.bg} ${colors.border} ring-1 ring-${colors.text.replace('text-', '')}/30`
                        : "bg-[var(--bg-inset)] border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="projectRole"
                      value={role}
                      checked={isSelected}
                      onChange={() => setFormData({ ...formData, projectRole: role })}
                      className="mt-0.5 w-4 h-4 text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${isSelected ? colors.text : "text-[var(--text-primary)]"}`}>
                        {PROJECT_ROLE_LABELS[role]}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {PROJECT_ROLE_DESCRIPTIONS[role]}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Info box sur les permissions automatiques */}
            <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-[var(--radius-md)] flex items-start gap-2">
              <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Les droits d'accès sont automatiquement attribués selon le rôle sélectionné. 
                Pas besoin de configuration supplémentaire.
              </p>
            </div>

            {!isChefProjet && !isAdmin && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
                <AlertCircle size={12} />
                Seul le chef de projet ou l'administrateur peut modifier les rôles
              </p>
            )}
          </div>

          {/* ── Niveau d'affectation ── */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Niveau d'affectation *
            </label>
            <select
              value={formData.level}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  level: e.target.value as any,
                  entityId: "",
                  entityName: "",
                  selectedComponent: "",
                  selectedSubcomponent: "",
                })
              }
              className="w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
              required
            >
              <option value="project">Projet</option>
              <option value="component">Composant</option>
              <option value="subcomponent">Sous-composant</option>
              <option value="activity">Activité</option>
            </select>
          </div>

          {/* Cascade: Component selection */}
          {(formData.level === "component" || formData.level === "subcomponent" || formData.level === "activity") && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Composant *
              </label>
              <select
                value={formData.level === "component" ? formData.entityId : formData.selectedComponent}
                onChange={(e) => {
                  if (formData.level === "component") {
                    const comp = project?.components.find((c: any) => c.id === e.target.value);
                    setFormData({
                      ...formData,
                      entityId: e.target.value,
                      entityName: comp?.name || "",
                    });
                  } else {
                    setFormData({
                      ...formData,
                      selectedComponent: e.target.value,
                      selectedSubcomponent: "",
                      entityId: "",
                      entityName: "",
                    });
                  }
                }}
                className="w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                required
              >
                <option value="">Sélectionner un composant</option>
                {project?.components.map((comp: any) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cascade: Subcomponent selection */}
          {(formData.level === "subcomponent" || formData.level === "activity") && formData.selectedComponent && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Sous-composant *
              </label>
              <select
                value={formData.level === "subcomponent" ? formData.entityId : formData.selectedSubcomponent}
                onChange={(e) => {
                  if (formData.level === "subcomponent") {
                    const comp = project?.components.find((c: any) => c.id === formData.selectedComponent);
                    const sc = comp?.sousComposants.find((s: any) => s.id === e.target.value);
                    setFormData({
                      ...formData,
                      entityId: e.target.value,
                      entityName: sc ? `${comp?.name} > ${sc.name}` : "",
                    });
                  } else {
                    setFormData({
                      ...formData,
                      selectedSubcomponent: e.target.value,
                      entityId: "",
                      entityName: "",
                    });
                  }
                }}
                className="w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                required
              >
                <option value="">Sélectionner un sous-composant</option>
                {project?.components
                  .find((c: any) => c.id === formData.selectedComponent)
                  ?.sousComposants.map((sc: any) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Cascade: Activity selection */}
          {formData.level === "activity" && formData.selectedComponent && formData.selectedSubcomponent && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                Activité *
              </label>
              <select
                value={formData.entityId}
                onChange={(e) => {
                  const comp = project?.components.find((c: any) => c.id === formData.selectedComponent);
                  const sc = comp?.sousComposants.find((s: any) => s.id === formData.selectedSubcomponent);
                  const actIndex = sc?.activities.findIndex((_: any, idx: number) => `${sc.id}-act-${idx}` === e.target.value);
                  const actObj = actIndex !== undefined && actIndex >= 0 ? sc?.activities[actIndex] : undefined;
                  const actName = actObj ? (typeof actObj === 'string' ? actObj : actObj.name) : "";
                  setFormData({
                    ...formData,
                    entityId: e.target.value,
                    entityName: actName ? `${comp?.name} > ${sc?.name} > ${actName}` : "",
                  });
                }}
                className="w-full px-3 py-2.5 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                required
              >
                <option value="">Sélectionner une activité</option>
                {project?.components
                  .find((c: any) => c.id === formData.selectedComponent)
                  ?.sousComposants.find((s: any) => s.id === formData.selectedSubcomponent)
                  ?.activities.map((act: any, idx: number) => {
                    const actId = `${formData.selectedSubcomponent}-act-${idx}`;
                    const actName = typeof act === 'string' ? act : act.name;
                    return (
                      <option key={actId} value={actId}>
                        {actName}
                      </option>
                    );
                  })}
              </select>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.userId}
              className="px-5 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "En cours..."
                : editingAssignment
                ? "Modifier"
                : "Ajouter à l'équipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  type User,
} from "@/lib/userStore";
import { Plus, Edit2, Trash2, Search, Mail, Phone, Briefcase, Upload, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { getErrorMessage, apiClient } from "@/services/api/client";

const EDC_POSITIONS = [
  "Directeur Général",
  "Sous-Directeur",
  "Chef de Département",
  "Chef de Service",
  "Ingénieur",
  "Financier",
  "Assistant",
  "Autre"
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCredentials, setShowCredentials] = useState<{ login: string; password: string } | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
    department: "",
    status: "active" as "active" | "inactive",
    platformRole: "user" as "admin" | "user",
    login: "",
    password: "user123", // Default for demo
  });

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || "",
        position: user.position || "",
        department: user.department || "",
        status: user.status,
        platformRole: user.platformRole,
        login: user.login,
        password: "", // Don't show existing password
      });
    } else {
      setEditingUser(null);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        position: "",
        department: "",
        status: "active",
        platformRole: "user",
        login: "", // Sera généré automatiquement
        password: "", // Sera généré automatiquement
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    try {
      setSubmitting(true);
      
      if (editingUser) {
        // Update existing user
        const updateData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          position: formData.position,
          department: formData.department,
          status: formData.status,
        };
        await updateUser(editingUser.id, updateData);
        toast.success("Utilisateur modifié");
      } else {
        // Create new user - login et password seront générés automatiquement par le backend
        const createData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          position: formData.position,
          department: formData.department,
          platformRole: formData.platformRole,
          status: formData.status,
        };

        const response = await addUser(createData);

        // Afficher les credentials générés
        if (response.temporaryPassword) {
          setShowCredentials({
            login: response.login,
            password: response.temporaryPassword,
          });
        }

        toast.success("Utilisateur créé");
      }

      await fetchUsers();
      handleCloseModal();
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await deleteUser(deleteConfirm.id);
      toast.success("Utilisateur supprimé");
      await fetchUsers();
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      setResettingPassword(userId);
      const response = await apiClient.post(`/users/${userId}/generate-credentials`);
      const data = response.data;

      if (data.success) {
        setShowCredentials({
          login: data.data.login,
          password: data.data.temporaryPassword,
        });
        toast.success("Mot de passe réinitialisé avec succès");
      } else {
        toast.error(data.message || "Erreur lors de la réinitialisation");
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err));
    } finally {
      setResettingPassword(null);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error("Le fichier Excel est vide");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Processing sequentially to avoid overwhelming the server
      for (const row of jsonData) {
        // Map common French column names to our schema
        const firstName = row["Prénom"] || row["Prenom"] || row["First Name"] || row["firstName"] || "";
        const lastName = row["Nom"] || row["Last Name"] || row["lastName"] || "";
        const email = row["Email"] || row["E-mail"] || row["Courriel"] || row["email"] || "";
        const phone = row["Téléphone"] || row["Telephone"] || row["Phone"] || row["phone"] || "";
        const position = row["Fonction"] || row["Poste"] || row["Position"] || row["position"] || "";
        const department = row["Département"] || row["Departement"] || row["Department"] || row["department"] || "";

        if (!firstName || !lastName || !email) {
          errorCount++;
          continue;
        }

        const login = `${firstName.toLowerCase().trim()}.${lastName.toLowerCase().trim().replace(/\s+/g, '')}`;

        try {
          await addUser({
            firstName,
            lastName,
            email,
            phone: phone.toString(),
            position,
            department,
            login,
            password: "User@2026", // Default password for imported users
            platformRole: "user",
            status: "active",
          });
          successCount++;
        } catch (err) {
          console.error("Error creating user:", err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} utilisateur(s) importé(s) avec succès`);
        await fetchUsers();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} ligne(s) ont échoué (données manquantes ou email/login existant)`);
      }
    } catch (err: any) {
      toast.error("Erreur lors de la lecture du fichier Excel");
      console.error(err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset input
      }
    }
  };

  const filteredUsers = users.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email} ${user.position || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8">
        <LoadingSpinner size="lg" className="min-h-[400px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorDisplay error={error} retry={fetchUsers} />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Gestion des Utilisateurs
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Gérez les utilisateurs et leurs informations
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-sm font-semibold hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all disabled:opacity-50 shadow-sm"
              title="Importer depuis Excel (Colonnes attendues: Prénom, Nom, Email, Téléphone, Fonction, Département)"
            >
              {importing ? <LoadingSpinner size="sm" /> : <Upload size={16} />}
              Importer
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus size={16} />
              Nouvel utilisateur
            </button>
          </div>
      </div>

      {/* Users table */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden shadow-sm">
          <table className="w-full">
          <thead className="bg-[var(--bg-inset)] border-b border-[var(--border-default)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Utilisateur
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Fonction
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Statut
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                      {user.firstName?.[0] || ""}{user.lastName?.[0] || ""}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {user.firstName} {user.lastName}
                      </div>
                      {user.department && (
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {user.department}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Mail size={12} />
                      {user.email}
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Phone size={12} />
                        {user.phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {user.position && (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Briefcase size={14} />
                      {user.position}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      user.status === "active"
                        ? "bg-green-500/10 text-green-600 border border-green-500/20"
                        : "bg-gray-500/10 text-gray-600 border border-gray-500/20"
                    }`}
                  >
                    {user.status === "active" ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* Bouton Réinitialiser le mot de passe */}
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      disabled={resettingPassword === user.id}
                      className="p-2 text-[var(--text-tertiary)] hover:text-orange-500 hover:bg-orange-500/10 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                      title="Réinitialiser le mot de passe"
                    >
                      {resettingPassword === user.id ? <LoadingSpinner size="sm" /> : <RotateCcw size={14} />}
                    </button>

                    {/* Bouton Modifier */}
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="p-2 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded-[var(--radius-md)] transition-colors"
                      title="Modifier"
                    >
                      <Edit2 size={14} />
                    </button>

                    {/* Bouton Supprimer */}
                    <button
                      onClick={() => handleDelete(user.id, `${user.firstName} ${user.lastName}`)}
                      className="p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 rounded-[var(--radius-md)] transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-[var(--text-tertiary)]">
            <p className="text-sm">Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--border-default)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Fonction (Poste EDC)
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                >
                  <option value="">Sélectionner une fonction...</option>
                  {EDC_POSITIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Département
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                  className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Rôle plateforme
                </label>
                <select
                  value={formData.platformRole}
                  onChange={(e) => setFormData({ ...formData, platformRole: e.target.value as "admin" | "user" })}
                  className="w-full px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      {editingUser ? "Modification..." : "Création..."}
                    </>
                  ) : (
                    <>{editingUser ? "Modifier" : "Créer"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Supprimer l'utilisateur"
        message={`Êtes-vous sûr de vouloir supprimer l'utilisateur "${deleteConfirm?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Modal Credentials */}
      {showCredentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
              Identifiants de connexion
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Login
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={showCredentials.login}
                    readOnly
                    className="flex-1 px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showCredentials.login);
                      toast.success("Login copié");
                    }}
                    className="px-3 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Mot de passe temporaire
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={showCredentials.password}
                    readOnly
                    className="flex-1 px-3 py-2 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(showCredentials.password);
                      toast.success("Mot de passe copié");
                    }}
                    className="px-3 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-[var(--radius-md)] p-3">
                <p className="text-xs text-yellow-600">
                  ⚠️ Copiez ces identifiants maintenant. Vous ne pourrez plus les voir après avoir fermé cette fenêtre.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCredentials(null)}
              className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90"
            >
              J&apos;ai noté les identifiants
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PROJECT SERVICE - Projects API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';

export interface Activity {
  /** Identifiant stable, attribué une fois pour toutes (voir lib/structureUnits.ts). */
  id: string;
  name: string;
  typeActivite: 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi';
}

export interface SousComposant {
  id: string;
  name: string;
  typeActivite?: 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi'; // Optionnel, rempli si c'est le niveau le plus bas
  activities: Activity[];
}

export interface Component {
  id: string;
  name: string;
  budget?: number;
  devise?: string; // Devise du budget de cette composante (USD, EUR, FCFA, etc.)
  ponderation?: number; // Pourcentage de pondération (0-100)
  typeActivite?: 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi'; // Optionnel, rempli si c'est le niveau le plus bas
  sousComposants: SousComposant[];
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Localisation {
  region?: string;
  departement?: string;
  ville?: string;
  localite?: string;
  coordinates?: Coordinates;
}

export interface Contribution {
  montant: number;
  devise: string;
}

// Montants équivalents et pourcentages : calculés par le serveur (voir lib/financement.ts).
export interface Bailleur {
  nom: string;
  /** Apports par devise tels que saisis. Absent pour un bailleur enregistré avant ce détail. */
  contributions?: Contribution[];
  montant: number; // Équivalent FCFA de l'ensemble des contributions
  devise: string;
  pourcentage?: number;
}

export interface PartieFinancement {
  nom: string;
  montant: number;
  devise: string;
  pourcentage?: number;
}

export interface Financement {
  type: 'MOP' | 'PPP';
  // Pour MOP
  budgetNational?: boolean;
  budgetNationalMontant?: number;
  budgetNationalDevise?: string;
  budgetNationalPct?: number;
  bailleurs?: Bailleur[];
  // Pour PPP
  partiesPubliques?: PartieFinancement[];
  partiesPrivees?: PartieFinancement[];
  // Taux de change
  tauxChange?: Record<string, number>; // Ex: { "USD": 600, "EUR": 655 }
}

/**
 * Financement tel qu'envoyé à l'API : montants bruts par devise. Budget,
 * équivalents FCFA et pourcentages en sont absents — le serveur les calcule.
 */
export interface FinancementInput {
  type: 'MOP' | 'PPP';
  budgetNational?: boolean;
  budgetNationalMontant?: number;
  budgetNationalDevise?: string;
  bailleurs?: { nom: string; contributions: Contribution[] }[];
  partiesPubliques?: { nom: string; montant: number; devise: string }[];
  partiesPrivees?: { nom: string; montant: number; devise: string }[];
  tauxChange?: Record<string, number>;
}

export interface ProjectPermissions {
  projectCode: string;
  platformRole: string;
  /** Rôles détenus sur le projet ; les droits sont leur union. */
  roles: string[];
  permissions: string[];
  canAccessInitialisation: boolean;
  /** Où déposer des documents : `paths` null = tout le projet, [] = nulle part. */
  uploadScope: { paths: string[] | null; labels: string[] };
}

/** Membre d'équipe renvoyé par la jointure serveur de GET /projects. */
export interface ProjectTeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  projectRole: string;
}

export interface Project {
  code: string;
  name: string;
  description?: string;
  budget?: number;
  devise: string;
  progress: number;
  localisation?: Localisation;
  financement?: Financement;
  dateDebut?: string;
  dateFin?: string;
  components: Component[];
  createdBy: string;
  createdAt: string;
  /** Présent sur les listes (GET /projects), absent sur le détail. */
  team?: ProjectTeamMember[];
  /** Rôles de l'utilisateur courant sur le projet — présent sur les listes. */
  myRoles?: string[];
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  budget?: number;
  devise?: string;
  progress?: number;
  localisation?: Localisation;
  financement?: FinancementInput;
  dateDebut?: string;
  dateFin?: string;
  components?: Component[];
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  budget?: number;
  progress?: number;
  localisation?: Localisation;
  financement?: FinancementInput;
  /** `null` efface la date ; une clé absente la laisse inchangée. */
  dateDebut?: string | null;
  dateFin?: string | null;
  components?: Component[];
}

export const projectService = {
  /**
   * Get all projects
   */
  async getAll(region?: string): Promise<Project[]> {
    const params = region ? { region } : {};
    const response = await apiClient.get<ApiResponse<Project[]>>('/projects', { params });
    return response.data.data || [];
  },

  /**
   * Projets de l'espace Initialisation : ceux que l'utilisateur gère (chef de
   * projet) ou supervise (coordinateur). Tous pour l'admin.
   */
  async getInitialisationProjects(): Promise<Project[]> {
    const response = await apiClient.get<ApiResponse<Project[]>>('/projects', {
      params: { scope: 'initialisation' },
    });
    return response.data.data || [];
  },

  /**
   * Get project by code
   */
  async getByCode(code: string): Promise<Project> {
    const response = await apiClient.get<ApiResponse<Project>>(`/projects/${code}`);
    return response.data.data!;
  },

  /**
   * Permissions effectives de l'utilisateur courant sur le projet, calculées
   * par le serveur (rôle le plus élevé, coordinateur général global).
   */
  async getMyPermissions(code: string): Promise<ProjectPermissions> {
    const response = await apiClient.get<ApiResponse<ProjectPermissions>>(`/projects/${code}/permissions`);
    return response.data.data!;
  },

  /**
   * Get project statistics
   */
  async getStats(): Promise<{ total: number; avgProgress: number }> {
    const response = await apiClient.get<ApiResponse<{ total: number; avgProgress: number }>>(
      '/projects/stats'
    );
    return response.data.data!;
  },

  /**
   * Create project
   */
  async create(data: CreateProjectDto): Promise<Project> {
    const response = await apiClient.post<ApiResponse<Project>>('/projects', data);
    return response.data.data!;
  },

  /**
   * Update project
   */
  async update(code: string, data: UpdateProjectDto): Promise<Project> {
    return (await projectService.updateEtAvertissements(code, data)).project;
  },

  /**
   * Enregistre et rapporte ce que le serveur a déplacé de lui-même : quand une
   * unité est décomposée, ses documents de passation et d'exécution suivent sa
   * première sous-unité. Les écrans de structure montrent ces avertissements.
   */
  async updateEtAvertissements(
    code: string,
    data: UpdateProjectDto,
  ): Promise<{ project: Project; avertissements: string[] }> {
    const response = await apiClient.patch<ApiResponse<Project> & { warnings?: string[] }>(`/projects/${code}`, data);
    return { project: response.data.data!, avertissements: response.data.warnings ?? [] };
  },

  /**
   * Delete project
   */
  async delete(code: string): Promise<void> {
    await apiClient.delete(`/projects/${code}`);
  },
};

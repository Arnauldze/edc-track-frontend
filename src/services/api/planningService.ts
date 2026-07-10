// ══════════════════════════════════════════════════════════════
// PLANNING SERVICE - API Client
// ══════════════════════════════════════════════════════════════

import { apiClient } from './client';

// ── Types ──

export interface BudgetDevise {
  devise: string;
  montant: number;
  pourcentage?: number;
}

export interface Livrable {
  numero: string;
  intitule: string;
  ponderation: number;
  delaiMois: number; // Ancien champ, gardé pour compatibilité
  dateDebut?: Date;
  dateFin?: Date;
  duree?: number;
  dureeUnite?: 'jours' | 'semaines' | 'mois';
  delai?: number;
  delaiUnite?: 'jours' | 'semaines' | 'mois';
  dateEcheance?: Date;
  predecesseur?: string;
  successeur?: string;
  description?: string;
  statut?: 'en_attente' | 'soumis' | 'valide' | 'rejete';
}

export interface EtapePassation {
  ordre: number;
  nom: string;
  delaiJours: number;
  dateDebut?: Date;
  dateFin?: Date;
  statut?: 'non_demarre' | 'en_cours' | 'termine' | 'en_retard';
  responsable?: string;
}

export interface TacheExecution {
  numero: string;
  designation: string;
  unite?: string;
  quantite?: number;
  prixUnitaire?: number;
  dateDebut?: Date;
  dateFin?: Date;
  duree?: number;
  dureeUnite?: 'jours' | 'semaines' | 'mois';
  dureeJours?: number; // Legacy
  avancement?: number;
  responsable?: string;
}

export interface Planning {
  _id: string;
  projectCode: string;
  activityPath: string;
  activityName: string;
  activityType: 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi';
  
  // Types de planification
  hasEtudePrealable: boolean;
  hasPassation: boolean;
  hasExecution: boolean;
  
  // Budget
  budgetInitial: BudgetDevise[];
  budgetInitialTotal?: number;
  budgetActualise: BudgetDevise[];
  budgetActualiseTotal?: number;
  
  // Délais
  dateDebutInitiale?: Date;
  dateFinInitiale?: Date;
  delaiInitialMois?: number;
  dateDebutActualisee?: Date;
  dateFinActualisee?: Date;
  delaiActualiseMois?: number;
  
  // Responsables
  responsablePrincipal?: string;
  responsablesSecondaires?: string[];
  
  // Étude
  livrables: Livrable[];
  dateT0Etude?: Date;
  
  // Passation
  typePassation?: string;
  etapesPassation: EtapePassation[];
  dateDebutPassation?: Date;
  dateFinPassation?: Date;
  
  // Exécution
  tachesExecution: TacheExecution[];
  dateDebutExecution?: Date;
  dateFinExecution?: Date;
  
  // Métadonnées
  fichierImporte?: string;
  calibrageFichier?: Record<string, any>;
  notes?: string;
  createdBy: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanningDto {
  projectCode: string;
  activityPath: string;
  activityName: string;
  activityType: 'travaux' | 'fourniture' | 'services' | 'etudes' | 'pi';
  hasEtudePrealable?: boolean;
  hasPassation?: boolean;
  hasExecution?: boolean;
  budgetInitial?: BudgetDevise[];
  budgetInitialTotal?: number;
  dateDebutInitiale?: Date;
  dateFinInitiale?: Date;
  delaiInitialMois?: number;
  responsablePrincipal?: string;
  responsablesSecondaires?: string[];
  livrables?: Livrable[];
  dateT0Etude?: Date;
  typePassation?: string;
  etapesPassation?: EtapePassation[];
  dateDebutPassation?: Date;
  dateFinPassation?: Date;
  tachesExecution?: TacheExecution[];
  dateDebutExecution?: Date;
  dateFinExecution?: Date;
  fichierImporte?: string;
  calibrageFichier?: Record<string, any>;
  notes?: string;
}

export interface UpdatePlanningDto extends Partial<CreatePlanningDto> {
  budgetActualise?: BudgetDevise[];
  budgetActualiseTotal?: number;
  dateDebutActualisee?: Date;
  dateFinActualisee?: Date;
  delaiActualiseMois?: number;
}

export interface PlanningStats {
  totalActivites: number;
  avecEtude: number;
  avecPassation: number;
  avecExecution: number;
  budgetInitialTotal: number;
  budgetActualiseTotal: number;
}

export interface BudgetOverrun {
  activityPath: string;
  activityName: string;
  depassementPct: string;
  budgetInitial: number;
  budgetActualise: number;
  alerte: string;
}

// ── Service ──

class PlanningService {
  private baseUrl = '/planning';

  // Créer une planification
  async create(data: CreatePlanningDto): Promise<Planning> {
    const response = await apiClient.post(this.baseUrl, data);
    return response.data?.data || response.data;
  }

  // Récupérer toutes les planifications d'un projet
  async getByProject(projectCode: string): Promise<Planning[]> {
    const response = await apiClient.get(`${this.baseUrl}/project/${projectCode}`);
    const result = response.data?.data || response.data;
    return Array.isArray(result) ? result : [];
  }

  // Récupérer une planification spécifique
  async getOne(projectCode: string, activityPath: string): Promise<Planning> {
    const response = await apiClient.get(
      `${this.baseUrl}/project/${projectCode}/activity/${activityPath}`
    );
    return response.data?.data || response.data;
  }

  // Mettre à jour une planification
  async update(
    projectCode: string,
    activityPath: string,
    data: UpdatePlanningDto
  ): Promise<Planning> {
    const response = await apiClient.put(
      `${this.baseUrl}/project/${projectCode}/activity/${activityPath}`,
      data
    );
    return response.data?.data || response.data;
  }

  // Supprimer une planification
  async delete(projectCode: string, activityPath: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/project/${projectCode}/activity/${activityPath}`);
  }

  // Statistiques d'un projet
  async getProjectStats(projectCode: string): Promise<PlanningStats> {
    const response = await apiClient.get(
      `${this.baseUrl}/project/${projectCode}/stats`
    );
    return response.data?.data || response.data;
  }

  // Vérifier les dépassements de budget
  async checkBudgetOverruns(projectCode: string): Promise<BudgetOverrun[]> {
    const response = await apiClient.get(
      `${this.baseUrl}/project/${projectCode}/budget-overruns`
    );
    return response.data?.data || response.data;
  }
}

export const planningService = new PlanningService();

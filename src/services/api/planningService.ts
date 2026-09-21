// ══════════════════════════════════════════════════════════════
// PLANNING SERVICE - API Client
// ══════════════════════════════════════════════════════════════

import { apiClient } from './client';
import type { Calendrier } from '@/lib/livrableSchedule';
import type { Fiscalite, LigneDqe } from '@/lib/dqe';
import type { Echelle } from '@/lib/repartition';

// ── Types ──

export interface BudgetDevise {
  devise: string;
  montant: number;
  pourcentage?: number;
}

export interface Livrable {
  /** Identifiant interne stable, attribué à la création ou par le serveur. */
  id?: string;
  numero: string;
  intitule: string;
  ponderation: number;
  delaiMois?: number; // Ancien champ, gardé pour compatibilité
  dateDebut?: string | Date;
  /** Début saisi ; sinon il suit T0 ou le prédécesseur (voir lib/livrableSchedule.ts). */
  debutFixe?: boolean;
  dateFin?: string | Date;
  /** Saisie qui fixe l'échéance : durée, délai depuis T0 ou date. */
  modeFin?: 'duree' | 'delai' | 'fin';
  duree?: number;
  dureeUnite?: 'jours' | 'semaines' | 'mois';
  delai?: number;
  delaiUnite?: 'jours' | 'semaines' | 'mois';
  dateEcheance?: string | Date;
  predecesseur?: string;
  successeur?: string;
  description?: string;
  statut?: 'en_attente' | 'soumis' | 'valide' | 'rejete';
}

/** Ancien modèle d'étapes génériques, conservé pour les planifications déjà enregistrées. */
export interface EtapePassation {
  ordre: number;
  nom: string;
  delaiJours: number;
  dateDebut?: Date;
  dateFin?: Date;
  statut?: 'non_demarre' | 'en_cours' | 'termine' | 'en_retard';
  responsable?: string;
}

/**
 * Étape du marché d'une activité : une colonne datée du tableau de passation.
 * Une étape du modèle PPM a pour clé son code (saisineCIPM…), une étape
 * ajoutée à la main une clé générée (voir lib/passationEtapes.ts).
 */
export interface ColonnePassation {
  cle: string;
  designation: string;
  groupe: 'selection' | 'offres' | 'contractualisation';
  /** AAAA-MM-JJ à la saisie ; date ISO en retour de l'API. */
  date?: string;
  /** Étape à réponse fermée (VISA CA). */
  choix?: 'OUI' | 'NON' | 'N/A';
}

/** Colonnes « Synthèse et exécution » du marché, saisies à la main. */
export interface SynthesePassation {
  osDeDemarrage?: string;
  /** Jours. */
  delaiGlobalExecution?: number;
  dateReceptionProvisoire?: string;
  /** Jours. */
  periodeGarantie?: number;
  dateReceptionDefinitive?: string;
}

/** Ancien tableau à colonnes figées (un marché par ligne), gardé pour lecture : dates et nombres, étapes non renseignées absentes. */
export interface LignePassationApi {
  numero: string;
  designation?: string;
  typeAO?: string;
  typePrestation?: string;
  montantPrevisionnel?: number;
  sourceFinancement?: string;
  imputationBudgetaire?: string;
  saisineCIPM?: string | Date;
  examenDAOCIPM?: string | Date;
  nonObjectionBF1?: string | Date;
  lancementAO?: string | Date;
  depouillementOffres?: string | Date;
  rapportAnalyseSCA?: string | Date;
  examenRapportCIPM?: string | Date;
  nonObjectionBF2?: string | Date;
  ouvertureOF?: string | Date;
  rapportAnalyseOF?: string | Date;
  propositionAttributionCIPM?: string | Date;
  nonObjectionBF3?: string | Date;
  publicationResultats?: string | Date;
  souscriptionMarche?: string | Date;
  saisineCIPM2?: string | Date;
  examenMarcheCIPM?: string | Date;
  visaCA?: string;
  nonObjectionBF4?: string | Date;
  signatureMarche?: string | Date;
  notificationMarche?: string | Date;
  enregistrementMarche?: string | Date;
  delaiGlobalPassation?: number;
  osDeDemarrage?: string | Date;
  delaiGlobalExecution?: number;
  dateReceptionProvisoire?: string | Date;
  periodeGarantie?: number;
  dateReceptionDefinitive?: string | Date;
}

export interface TacheExecution {
  /** Identifiant interne stable, attribué à la création ou par le serveur. */
  id?: string;
  numero: string;
  designation: string;
  ponderation?: number;
  unite?: string;
  quantite?: number;
  prixUnitaire?: number;
  predecesseur?: string;
  successeur?: string;
  dateDebut?: string | Date;
  /** Début saisi ; sinon il suit T0 ou le prédécesseur (voir lib/livrableSchedule.ts). */
  debutFixe?: boolean;
  dateFin?: string | Date;
  dateEcheance?: string | Date;
  /** Saisie qui fixe l'échéance : durée, délai depuis T0 ou date. */
  modeFin?: 'duree' | 'delai' | 'fin';
  duree?: number;
  dureeUnite?: 'jours' | 'semaines' | 'mois';
  delai?: number;
  delaiUnite?: 'jours' | 'semaines' | 'mois';
  dureeJours?: number; // Legacy
  avancement?: number;
  responsable?: string;
  description?: string;
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

  /** Jours travaillés de l'activité ; absent, tous les jours comptent. */
  calendrier?: Calendrier;

  /** Devis quantitatif et estimatif du marché. */
  dqe?: LigneDqe[];
  fiscalite?: Fiscalite;
  /** Pas de temps de la répartition et des courbes. */
  echelle?: Echelle;

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
  lignesPassation: LignePassationApi[];
  // Marché de l'activité
  typeAO?: string;
  sourceFinancement?: string;
  imputationBudgetaire?: string;
  responsablePassation?: string;
  colonnesPassation?: ColonnePassation[];
  synthesePassation?: SynthesePassation;
  dateDebutPassation?: Date;
  dateFinPassation?: Date;
  
  // Exécution
  tachesExecution: TacheExecution[];
  dateDebutExecution?: Date;
  dateFinExecution?: Date;
  
  // Référence de base : absente tant qu'elle n'a pas été figée.
  reference?: ReferencePlanning;

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
  calendrier?: Calendrier;
  dqe?: LigneDqe[];
  fiscalite?: Fiscalite;
  echelle?: Echelle;
  dateDebutInitiale?: Date;
  dateFinInitiale?: Date;
  delaiInitialMois?: number;
  responsablePrincipal?: string;
  responsablesSecondaires?: string[];
  livrables?: Livrable[];
  dateT0Etude?: Date;
  typePassation?: string;
  etapesPassation?: EtapePassation[];
  lignesPassation?: LignePassationApi[];
  typeAO?: string;
  sourceFinancement?: string;
  imputationBudgetaire?: string;
  responsablePassation?: string;
  colonnesPassation?: ColonnePassation[];
  synthesePassation?: SynthesePassation;
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

/** Échéances d'une ligne au moment du figeage. */
export interface LigneReference {
  /** Identifiant interne de la ligne photographiée ; absent des références anciennes. */
  ligneId?: string;
  numero: string;
  /** 'etude' ou 'execution' : deux lignes peuvent porter le même numéro. */
  phase: string;
  dateDebut?: Date;
  dateFin?: Date;
}

/**
 * Photographie du plan à un instant choisi. Elle ne bouge plus tant qu'on ne la
 * refige pas, contrairement aux champs *Initiale : dateDebutInitiale est le T0
 * saisi et se déplace à chaque enregistrement.
 */
export interface ReferencePlanning {
  dateDebut?: Date;
  dateFin?: Date;
  delaiMois?: number;
  budgetTotal?: number;
  lignes: LigneReference[];
  figeeLe: Date;
  figeePar: string;
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

  // Figer le plan courant comme référence de base
  async figerReference(projectCode: string, activityPath: string): Promise<Planning> {
    const response = await apiClient.post(
      `${this.baseUrl}/project/${projectCode}/activity/${activityPath}/reference`
    );
    return response.data?.data || response.data;
  }

  // Retirer la référence de base
  async libererReference(projectCode: string, activityPath: string): Promise<Planning> {
    const response = await apiClient.delete(
      `${this.baseUrl}/project/${projectCode}/activity/${activityPath}/reference`
    );
    return response.data?.data || response.data;
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

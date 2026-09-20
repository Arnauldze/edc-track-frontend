// ══════════════════════════════════════════════════════════════
// API CLIENT - Axios Configuration
// ══════════════════════════════════════════════════════════════

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Jeton de session ──
//
// Le serveur pose le jeton dans un cookie httpOnly : c'est lui qui authentifie
// le navigateur, et le code de la page ne peut pas le lire — une faille XSS ne
// peut donc plus l'exfiltrer. Rien n'est écrit dans sessionStorage.
//
// La copie ci-dessous ne vit qu'en mémoire, le temps de l'onglet, et sert de
// repli à l'en-tête Authorization quand le cookie n'arrive pas (interface et
// API sur deux domaines, navigateur qui bloque les cookies tiers). Elle
// disparaît au rechargement : c'est alors le cookie qui prend le relais.

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
  // Indispensable pour que le navigateur émette le cookie de session.
  withCredentials: true,
});

// Request interceptor - Add JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    // Network error
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject({
        message: 'Erreur de connexion au serveur. Vérifiez votre connexion internet.',
        type: 'network',
        originalError: error
      });
    }

    const status = error.response.status;
    const errorData = error.response.data;

    // Handle different error codes
    switch (status) {
      case 400:
        // Bad Request
        console.error('Bad request details:', JSON.stringify(errorData, null, 2));
        break;

      case 401: {
        // Session expirée ou jeton révoqué : la copie mémoire ne vaut plus rien.
        setAccessToken(null);

        // Les routes d'authentification portent leur propre message — rediriger
        // ici rechargerait la page de connexion avant que l'utilisateur ait pu
        // lire « identifiant ou mot de passe incorrect ».
        const url = error.config?.url ?? '';
        const routeAuth = url.includes('/auth/');

        if (typeof window !== 'undefined' && !routeAuth && window.location.pathname !== '/login') {
          // La page en cours est conservée pour y revenir après reconnexion.
          const retour = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(retour)}`;
        }
        break;
      }

      case 403:
        // Forbidden
        console.error('Access forbidden:', errorData);
        break;

      case 404:
        // Not Found — often expected (e.g., checking if resource exists before creation)
        console.debug('Resource not found:', errorData);
        break;

      case 409:
        // Conflict (e.g., duplicate email)
        console.error('Conflict:', errorData);
        break;

      case 422:
        // Validation error
        console.error('Validation error:', errorData);
        break;

      case 429:
        // Trop de requêtes : plafond de la limitation de débit atteint.
        console.warn('Trop de requêtes:', errorData);
        break;

      case 500:
        // Server error
        console.error('Server error:', errorData);
        break;

      case 503:
        // Service unavailable
        console.error('Service unavailable:', errorData);
        break;

      default:
        console.error('API error:', status, errorData);
    }

    return Promise.reject(error);
  }
);

// ── Types ──

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  timestamp?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Error Handler ──

export function getErrorMessage(error: any): string {
  // Network error
  if (error.type === 'network') {
    return error.message;
  }

  // Axios error with response
  if (error.response?.data) {
    const data = error.response.data;

    // Backend error message
    if (data.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }

    // Backend error array (validation errors)
    if (Array.isArray(data.error)) {
      return data.error.join(', ');
    }

    // Backend error string
    if (data.error) {
      return data.error;
    }
  }

  // Axios error without response
  if (error.message) {
    // Timeout error
    if (error.code === 'ECONNABORTED') {
      return 'La requête a expiré. Veuillez réessayer.';
    }

    // Network error
    if (error.message === 'Network Error') {
      return 'Erreur de connexion au serveur.';
    }

    return error.message;
  }

  // Default error
  return 'Une erreur est survenue. Veuillez réessayer.';
}

// Get user-friendly error message based on status code
export function getErrorMessageByStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Requête invalide. Vérifiez les données saisies.';
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.';
    case 403:
      return 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
    case 404:
      return 'Ressource non trouvée.';
    case 409:
      return 'Conflit. Cette ressource existe déjà.';
    case 422:
      return 'Données invalides. Vérifiez les champs du formulaire.';
    case 429:
      return 'Trop de tentatives. Patientez une minute avant de réessayer.';
    case 500:
      return 'Erreur serveur. Veuillez réessayer plus tard.';
    case 503:
      return 'Service temporairement indisponible.';
    default:
      return 'Une erreur est survenue.';
  }
}

export default apiClient;

// ══════════════════════════════════════════════════════════════
// AUTH SERVICE - Authentication API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';

export interface LoginRequest {
  login: string;
  password: string;
}

/**
 * Le serveur pose le jeton dans un cookie httpOnly ; il le renvoie aussi dans
 * le corps de la réponse, conservé en mémoire le temps de l'onglet comme repli
 * de l'en-tête Authorization (cf. services/api/client.ts).
 */
export interface LoginResponse {
  accessToken: string;
  user: { mustChangePassword: boolean };
}

/** Profil et capacités de l'utilisateur, relus en base par le serveur. */
export interface CurrentUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  platformRole: 'admin' | 'user';
  position?: string;
  department?: string;
  canCreateProjects: boolean;
  canAccessInitialisation: boolean;
  /** Mot de passe temporaire : à remplacer avant d'accéder au reste. */
  mustChangePassword: boolean;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    return response.data.data!;
  },

  async me(): Promise<CurrentUserProfile> {
    const response = await apiClient.get<ApiResponse<CurrentUserProfile>>('/auth/me');
    return response.data.data!;
  },

  /**
   * Le changement invalide les jetons déjà émis pour ce compte : le serveur
   * en renvoie un neuf, sans quoi la session qui vient de changer son mot de
   * passe serait déconnectée à la requête suivante.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ accessToken: string }>>(
      '/auth/change-password',
      { currentPassword, newPassword },
    );
    return response.data.data!.accessToken;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};

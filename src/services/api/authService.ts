// ══════════════════════════════════════════════════════════════
// AUTH SERVICE - Authentication API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';
import { 
  transformLoginResponse, 
  type FrontendLoginResponse,
  type BackendLoginResponse 
} from './transformers';

export interface LoginRequest {
  login: string;
  password: string;
}

export type LoginResponse = FrontendLoginResponse;

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
}

export const authService = {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<BackendLoginResponse>>(
      '/auth/login',
      credentials
    );
    return transformLoginResponse(response.data.data!);
  },

  async me(): Promise<CurrentUserProfile> {
    const response = await apiClient.get<ApiResponse<CurrentUserProfile>>('/auth/me');
    return response.data.data!;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};

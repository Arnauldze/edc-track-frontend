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

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};

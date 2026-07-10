// ══════════════════════════════════════════════════════════════
// USER SERVICE - Users API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';
import { 
  transformUserFromBackend, 
  transformUserToBackend,
  type FrontendUser,
  type BackendUser 
} from './transformers';

export type User = FrontendUser;

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  login: string;
  password: string;
  platformRole?: 'admin' | 'user';
  status?: 'active' | 'inactive';
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  status?: 'active' | 'inactive';
}

export const userService = {
  /**
   * Get all users
   */
  async getAll(): Promise<User[]> {
    const response = await apiClient.get<ApiResponse<BackendUser[]>>('/users');
    const users = response.data.data || [];
    return users.map(transformUserFromBackend);
  },

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User> {
    const response = await apiClient.get<ApiResponse<BackendUser>>(`/users/${id}`);
    return transformUserFromBackend(response.data.data!);
  },

  /**
   * Create user
   */
  async create(data: CreateUserDto): Promise<User> {
    const backendData = {
      ...transformUserToBackend(data),
      password: data.password,
    };
    const response = await apiClient.post<ApiResponse<BackendUser>>('/users', backendData);
    return transformUserFromBackend(response.data.data!);
  },

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserDto): Promise<User> {
    const backendData = transformUserToBackend(data);
    const response = await apiClient.patch<ApiResponse<BackendUser>>(`/users/${id}`, backendData);
    return transformUserFromBackend(response.data.data!);
  },

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};

// ══════════════════════════════════════════════════════════════
// ALERT SERVICE - Alerts API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';

export type AlertType =
  | 'document_pending'
  | 'document_rejected'
  | 'deadline_approaching'
  | 'budget_alert'
  | 'team_change'
  | 'system_notification';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  _id: string;
  projectId?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  isRead: boolean;
  createdFor?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CreateAlertDto {
  projectId?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdFor?: string;
  metadata?: Record<string, any>;
}

export const alertService = {
  /**
   * Create alert
   */
  async create(data: CreateAlertDto): Promise<Alert> {
    const response = await apiClient.post<ApiResponse<Alert>>('/alerts', data);
    return response.data.data!;
  },

  /**
   * Get all alerts
   */
  async getAll(all?: boolean): Promise<Alert[]> {
    const params = all ? { all: 'true' } : {};
    const response = await apiClient.get<ApiResponse<Alert[]>>('/alerts', { params });
    return response.data.data || [];
  },

  /**
   * Get unread count
   */
  async getCount(): Promise<number> {
    const response = await apiClient.get<ApiResponse<{ count: number }>>('/alerts/count');
    return response.data.data?.count || 0;
  },

  /**
   * Get alerts by project
   */
  async getByProject(projectId: string): Promise<Alert[]> {
    const response = await apiClient.get<ApiResponse<Alert[]>>(
      `/alerts/project/${projectId}`
    );
    return response.data.data || [];
  },

  /**
   * Mark as read
   */
  async markAsRead(id: string): Promise<Alert> {
    const response = await apiClient.patch<ApiResponse<Alert>>(`/alerts/${id}/read`);
    return response.data.data!;
  },

  /**
   * Delete alert
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/alerts/${id}`);
  },
};

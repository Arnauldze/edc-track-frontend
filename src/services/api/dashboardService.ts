// ══════════════════════════════════════════════════════════════
// DASHBOARD SERVICE - Dashboard Statistics API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';

export interface DashboardStats {
  projects: {
    total: number;
    avgProgress: number;
  };
  documents: {
    total: number;
    byStatus: {
      valide: number;
      encours: number;
      rejete: number;
      manquant: number;
    };
  };
  alerts: {
    unread: number;
  };
}

export const dashboardService = {
  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    // Fetch all stats in parallel
    const [projectStats, alertCount] = await Promise.all([
      apiClient.get<ApiResponse<{ total: number; avgProgress: number }>>('/projects/stats'),
      apiClient.get<ApiResponse<{ count: number }>>('/alerts/count'),
    ]);

    return {
      projects: projectStats.data.data || { total: 0, avgProgress: 0 },
      documents: {
        total: 0,
        byStatus: {
          valide: 0,
          encours: 0,
          rejete: 0,
          manquant: 0,
        },
      },
      alerts: {
        unread: alertCount.data.data?.count || 0,
      },
    };
  },
};

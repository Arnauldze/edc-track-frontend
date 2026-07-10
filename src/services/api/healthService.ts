// ══════════════════════════════════════════════════════════════
// HEALTH SERVICE - Health Check API
// ══════════════════════════════════════════════════════════════

import apiClient from './client';

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  database: {
    status: string;
    name: string;
  };
  memory: {
    used: string;
    total: string;
  };
}

export const healthService = {
  /**
   * Check server health
   */
  async check(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthStatus>('/health');
    return response.data;
  },
};

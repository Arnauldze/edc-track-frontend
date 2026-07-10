// ══════════════════════════════════════════════════════════════
// TEAM SERVICE - Team Assignments API
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';

export interface TeamAssignment {
  _id: string;
  projectId: string;
  userId: string;
  functionalRole: string;
  projectRole: 'coordinateur_general' | 'coordinateur' | 'chef_projet' | 'contributeur' | 'view';
  level: 'project' | 'component' | 'subcomponent' | 'activity';
  entityId?: string;
  entityName?: string;
  activeInProject: boolean;
  assignedBy?: string;
  createdAt: string;
}

export interface CreateTeamAssignmentDto {
  projectId: string;
  userId: string;
  functionalRole?: string;
  projectRole?: 'coordinateur_general' | 'coordinateur' | 'chef_projet' | 'contributeur' | 'view';
  level?: 'project' | 'component' | 'subcomponent' | 'activity';
  entityId?: string;
  entityName?: string;
  assignedBy?: string;
}

export const teamService = {
  /**
   * Assign member to project
   */
  async assign(data: CreateTeamAssignmentDto): Promise<TeamAssignment> {
    const response = await apiClient.post<ApiResponse<TeamAssignment>>('/team', data);
    return response.data.data!;
  },

  /**
   * Get project team
   */
  async getProjectTeam(projectId: string): Promise<TeamAssignment[]> {
    const response = await apiClient.get<ApiResponse<TeamAssignment[]>>(
      `/team/project/${projectId}`
    );
    return response.data.data || [];
  },

  /**
   * Get user projects
   */
  async getUserProjects(userId: string): Promise<TeamAssignment[]> {
    const response = await apiClient.get<ApiResponse<TeamAssignment[]>>(
      `/team/user/${userId}`
    );
    return response.data.data || [];
  },

  /**
   * Deactivate assignment
   */
  async deactivate(id: string): Promise<TeamAssignment> {
    const response = await apiClient.patch<ApiResponse<TeamAssignment>>(
      `/team/${id}/deactivate`
    );
    return response.data.data!;
  },

  /**
   * Remove member
   */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/team/${id}`);
  },
};

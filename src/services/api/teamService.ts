// ══════════════════════════════════════════════════════════════
// TEAM SERVICE - Team Assignments API
// ══════════════════════════════════════════════════════════════

import type { ProjectRole } from "@/lib/rbacStore";
import apiClient, { ApiResponse } from './client';

export interface TeamAssignment {
  _id: string;
  projectId: string;
  userId: string;
  functionalRole: string;
  projectRole: ProjectRole;
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
  projectRole?: ProjectRole;
  level?: 'project' | 'component' | 'subcomponent' | 'activity';
  entityId?: string;
  entityName?: string;
  assignedBy?: string;
}

export type PreviousChefOutcome = 'contributeur' | 'retire';

export interface UpdateTeamAssignmentDto {
  projectRole?: ProjectRole;
  level?: 'project' | 'component' | 'subcomponent' | 'activity';
  entityId?: string;
  entityName?: string;
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
   * Modifie une affectation (rôle, niveau, entité) sans la recréer.
   */
  async update(id: string, data: UpdateTeamAssignmentDto): Promise<TeamAssignment> {
    const response = await apiClient.patch<ApiResponse<TeamAssignment>>(`/team/${id}`, data);
    return response.data.data!;
  },

  /**
   * Désigne le chef de projet ; l'ancien reste contributeur ou est retiré.
   */
  async changeChef(projectId: string, userId: string, previousChef: PreviousChefOutcome): Promise<void> {
    await apiClient.post(`/team/project/${projectId}/chef`, { userId, previousChef });
  },

  /**
   * Remove member
   */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/team/${id}`);
  },
};

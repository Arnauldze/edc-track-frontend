// ══════════════════════════════════════════════════════════════
// USER STORE - Connected to Backend API
// NO HARDCODED DATA - All data from API
// ══════════════════════════════════════════════════════════════

import { userService, type User, type CreateUserDto, type UpdateUserDto } from "@/services/api/userService";
import { teamService, type TeamAssignment } from "@/services/api/teamService";
import type { ProjectRole } from "@/lib/rbacStore";

// ── Users CRUD ──

export async function getUsers(): Promise<User[]> {
  return await userService.getAll();
}

export async function getUserById(id: string): Promise<User | undefined> {
  try {
    return await userService.getById(id);
  } catch {
    return undefined;
  }
}

export function getUserFullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

export async function addUser(user: CreateUserDto): Promise<User> {
  return await userService.create(user);
}

export async function updateUser(id: string, updates: UpdateUserDto): Promise<User> {
  return await userService.update(id, updates);
}

export async function deleteUser(id: string): Promise<void> {
  await userService.delete(id);
}

// ── Team Assignments ──

export async function getTeamAssignments(): Promise<TeamAssignment[]> {
  // Note: Backend doesn't have a "get all" endpoint for team assignments
  // This would need to be implemented or we fetch by project/user
  return [];
}

export async function getProjectTeam(projectId: string): Promise<TeamAssignment[]> {
  return await teamService.getProjectTeam(projectId);
}

export async function getActiveProjectTeam(projectId: string): Promise<TeamAssignment[]> {
  const team = await teamService.getProjectTeam(projectId);
  return team.filter((a) => a.activeInProject);
}

/**
 * Get user's project role
 * Hiérarchie : view < contributeur < chef_projet < coordinateur < coordinateur_general
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const assignments = await teamService.getUserProjects(userId);
  const assignment = assignments.find(
    (a) => a.projectId === projectId && a.activeInProject
  );
  return (assignment?.projectRole as ProjectRole) ?? null;
}

/**
 * Get all projects for a user
 */
export async function getUserProjects(userId: string): Promise<TeamAssignment[]> {
  const assignments = await teamService.getUserProjects(userId);
  return assignments.filter((a) => a.activeInProject);
}

export async function addTeamAssignment(assignment: {
  projectId: string;
  userId: string;
  functionalRole?: string;
  projectRole?: ProjectRole;
  level?: 'project' | 'component' | 'subcomponent' | 'activity';
  entityId?: string;
  entityName?: string;
  assignedBy?: string;
}): Promise<TeamAssignment> {
  return await teamService.assign(assignment);
}

export async function removeTeamAssignment(id: string): Promise<void> {
  await teamService.remove(id);
}

export async function updateTeamAssignment(
  id: string,
  active: boolean
): Promise<TeamAssignment> {
  if (!active) {
    return await teamService.deactivate(id);
  }
  // Note: Backend doesn't have a "reactivate" endpoint
  // This would need to be implemented
  throw new Error("Reactivation not implemented");
}

// Re-export types
export type { User, CreateUserDto, UpdateUserDto, TeamAssignment };


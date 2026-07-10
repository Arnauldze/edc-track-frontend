// ══════════════════════════════════════════════════════════════
// AUTH STORE — Session & Authentication
// Connected to Backend API - NO HARDCODED DATA
// ══════════════════════════════════════════════════════════════

import type { PlatformRole, ProjectRole } from "./rbacStore";
import { hasPermission, getPermissions, type Permission } from "./rbacStore";
import { authService, type LoginRequest } from "@/services/api/authService";

// ── Types ──

export type AuthSession = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  platformRole: PlatformRole;
  position?: string;
  department?: string;
  loginAt: string;
};

const SESSION_KEY = "edc_auth_session";
const TOKEN_KEY = "jwt_token";

// ── Session management ──

/**
 * Login with backend API
 */
export async function login(credentials: LoginRequest): Promise<AuthSession> {
  const response = await authService.login(credentials);
  
  // Store JWT token
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, response.accessToken);
  }
  
  // Store session
  const session: AuthSession = {
    userId: response.user.id,
    firstName: response.user.firstName,
    lastName: response.user.lastName,
    email: response.user.email,
    platformRole: response.user.platformRole,
    position: response.user.position,
    department: response.user.department,
    loginAt: new Date().toISOString(),
  };
  
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event("auth-changed"));
  }
  
  return session;
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    await authService.logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function getCurrentSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  return getCurrentSession()?.userId ?? null;
}

export function isLoggedIn(): boolean {
  return getCurrentSession() !== null;
}

export function isAdmin(): boolean {
  return getCurrentSession()?.platformRole === "admin";
}

export function getJwtToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

// ── Permission helpers ──

/**
 * Check if current user has permission on a project
 */
export function currentUserCan(
  projectRole: ProjectRole | null,
  permission: Permission,
): boolean {
  const session = getCurrentSession();
  if (!session) return false;
  return hasPermission(session.platformRole, projectRole, permission);
}

/**
 * Get all permissions for current user on a project
 */
export function currentUserPermissions(
  projectRole: ProjectRole | null,
): Permission[] {
  const session = getCurrentSession();
  if (!session) return [];
  return getPermissions(session.platformRole, projectRole);
}

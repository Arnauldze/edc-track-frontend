// ══════════════════════════════════════════════════════════════
// USER HELPERS - User utility functions
// ══════════════════════════════════════════════════════════════

import type { User } from '@/services/api/userService';

/**
 * Get user full name
 */
export function getUserFullName(user: User | { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}

/**
 * Get user initials
 */
export function getUserInitials(user: User | { firstName: string; lastName: string }): string {
  return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User): boolean {
  return user.platformRole === 'admin';
}

/**
 * Check if user is active
 */
export function isActive(user: User): boolean {
  return user.status === 'active';
}

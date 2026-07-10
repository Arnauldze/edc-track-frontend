// ══════════════════════════════════════════════════════════════
// ALERT STORE - Connected to Backend API
// NO HARDCODED DATA - All data from API
// ══════════════════════════════════════════════════════════════

import {
  alertService,
  type Alert,
  type CreateAlertDto,
  type AlertType,
  type AlertSeverity,
} from "@/services/api/alertService";

// ── Alerts CRUD ──

export async function getAlerts(all?: boolean): Promise<Alert[]> {
  return await alertService.getAll(all);
}

export async function getUnreadCount(): Promise<number> {
  return await alertService.getCount();
}

export async function getProjectAlerts(projectId: string): Promise<Alert[]> {
  return await alertService.getByProject(projectId);
}

export async function createAlert(data: CreateAlertDto): Promise<Alert> {
  return await alertService.create(data);
}

export async function markAlertAsRead(id: string): Promise<Alert> {
  return await alertService.markAsRead(id);
}

export async function deleteAlert(id: string): Promise<void> {
  await alertService.delete(id);
}

// ── Helper Functions ──

/**
 * Get alert icon based on severity
 */
export function getAlertIcon(severity: AlertSeverity): string {
  switch (severity) {
    case 'info':
      return '📘';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    case 'critical':
      return '🚨';
    default:
      return '📌';
  }
}

/**
 * Get alert color based on severity
 */
export function getAlertColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'info':
      return 'blue';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    case 'critical':
      return 'purple';
    default:
      return 'gray';
  }
}

/**
 * Get alert type label
 */
export function getAlertTypeLabel(type: AlertType): string {
  switch (type) {
    case 'document_pending':
      return 'Document Pending';
    case 'document_rejected':
      return 'Document Rejected';
    case 'deadline_approaching':
      return 'Deadline Approaching';
    case 'budget_alert':
      return 'Budget Alert';
    case 'team_change':
      return 'Team Change';
    case 'system_notification':
      return 'System Notification';
    default:
      return 'Notification';
  }
}

// Re-export types
export type { Alert, CreateAlertDto, AlertType, AlertSeverity };

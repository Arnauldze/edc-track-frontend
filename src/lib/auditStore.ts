// ══════════════════════════════════════════════════════════════
// AUDIT STORE - Connected to Backend API
// NO HARDCODED DATA - All data from API
// ══════════════════════════════════════════════════════════════

// Note: Backend audit module doesn't expose public endpoints
// Audit logs are created automatically by the backend
// This store is kept for future implementation if needed

export interface AuditLog {
  _id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Placeholder functions - to be implemented when backend exposes audit endpoints

export async function getAuditLogs(): Promise<AuditLog[]> {
  // TODO: Implement when backend has audit endpoint
  console.warn("Audit logs endpoint not yet implemented");
  return [];
}

export async function getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
  // TODO: Implement when backend has audit endpoint
  console.warn("Audit logs endpoint not yet implemented");
  return [];
}

export async function getAuditLogsByEntity(
  entity: string,
  entityId: string
): Promise<AuditLog[]> {
  // TODO: Implement when backend has audit endpoint
  console.warn("Audit logs endpoint not yet implemented");
  return [];
}

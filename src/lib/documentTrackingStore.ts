// ══════════════════════════════════════════════════════════════
// DOCUMENT TRACKING STORE - Connected to Backend API
// NO HARDCODED DATA - All data from API
// ══════════════════════════════════════════════════════════════

import {
  type DocumentMetadata,
  uploadDocument,
  getDocuments,
  approveDocument,
  rejectDocument,
  trashDocument,
  restoreDocument,
  deleteDocument,
  type UploadDocumentParams,
} from "@/services/api/documentService";

// ── Types for Frontend Compatibility ──

export type TrackingSteps = {
  soumis: boolean;
  enRevue: boolean;
  approuve: boolean;
  rejete: boolean;
};

export type TrackedDocument = DocumentMetadata & {
  lineageId?: string; // Computed on frontend
  steps?: TrackingSteps; // Computed from status
};

// ── Helper: Convert backend status to frontend steps ──

function statusToSteps(status: string): TrackingSteps {
  switch (status) {
    case 'valide':
      return { soumis: true, enRevue: false, approuve: true, rejete: false };
    case 'rejete':
      return { soumis: true, enRevue: false, approuve: false, rejete: true };
    case 'encours':
      return { soumis: true, enRevue: true, approuve: false, rejete: false };
    case 'manquant':
      return { soumis: false, enRevue: false, approuve: false, rejete: false };
    default:
      return { soumis: true, enRevue: false, approuve: false, rejete: false };
  }
}

// ── Helper: Compute lineage ID ──

function computeLineageId(doc: DocumentMetadata): string {
  return `${doc.projectId}|${doc.phase}|${doc.folderName}|${doc.fileName}`;
}

// ── Helper: Enhance document with frontend fields ──

function enhanceDocument(doc: DocumentMetadata): TrackedDocument {
  return {
    ...doc,
    lineageId: computeLineageId(doc),
    steps: statusToSteps(doc.status),
  };
}

// ── READ ──

export async function getTrackedDocuments(
  projectId?: string,
  phase?: string,
  folderName?: string,
  context?: string,
): Promise<TrackedDocument[]> {
  const filters: any = {};
  if (projectId) filters.projectId = projectId;
  if (phase) filters.phase = phase;
  if (context) filters.context = context;
  // Note: Backend doesn't support folderName filter directly
  // We'll filter on frontend if needed
  
  const docs = await getDocuments(filters);
  let result = docs.map(enhanceDocument);
  
  if (folderName) {
    result = result.filter((d) => d.folderName === folderName);
  }
  
  return result;
}

export async function getTrackedDocumentsLatest(
  projectId?: string,
  phase?: string,
  folderName?: string,
  context?: string,
): Promise<TrackedDocument[]> {
  const docs = await getTrackedDocuments(projectId, phase, folderName, context);
  
  // Keep only latest version per lineage
  const latestMap = new Map<string, TrackedDocument>();
  for (const doc of docs) {
    const existing = latestMap.get(doc.lineageId!);
    if (!existing || doc.version > existing.version) {
      latestMap.set(doc.lineageId!, doc);
    }
  }
  
  return Array.from(latestMap.values());
}

export async function getTrashedDocuments(
  projectId?: string,
  phase?: string,
  context?: string,
): Promise<TrackedDocument[]> {
  const filters: any = { isTrashed: true };
  if (projectId) filters.projectId = projectId;
  if (phase) filters.phase = phase;
  if (context) filters.context = context;
  
  const docs = await getDocuments(filters);
  return docs.map(enhanceDocument);
}

// ── CREATE (upload) ──

export async function addTrackedDocument(
  file: File,
  data: Omit<UploadDocumentParams, 'file'>,
): Promise<TrackedDocument> {
  const doc = await uploadDocument({ ...data, file });
  return enhanceDocument(doc);
}

// ── UPDATE (approve/reject) ──

export async function markTrackedDocumentApproved(docId: string): Promise<TrackedDocument> {
  const doc = await approveDocument(docId);
  return enhanceDocument(doc);
}

export async function markTrackedDocumentRejected(docId: string): Promise<TrackedDocument> {
  // Note: Backend reject requires a reason
  const doc = await rejectDocument(docId, "Rejected");
  return enhanceDocument(doc);
}

export async function rejectTrackedDocumentWithReason(
  docId: string,
  reason: string,
): Promise<TrackedDocument> {
  const doc = await rejectDocument(docId, reason);
  return enhanceDocument(doc);
}

// ── DELETE (trash/restore) ──

export async function moveTrackedDocumentToTrash(
  docId: string,
  reason: string,
): Promise<void> {
  await trashDocument(docId, reason);
}

export async function restoreTrackedDocumentFromTrash(docId: string): Promise<TrackedDocument> {
  const doc = await restoreDocument(docId);
  return enhanceDocument(doc);
}

export async function permanentlyDeleteFromTrash(
  docId: string,
  reason: string,
): Promise<void> {
  // Note: Backend doesn't require reason for permanent delete
  await deleteDocument(docId);
}

export async function removeTrackedDocument(docId: string): Promise<void> {
  await deleteDocument(docId);
}

// ── STATS ──

export async function getFolderTrackingStats(
  projectId: string,
  phase: string,
  folderName: string,
): Promise<{ total: number; approved: number; pct: number }> {
  const docs = await getTrackedDocumentsLatest(projectId, phase, folderName);
  const total = docs.length;
  const approved = docs.filter((d) => d.status === 'valide').length;
  
  return {
    total,
    approved,
    pct: total > 0 ? Math.round((approved / total) * 100) : 0,
  };
}

// Re-export types
export type { DocumentMetadata, UploadDocumentParams };

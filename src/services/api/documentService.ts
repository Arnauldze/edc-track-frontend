import { apiClient } from './client';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface DocumentMetadata {
  _id: string;
  projectId: string;
  phase: 'etude' | 'passation' | 'execution';
  folderName: string;
  fileName: string;
  fileSize?: string;
  fileType?: string;
  filePath: string;
  version: number;
  status: 'encours' | 'valide' | 'rejete' | 'manquant';
  uploadedBy: string;
  tracking?: {
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    rejectionReason?: string;
  };
  isTrashed: boolean;
  trashReason?: string;
  trashedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadDocumentParams {
  projectId: string;
  phase: string;
  folderName: string;
  context?: string;
  file: File;
}

export interface DocumentFilters {
  projectId?: string;
  phase?: string;
  context?: string;
  status?: string;
  isTrashed?: boolean;
}

export interface DocumentStats {
  _id: string;
  count: number;
}

// ══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Upload un document
 */
export async function uploadDocument(params: UploadDocumentParams): Promise<DocumentMetadata> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('projectId', params.projectId);
  formData.append('phase', params.phase);
  formData.append('folderName', params.folderName);

  const response = await apiClient.post<{ data: DocumentMetadata }>('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

/**
 * Récupère tous les documents avec filtres optionnels
 */
export async function getDocuments(filters?: DocumentFilters): Promise<DocumentMetadata[]> {
  const params = new URLSearchParams();
  
  if (filters?.projectId) params.append('projectId', filters.projectId);
  if (filters?.phase) params.append('phase', filters.phase);
  if (filters?.context) params.append('context', filters.context);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.isTrashed !== undefined) params.append('isTrashed', String(filters.isTrashed));

  const response = await apiClient.get<{ data: DocumentMetadata[] }>(`/documents?${params.toString()}`);
  return response.data.data;
}

/**
 * Récupère les documents d'un projet et d'une phase spécifique
 */
export async function getProjectPhaseDocuments(
  projectId: string,
  phase: string,
): Promise<DocumentMetadata[]> {
  return getDocuments({ projectId, phase, isTrashed: false });
}

/**
 * Récupère les documents en corbeille
 */
export async function getTrashedDocuments(
  projectId: string,
  phase?: string,
): Promise<DocumentMetadata[]> {
  return getDocuments({ projectId, phase, isTrashed: true });
}

/**
 * Récupère un document par son ID
 */
export async function getDocumentById(id: string): Promise<DocumentMetadata> {
  const response = await apiClient.get<{ data: DocumentMetadata }>(`/documents/${id}`);
  return response.data.data;
}

/**
 * Télécharge un document
 */
export async function downloadDocument(id: string, fileName: string): Promise<void> {
  const response = await apiClient.get(`/documents/${id}/download`, {
    responseType: 'blob',
  });

  // Créer un lien de téléchargement
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Approuve un document
 */
export async function approveDocument(id: string): Promise<DocumentMetadata> {
  const response = await apiClient.patch<{ data: DocumentMetadata }>(`/documents/${id}/approve`);
  return response.data.data;
}

/**
 * Rejette un document avec un motif
 */
export async function rejectDocument(id: string, reason: string): Promise<DocumentMetadata> {
  const response = await apiClient.patch<{ data: DocumentMetadata }>(`/documents/${id}/reject`, {
    reason,
  });
  return response.data.data;
}

/**
 * Déplace un document vers la corbeille
 */
export async function trashDocument(id: string, reason: string): Promise<DocumentMetadata> {
  const response = await apiClient.patch<{ data: DocumentMetadata }>(`/documents/${id}/trash`, {
    reason,
  });
  return response.data.data;
}

/**
 * Restaure un document depuis la corbeille
 */
export async function restoreDocument(id: string): Promise<DocumentMetadata> {
  const response = await apiClient.patch<{ data: DocumentMetadata }>(`/documents/${id}/restore`);
  return response.data.data;
}

/**
 * Supprime définitivement un document
 */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

/**
 * Récupère les statistiques des documents d'un projet
 */
export async function getDocumentStats(
  projectId: string,
  phase?: string,
): Promise<DocumentStats[]> {
  const params = phase ? `?phase=${phase}` : '';
  const response = await apiClient.get<{ data: DocumentStats[] }>(
    `/documents/stats/${projectId}${params}`,
  );
  return response.data.data;
}

/**
 * Récupère les dernières versions des documents pour un dossier
 */
export async function getLatestDocumentVersions(
  projectId: string,
  phase: string,
  folderName: string,
): Promise<DocumentMetadata[]> {
  const allDocs = await getProjectPhaseDocuments(projectId, phase);
  
  // Filtrer par dossier et garder seulement la dernière version de chaque fichier
  const docsByFile = new Map<string, DocumentMetadata>();
  
  allDocs
    .filter((doc) => doc.folderName === folderName)
    .forEach((doc) => {
      const existing = docsByFile.get(doc.fileName);
      if (!existing || doc.version > existing.version) {
        docsByFile.set(doc.fileName, doc);
      }
    });
  
  return Array.from(docsByFile.values());
}

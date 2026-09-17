// ══════════════════════════════════════════════════════════════
// FOLDER SERVICE — dossiers de la GED
// Un dossier peut exister avant son premier dépôt ; les documents restent
// rattachés à leur dossier par son nom (folderName).
// ══════════════════════════════════════════════════════════════

import apiClient, { ApiResponse } from './client';

export type DocumentPhase = 'etude' | 'passation' | 'execution';

export interface Folder {
  _id: string;
  projectId: string;
  phase: DocumentPhase;
  context: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

/** Sans contexte, renvoie tous les dossiers du projet : l'explorateur en a besoin pour son arbre. */
export async function listFolders(projectId: string, context?: string): Promise<Folder[]> {
  const response = await apiClient.get<ApiResponse<Folder[]>>('/folders', {
    params: context ? { projectId, context } : { projectId },
  });
  return response.data.data || [];
}

export async function createFolder(params: {
  projectId: string;
  phase: DocumentPhase;
  context: string;
  name: string;
}): Promise<Folder> {
  const response = await apiClient.post<ApiResponse<Folder>>('/folders', params);
  return response.data.data!;
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(`/folders/${id}`);
}

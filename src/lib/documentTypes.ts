// ══════════════════════════════════════════════════════════════
// TYPES DE FICHIERS ACCEPTÉS PAR LA GED
// Miroir de backend/src/modules/documents/document-types.ts, qui fait
// autorité : le serveur refuse tout autre format. Ce filtre évite
// seulement de téléverser un fichier pour se le voir refuser ensuite.
// ══════════════════════════════════════════════════════════════

export const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "dwg", "zip", "png", "jpg", "jpeg"];

/** Valeur de l'attribut `accept` du sélecteur de fichiers. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export const fileExtension = (fileName: string) =>
  fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";

export const isAcceptedFile = (fileName: string) => ACCEPTED_EXTENSIONS.includes(fileExtension(fileName));

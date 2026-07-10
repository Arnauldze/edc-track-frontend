// ══════════════════════════════════════
// GED TEMPLATES — Structure vide pour projets neufs
// Étapes et dossiers sans fichiers par défaut
// ══════════════════════════════════════

export type DocDataTemplate = {
    name: string;
    desc: string;
    type: "pdf" | "xls" | "doc" | "plan" | "folder";
    date: string;
    status: "manquant";
    files: never[];
};

/** Étude — dossiers vides */
export const EMPTY_ETUDE_DOCS: DocDataTemplate[] = [
    { name: "Avant-Projet Sommaire (APS)", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Avant-Projet Détaillé (APD)", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Budget Prévisionnel", desc: "Aucun fichier", type: "xls", date: "—", status: "manquant", files: [] },
    { name: "Étude de faisabilité", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Pièces graphiques", desc: "Aucun fichier", type: "plan", date: "—", status: "manquant", files: [] },
];

/** Passation — dossiers vides */
export const EMPTY_PASSATION_DOCS: DocDataTemplate[] = [
    { name: "DAO", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Avis d'appel d'offres", desc: "Aucun fichier", type: "doc", date: "—", status: "manquant", files: [] },
    { name: "Offres soumissionnaires", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "PV ouverture des plis", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "PV proposition d'attribution", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "ANO DAO", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Décision d'attribution", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Contrat signé", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
];

/** Exécution — dossiers vides */
export const EMPTY_EXECUTION_DOCS: DocDataTemplate[] = [
    { name: "Contrats / Notifications", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Ordre de Service", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "PV / Exécution", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Garanties", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Plans et documents techniques", desc: "Aucun fichier", type: "plan", date: "—", status: "manquant", files: [] },
    { name: "Assurances", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Décomptes / Factures", desc: "Aucun fichier", type: "xls", date: "—", status: "manquant", files: [] },
    { name: "Rapports MOE", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Correspondances", desc: "Aucun fichier", type: "doc", date: "—", status: "manquant", files: [] },
    { name: "Missions", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Résiliation", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
    { name: "Autres", desc: "Aucun fichier", type: "pdf", date: "—", status: "manquant", files: [] },
];

"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Search, FileCheck, FileClock, FileX, Folder, HardDrive, Grid3x3, List } from "lucide-react";
import Link from "next/link";
import { getProjects, type Project } from "@/lib/projectStore";
import { getTrackedDocumentsLatest } from "@/lib/documentTrackingStore";

// Type pour les statistiques d'archives
type ArchiveStats = {
    totalSize: number; // en bytes
    folderCount: number;
    fileCount: number;
    validatedCount: number;
    pendingCount: number;
    rejectedCount: number;
};

type ViewMode = "grid" | "list";

export default function ArchivesPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [archiveStats, setArchiveStats] = useState<Record<string, ArchiveStats>>({});
    const [viewMode, setViewMode] = useState<ViewMode>("grid");

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const projectsData = await getProjects();
        setProjects(projectsData);

        // Load archive statistics for each project
        const stats: Record<string, ArchiveStats> = {};
        for (const project of projectsData) {
            try {
                const docs = await getTrackedDocumentsLatest(project.code);
                
                // Calculate statistics
                let totalSize = 0;
                let fileCount = 0;
                let validatedCount = 0;
                let pendingCount = 0;
                let rejectedCount = 0;
                
                // Compter les dossiers (composants + sous-composants)
                const folderCount = (project.components?.length || 0) + 
                    (project.components?.reduce((sum, c) => sum + (c.sousComposants?.length || 0), 0) || 0);

                docs.forEach(doc => {
                    fileCount++;
                    // Estimer la taille (simulé pour l'instant - devrait venir de la DB)
                    totalSize += Math.random() * 5000000; // 0-5MB par fichier
                    
                    if (doc.status === "approved") validatedCount++;
                    else if (doc.status === "rejected") rejectedCount++;
                    else pendingCount++;
                });

                stats[project.code] = {
                    totalSize,
                    folderCount,
                    fileCount,
                    validatedCount,
                    pendingCount,
                    rejectedCount,
                };
            } catch {
                stats[project.code] = {
                    totalSize: 0,
                    folderCount: 0,
                    fileCount: 0,
                    validatedCount: 0,
                    pendingCount: 0,
                    rejectedCount: 0,
                };
            }
        }
        setArchiveStats(stats);
    }

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 KB";
        const k = 1024;
        const sizes = ["KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i - 1] || "KB"}`;
    };

    const getStatsForProject = (projectCode: string): ArchiveStats => {
        return archiveStats[projectCode] || {
            totalSize: 0,
            folderCount: 0,
            fileCount: 0,
            validatedCount: 0,
            pendingCount: 0,
            rejectedCount: 0,
        };
    };

    const filtered = projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.localisation?.region || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full">
            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                        <FolderOpen size={20} strokeWidth={1.8} className="text-[var(--text-tertiary)]" />
                        Archives
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                        Gestion Électronique des Documents par projet
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Toggle vue grille/liste */}
                    <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] p-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                                viewMode === "grid"
                                    ? "bg-[var(--accent)] text-white"
                                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"
                            }`}
                            title="Affichage en grille"
                        >
                            <Grid3x3 size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                                viewMode === "list"
                                    ? "bg-[var(--accent)] text-white"
                                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"
                            }`}
                            title="Affichage en liste"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    {/* Recherche */}
                    <div className="relative w-72">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input
                            type="text"
                            placeholder="Rechercher un projet..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20"
                        />
                    </div>
                </div>
            </div>

            {/* ── Project Grid or List ── */}
            {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filtered.map((project) => {
                        const stats = getStatsForProject(project.code);
                        return (
                            <Link key={project.code} href={`/archives/${project.code}`}>
                                <div className="group bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-200 cursor-pointer">
                                    <div className="p-5 space-y-3.5">
                                        {/* Titre */}
                                        <h3 className="text-[15px] font-bold text-[var(--text-primary)] line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-[var(--accent)] transition-colors">
                                            {project.name}
                                        </h3>

                                        {/* Code projet + Région */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-[var(--text-tertiary)] font-semibold">
                                                {project.code}
                                            </span>
                                            {project.localisation?.region && (
                                                <>
                                                    <span className="text-[var(--text-tertiary)]">•</span>
                                                    <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                                                        {project.localisation.region}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Statistiques principales */}
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            {/* Taille totale */}
                                            <div className="flex items-center gap-2">
                                                <HardDrive size={14} className="text-[var(--text-tertiary)]" />
                                                <div>
                                                    <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">Taille</div>
                                                    <div className="text-[13px] font-bold text-[var(--text-primary)]">
                                                        {formatFileSize(stats.totalSize)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Nombre de dossiers */}
                                            <div className="flex items-center gap-2">
                                                <Folder size={14} className="text-[var(--text-tertiary)]" />
                                                <div>
                                                    <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">Dossiers</div>
                                                    <div className="text-[13px] font-bold text-[var(--text-primary)]">
                                                        {stats.folderCount}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Statistiques fichiers */}
                                        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                                            <div className="text-[11px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">
                                                Fichiers ({stats.fileCount})
                                            </div>
                                            <div className="flex items-center gap-3 text-[12px]">
                                                <div className="flex items-center gap-1.5">
                                                    <FileCheck size={12} className="text-green-600" />
                                                    <span className="text-[var(--text-secondary)]">{stats.validatedCount} validés</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <FileClock size={12} className="text-amber-600" />
                                                    <span className="text-[var(--text-secondary)]">{stats.pendingCount} en cours</span>
                                                </div>
                                                {stats.rejectedCount > 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <FileX size={12} className="text-red-600" />
                                                        <span className="text-[var(--text-secondary)]">{stats.rejectedCount} rejetés</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}

                    {filtered.length === 0 && (
                        <div className="col-span-full text-center py-16 text-[var(--text-tertiary)]">
                            <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucun projet trouvé</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map((project) => {
                        const stats = getStatsForProject(project.code);
                        return (
                            <Link key={project.code} href={`/archives/${project.code}`}>
                                <div className="group bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)] transition-all duration-200 cursor-pointer">
                                    <div className="flex items-center gap-4 p-4">
                                        {/* Icône */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-[var(--radius-md)] bg-emerald-500/10 flex items-center justify-center">
                                            <FolderOpen size={20} className="text-emerald-600" />
                                        </div>

                                        {/* Infos projet */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-secondary)]">
                                                <span className="font-semibold">{project.code}</span>
                                                {project.localisation?.region && (
                                                    <>
                                                        <span className="text-[var(--text-tertiary)]">•</span>
                                                        <span>{project.localisation.region}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats compactes */}
                                        <div className="flex items-center gap-6 text-[12px]">
                                            <div className="flex items-center gap-1.5">
                                                <HardDrive size={14} className="text-[var(--text-tertiary)]" />
                                                <span className="font-semibold text-[var(--text-primary)]">{formatFileSize(stats.totalSize)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Folder size={14} className="text-[var(--text-tertiary)]" />
                                                <span className="font-semibold text-[var(--text-primary)]">{stats.folderCount}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1">
                                                    <FileCheck size={12} className="text-green-600" />
                                                    <span className="text-[var(--text-secondary)]">{stats.validatedCount}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <FileClock size={12} className="text-amber-600" />
                                                    <span className="text-[var(--text-secondary)]">{stats.pendingCount}</span>
                                                </div>
                                                {stats.rejectedCount > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <FileX size={12} className="text-red-600" />
                                                        <span className="text-[var(--text-secondary)]">{stats.rejectedCount}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}

                    {filtered.length === 0 && (
                        <div className="text-center py-16 text-[var(--text-tertiary)]">
                            <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucun projet trouvé</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

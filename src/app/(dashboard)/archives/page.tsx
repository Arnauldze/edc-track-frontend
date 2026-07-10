"use client";

import { useEffect, useState } from "react";
import { FolderOpen, ChevronRight, AlertCircle, Search } from "lucide-react";
import Link from "next/link";
import { getProjects, type Project } from "@/lib/projectStore";
import { getProjectAlerts } from "@/lib/alertStore";

export default function ArchivesPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [projectAlerts, setProjectAlerts] = useState<Record<string, number>>({});

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const projectsData = await getProjects();
        setProjects(projectsData);

        // Load alert counts for each project
        const alertCounts: Record<string, number> = {};
        for (const project of projectsData) {
            try {
                const alerts = await getProjectAlerts(project.code);
                alertCounts[project.code] = alerts.filter(a => !a.isRead).length;
            } catch {
                alertCounts[project.code] = 0;
            }
        }
        setProjectAlerts(alertCounts);
    }

    function getUnresolvedCountForProject(projectCode: string): number {
        return projectAlerts[projectCode] || 0;
    }

    const filtered = projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.localisation?.region || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getBarColor = (pct: number) =>
        pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : pct > 0 ? "bg-amber-500" : "bg-[var(--bg-surface-active)]";

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
                        Gestion Électronique des Documents (GED) par projet
                    </p>
                </div>
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

            {/* ── Project List ── */}
            <div className="flex flex-col gap-3">
                {filtered.map((project) => (
                    <Link key={project.code} href={`/archives/${project.code}`}>
                        <div className="group flex items-center bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-200 cursor-pointer">
                            {/* Accent stripe */}
                            <div className="w-1 self-stretch flex-shrink-0 bg-emerald-500" />

                            <div className="flex flex-1 items-center px-5 py-4 gap-6">
                                {/* Project Info */}
                                <div className="flex-1 min-w-[180px]">
                                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                        {project.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--text-secondary)]">
                                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-inset)] text-[var(--text-secondary)] text-[10px] font-semibold">
                                            {project.localisation?.region || "N/A"}
                                        </span>
                                        <span className="text-[var(--text-tertiary)]">·</span>
                                        <span>GED</span>
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="w-40 flex flex-col gap-1.5">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-[var(--text-tertiary)] font-medium">Avancement</span>
                                        <span className="text-[var(--text-primary)] font-bold">{project.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[var(--bg-inset)] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getBarColor(project.progress)}`}
                                            style={{ width: `${project.progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Alerts */}
                                {getUnresolvedCountForProject(project.code) > 0 && (
                                    <span className="flex items-center gap-1 text-[12px] font-semibold text-red-500">
                                        <AlertCircle size={14} /> {getUnresolvedCountForProject(project.code)}
                                    </span>
                                )}

                                {/* Arrow */}
                                <ChevronRight size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </div>
                        </div>
                    </Link>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center py-16 text-[var(--text-tertiary)]">
                        <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucun projet trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );
}

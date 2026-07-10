"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronRight, Search, Plus } from "lucide-react";
import Link from "next/link";
import { getProjects, type Project } from "@/lib/projectStore";

export default function PlanificationPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const projectsData = await getProjects();
        setProjects(projectsData);
    }

    const filtered = projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full">
            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                        <Calendar size={20} strokeWidth={1.8} className="text-[var(--text-tertiary)]" />
                        Planification
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                        Planification et ordonnancement des activités projet
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

            {/* ── Project Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((project) => {
                    const totalActivities = project.components.reduce(
                        (sum, c) => sum + c.sousComposants.reduce((s, sc) => s + sc.activities.length, 0), 0
                    );
                    return (
                        <div
                            key={project.code}
                            className="group bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-200"
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                            {project.name}
                                        </h3>
                                        <span className="text-[10px] text-[var(--text-tertiary)] font-semibold bg-[var(--bg-inset)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                                            {project.code}
                                        </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-blue-500/10 flex items-center justify-center">
                                        <Calendar size={14} className="text-blue-500" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-2.5 text-center">
                                        <div className="text-[16px] font-bold text-[var(--text-primary)]">{project.components.length}</div>
                                        <div className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">Comp.</div>
                                    </div>
                                    <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-2.5 text-center">
                                        <div className="text-[16px] font-bold text-[var(--text-primary)]">
                                            {project.components.reduce((s, c) => s + c.sousComposants.length, 0)}
                                        </div>
                                        <div className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">S/Comp.</div>
                                    </div>
                                    <div className="bg-[var(--bg-inset)] rounded-[var(--radius-md)] p-2.5 text-center">
                                        <div className="text-[16px] font-bold text-[var(--text-primary)]">{totalActivities}</div>
                                        <div className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">Activ.</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-24 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${project.progress >= 80 ? "bg-green-500" : project.progress >= 40 ? "bg-blue-500" : "bg-amber-500"}`}
                                                style={{ width: `${project.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-[11px] font-bold text-[var(--text-primary)]">{project.progress}%</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                                        {project.dateDebut ? new Date(project.dateDebut).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—"}
                                        {" → "}
                                        {project.dateFin ? new Date(project.dateFin).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—"}
                                    </span>
                                </div>
                            </div>

                            <Link
                                href={`/planification/${project.code}`}
                                className="border-t border-[var(--border-subtle)] px-5 py-3 bg-[var(--bg-inset)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 text-[11px] font-semibold text-[var(--accent)] group/link"
                            >
                                <Calendar size={12} />
                                Planifier ce projet
                                <ChevronRight size={12} className="group-hover/link:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16 text-[var(--text-tertiary)]">
                    <Calendar size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun projet trouvé</p>
                </div>
            )}
        </div>
    );
}

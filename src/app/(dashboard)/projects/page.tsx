"use client";

import { useEffect, useState } from "react";
import { Settings, Plus, Users, Edit2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProjects, formatProjectBudget, getProjectLocation, type Project } from "@/lib/projectStore";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { getErrorMessage } from "@/services/api/client";

// ══════════════════════════════════════
// PAGE — INITIALISATION
// ══════════════════════════════════════

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getProjects();
            setProjects(data);
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    if (loading) {
        return (
            <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full">
                <LoadingSpinner size="lg" className="min-h-[400px]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full">
                <ErrorDisplay error={error} retry={fetchProjects} />
            </div>
        );
    }

    return (
        <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full">
            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                        <Settings size={20} strokeWidth={1.8} className="text-[var(--text-tertiary)]" />
                        Initialisation
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                        Créez, configurez et paramétrez vos projets d&apos;infrastructure
                    </p>
                </div>
                <Link
                    href="/projects/new"
                    className="flex items-center gap-1.5 bg-[var(--text-primary)] text-[var(--text-inverted)] px-4 py-2 rounded-[var(--radius-md)] text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-[var(--shadow-sm)]"
                >
                    <Plus size={14} /> Nouveau projet
                </Link>
            </div>

            {/* ── Project List ── */}
            <div className="flex flex-col gap-3">
                {projects.map((project) => {
                    const totalComp = project.components?.length || 0;
                    const totalSC = project.components?.reduce((s, c) => s + (c.sousComposants?.length || 0), 0) || 0;
                    const totalAct = project.components?.reduce((s, c) => 
                        s + (c.sousComposants?.reduce((ss, sc) => ss + (sc.activities?.length || 0), 0) || 0), 0) || 0;
                    
                    return (
                        <div 
                            key={project.code} 
                            onClick={() => router.push(`/projects/${project.code}`)}
                            className="group bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-200 cursor-pointer"
                        >
                            <div className="flex items-center">
                                {/* Accent stripe */}
                                <div className="w-1 self-stretch flex-shrink-0 bg-blue-500" />

                                <div className="flex flex-1 items-center px-5 py-4 gap-6">
                                    {/* Project Info */}
                                    <div className="flex-1 min-w-[180px]">
                                        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                                            {project.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--text-secondary)]">
                                            <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-inset)] text-[var(--text-secondary)] text-[10px] font-semibold">
                                                {project.code}
                                            </span>
                                            <span className="text-[var(--text-tertiary)]">·</span>
                                            <span>{getProjectLocation(project)}</span>
                                            <span className="text-[var(--text-tertiary)]">·</span>
                                            <span>{formatProjectBudget(project)}</span>
                                        </div>
                                    </div>

                                    {/* Structure summary */}
                                    <div className="flex items-center gap-3 text-[11px]">
                                        <div className="flex flex-col items-center px-3 py-1.5 bg-[var(--bg-inset)] rounded-[var(--radius-md)]">
                                            <span className="font-bold text-[var(--text-primary)]">{totalComp}</span>
                                            <span className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase">Comp.</span>
                                        </div>
                                        <div className="flex flex-col items-center px-3 py-1.5 bg-[var(--bg-inset)] rounded-[var(--radius-md)]">
                                            <span className="font-bold text-[var(--text-primary)]">{totalSC}</span>
                                            <span className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase">S/C</span>
                                        </div>
                                        <div className="flex flex-col items-center px-3 py-1.5 bg-[var(--bg-inset)] rounded-[var(--radius-md)]">
                                            <span className="font-bold text-[var(--text-primary)]">{totalAct}</span>
                                            <span className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase">Activ.</span>
                                        </div>
                                    </div>

                                    {/* Quick actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <Link
                                            href={`/projects/${project.code}/team`}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-default)] transition-all"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Users size={12} /> Équipe
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {projects.length === 0 && (
                    <div className="text-center py-16 text-[var(--text-tertiary)]">
                        <Settings size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucun projet configuré</p>
                        <Link href="/projects/new" className="text-[var(--accent)] text-sm font-semibold hover:underline mt-2 inline-block">
                            Créer votre premier projet
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

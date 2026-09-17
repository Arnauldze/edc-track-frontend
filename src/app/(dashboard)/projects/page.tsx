"use client";

import { useEffect, useState } from "react";
import { Settings, Plus, Search, Filter, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Project } from "@/lib/projectStore";
import { projectService } from "@/services/api/projectService";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { getErrorMessage } from "@/services/api/client";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { rolePastille, rolePuce } from "@/lib/rbacStore";

// ══════════════════════════════════════
// PAGE — INITIALISATION
// ══════════════════════════════════════

type ProjectWithTeam = Project & {
    teamMembers: Array<{ initials: string; color: string }>;
};

// Badge du rôle de l'utilisateur sur le projet. Rien pour l'admin, qui gère tout.
// Les couleurs viennent de lib/rbacStore.ts, source unique.
function roleBadgeFor(myRoles: string[]): { label: string; className: string } | undefined {
    if (myRoles.includes("chef_projet")) {
        return { label: "Chef de projet", className: rolePuce("chef_projet") };
    }
    if (myRoles.includes("coordinateur") || myRoles.includes("coordinateur_general")) {
        return { label: "Supervision", className: rolePuce("coordinateur_general") };
    }
    return undefined;
}

export default function ProjectsPage() {
    const { data: currentUser } = useCurrentUser();
    const router = useRouter();

    // Espace réservé à ceux qui gèrent ou supervisent au moins un projet.
    useEffect(() => {
        if (currentUser && !currentUser.canAccessInitialisation) router.replace("/dashboard");
    }, [currentUser, router]);
    const [projects, setProjects] = useState<ProjectWithTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"name" | "date" | "budget">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    const fetchProjects = async () => {
        try {
            setLoading(true);
            setError(null);

            // GET /projects renvoie déjà l'équipe de chaque projet. Cette page
            // appelait auparavant /team/project/:code puis /users/:id par
            // membre, soit 1 + N + (N x membres) allers-retours.
            // Périmètre Initialisation : projets gérés ou supervisés (tous pour l'admin)
            const data = await projectService.getInitialisationProjects();

            setProjects(
                data.map((project) => ({
                    ...project,
                    teamMembers: (project.team ?? []).slice(0, 5).map((member) => ({
                        initials: `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase(),
                        color: rolePastille(member.projectRole),
                    })),
                })),
            );
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    // Fonction helper pour calculer le statut basé sur la progression
    const getProjectStatus = (project: ProjectWithTeam): string => {
        const progress = project.progress || 0;
        if (progress === 0) return "non_debute";
        if (progress === 100) return "termine";
        return "en_cours";
    };

    // Filtrer les projets selon la recherche et le statut
    const filteredProjects = projects
        .filter(project => {
            // Filtre recherche
            const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                project.code.toLowerCase().includes(searchQuery.toLowerCase());
            
            // Filtre statut (basé sur progression calculée)
            const projectStatus = getProjectStatus(project);
            const matchesStatus = !statusFilter || projectStatus === statusFilter;
            
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            // Tri
            let comparison = 0;
            
            if (sortBy === "name") {
                comparison = a.name.localeCompare(b.name);
            } else if (sortBy === "date") {
                const dateA = a.dateDebut ? new Date(a.dateDebut).getTime() : 0;
                const dateB = b.dateDebut ? new Date(b.dateDebut).getTime() : 0;
                comparison = dateA - dateB;
            } else if (sortBy === "budget") {
                comparison = (a.budget || 0) - (b.budget || 0);
            }
            
            return sortOrder === "asc" ? comparison : -comparison;
        });

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
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                        Initialisation
                    </h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                        Créez, configurez et paramétrez vos projets d&apos;infrastructure
                    </p>
                </div>
                {currentUser?.canCreateProjects && (
                    <Link
                        href="/projects/new"
                        className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--text-inverted)] px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold hover:opacity-90 transition-opacity shadow-[var(--shadow-sm)]"
                    >
                        <Plus size={16} /> Nouveau projet
                    </Link>
                )}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between gap-4 mb-6">
                {/* Search */}
                <div className="flex-1 max-w-md relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <input
                        type="text"
                        placeholder="Rechercher un projet, un code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            value={statusFilter || ""}
                            onChange={(e) => setStatusFilter(e.target.value || null)}
                            className="appearance-none pl-9 pr-8 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer focus:outline-none focus:border-[var(--primary)]"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="non_debute">Non débuté</option>
                            <option value="en_cours">En cours</option>
                            <option value="termine">Terminé</option>
                        </select>
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [newSortBy, newSortOrder] = e.target.value.split("-") as [typeof sortBy, typeof sortOrder];
                                setSortBy(newSortBy);
                                setSortOrder(newSortOrder);
                            }}
                            className="appearance-none pl-9 pr-8 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[var(--radius-md)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer focus:outline-none focus:border-[var(--primary)]"
                        >
                            <option value="name-asc">Nom (A-Z)</option>
                            <option value="name-desc">Nom (Z-A)</option>
                            <option value="date-asc">Date (anciens)</option>
                            <option value="date-desc">Date (récents)</option>
                            <option value="budget-asc">Budget (croissant)</option>
                            <option value="budget-desc">Budget (décroissant)</option>
                        </select>
                        <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* ── Projects Grid ── */}
            {filteredProjects.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-tertiary)]">
                    <Settings size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                        {searchQuery ? "Aucun projet trouvé" : "Aucun projet configuré"}
                    </p>
                    {!searchQuery && currentUser?.canCreateProjects && (
                        <Link
                            href="/projects/new"
                            className="text-[var(--primary-text)] text-sm font-semibold hover:underline mt-2 inline-block"
                        >
                            Créer votre premier projet
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredProjects.map((project) => (
                        <ProjectCard
                            key={project.code}
                            project={project}
                            teamMembers={project.teamMembers}
                            roleBadge={roleBadgeFor(project.myRoles ?? [])}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import {
    ChevronRight,
    AlertCircle,
    Eye,
    Network,
} from "lucide-react";
import Link from "next/link";
import { getProjects, type Project } from "@/lib/projectStore";
import { getProjectAlerts } from "@/lib/alertStore";

// ══════════════════════════════════════
// DATA
// ══════════════════════════════════════

type ProjetSuivi = {
    id: string;
    code: string;
    name: string;
    type: string;
    region: string;
    budget: string;
    pct: number;
    alerts: number;
    composants: number;
    status: "ok" | "progress" | "retard";
    color: string;
};

const GRADIENT_COLORS = [
    "from-green-500 to-emerald-600",
    "from-purple-500 to-violet-600",
    "from-blue-500 to-cyan-600",
    "from-orange-500 to-amber-600",
    "from-pink-500 to-rose-600",
];

async function mapToSuivi(projects: Project[]): Promise<ProjetSuivi[]> {
    const mapped = await Promise.all(
        projects.map(async (p, i) => {
            let alertCount = 0;
            try {
                const alerts = await getProjectAlerts(p.code);
                alertCount = alerts.filter(a => !a.isRead).length;
            } catch {
                alertCount = 0;
            }

            return {
                id: p.code.toLowerCase(),
                code: p.code,
                name: p.name,
                type: p.description || "Projet d'infrastructure",
                region: p.localisation?.region || "—",
                budget: p.budget ? `${p.budget.toLocaleString()} ${p.devise || 'FCFA'}` : "—",
                pct: p.progress,
                alerts: alertCount,
                composants: p.components.length,
                status: (p.progress >= 80 ? "ok" : p.progress > 0 ? "progress" : "retard") as "ok" | "progress" | "retard",
                color: GRADIENT_COLORS[i % GRADIENT_COLORS.length],
            };
        })
    );
    return mapped;
}

// ══════════════════════════════════════
// PAGE
// ══════════════════════════════════════

export default function SuiviPage() {
    const [projets, setProjets] = useState<ProjetSuivi[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const projects = await getProjects();
        const mapped = await mapToSuivi(projects);
        setProjets(mapped);
    }

    const getBarColor = (pct: number) =>
        pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : pct > 0 ? "bg-amber-500" : "bg-[var(--bg-surface-active)]";

    const getStatusDot = (status: string) => {
        switch (status) {
            case "ok": return "bg-green-500";
            case "progress": return "bg-blue-500";
            case "retard": return "bg-red-500 animate-pulse";
            default: return "bg-[var(--text-tertiary)]";
        }
    };

    return (
        <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full">
            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                        <Eye size={20} strokeWidth={1.8} className="text-[var(--text-tertiary)]" />
                        Suivi des Projets
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                        Sélectionnez un projet pour accéder au suivi opérationnel
                    </p>
                </div>
            </div>

            {/* ── Project cards grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projets.map((projet: ProjetSuivi) => (
                    <Link key={projet.id} href={`/suivi/${projet.id}`}>
                        <div className="group bg-[var(--bg-surface)] rounded-[var(--radius-lg)] border border-[var(--border-default)] overflow-hidden cursor-pointer hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] transition-all duration-200">
                            {/* Accent bar */}
                            <div className={`h-1 bg-gradient-to-r ${projet.color}`} />

                            <div className="p-5">
                                {/* Header row */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br ${projet.color} flex items-center justify-center text-white shadow-[var(--shadow-sm)] flex-shrink-0`}>
                                            <Network size={16} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                                    {projet.name}
                                                </h3>
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(projet.status)}`} />
                                            </div>
                                            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                                {projet.code} · {projet.type}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight
                                        size={16}
                                        className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all mt-1"
                                    />
                                </div>

                                {/* Info row */}
                                <div className="flex items-center gap-6 mb-4 text-xs">
                                    <div>
                                        <span className="text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider">Région</span>
                                        <div className="text-[var(--text-primary)] font-semibold mt-0.5 text-[12px]">{projet.region}</div>
                                    </div>
                                    <div>
                                        <span className="text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider">Budget</span>
                                        <div className="text-[var(--text-primary)] font-semibold mt-0.5 text-[12px]">{projet.budget}</div>
                                    </div>
                                    <div>
                                        <span className="text-[var(--text-tertiary)] font-medium text-[10px] uppercase tracking-wider">Composants</span>
                                        <div className="text-[var(--text-primary)] font-semibold mt-0.5 text-[12px]">{projet.composants}</div>
                                    </div>
                                </div>

                                {/* Progress + Alerts */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex-1 max-w-[180px] h-1.5 bg-[var(--bg-inset)] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${getBarColor(projet.pct)}`}
                                                style={{ width: `${projet.pct}%` }}
                                            />
                                        </div>
                                        <span className="text-[13px] font-bold text-[var(--text-primary)]">
                                            {projet.pct}%
                                        </span>
                                    </div>

                                    {projet.alerts > 0 && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-red-500 bg-[var(--danger-subtle)] border border-red-200 dark:border-red-800/30">
                                            <AlertCircle size={11} /> {projet.alerts} alerte{projet.alerts > 1 ? "s" : ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

        </div>
    );
}

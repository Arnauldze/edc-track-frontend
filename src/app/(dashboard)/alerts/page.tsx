"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    ChevronRight,
    ChevronDown,
    Bell,
} from "lucide-react";
import {
    getAlerts,
    markAlertAsRead,
    type Alert,
} from "@/lib/alertStore";
import { toast } from "@/lib/toastStore";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { getErrorMessage } from "@/services/api/client";

// ══════════════════════════════════════
// PAGE
// ══════════════════════════════════════

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showResolved, setShowResolved] = useState(false);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getAlerts();
            setAlerts(data);
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    // Filter alerts by status and severity
    const critical = alerts.filter(a => !a.isRead && a.severity === 'critical');
    const warning = alerts.filter(a => !a.isRead && a.severity === 'warning');
    const resolved = alerts.filter(a => a.isRead);
    const totalUnresolved = critical.length + warning.length;

    const formatResolvedDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
        } catch {
            return iso;
        }
    };

    const handleMarkResolved = async (id: string) => {
        try {
            await markAlertAsRead(id);
            toast.success("Alerte marquée comme résolue");
            await fetchAlerts();
        } catch (err: any) {
            toast.error(getErrorMessage(err));
        }
    };

    const AlertRow = ({
        alert,
        variant,
        onResolve,
    }: {
        alert: Alert;
        variant: "critical" | "warning" | "resolved";
        onResolve?: (id: string) => void;
    }) => {
        const borderColor = variant === "critical" ? "border-l-red-500" : variant === "warning" ? "border-l-amber-500" : "border-l-green-500";
        const suiviHref = `/suivi/${alert.projectId?.toLowerCase() || 'unknown'}`;

        if (variant === "resolved") {
            return (
                <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] border-l-[3px] ${borderColor} rounded-[var(--radius-md)] px-4 py-3 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity`}>
                    <div>
                        <h3 className="font-semibold text-[var(--text-secondary)] text-[14px]">✓ {alert.title}</h3>
                        <div className="text-[var(--text-tertiary)] text-[12px] flex items-center gap-2 mt-0.5">
                            <span>{alert.createdAt ? formatResolvedDate(alert.createdAt) : "—"}</span>
                            <span>·</span>
                            <span>{alert.projectId}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={`bg-[var(--bg-surface)] border border-[var(--border-default)] border-l-[3px] ${borderColor} rounded-[var(--radius-md)] px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-surface-hover)] transition-colors group`}>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-[var(--text-primary)] text-[14px]">{alert.title}</h3>
                    </div>
                    <div className="text-[var(--text-secondary)] text-[12px] flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-[var(--bg-inset)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border-default)]">
                            {alert.projectId}
                        </span>
                        <span className="text-[var(--text-tertiary)]">·</span>
                        <span>{alert.message}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onResolve && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onResolve(alert._id);
                            }}
                            className="text-[11px] font-medium text-green-600 hover:text-green-700 hover:underline"
                        >
                            Marquer résolu
                        </button>
                    )}
                    <Link
                        href={suiviHref}
                        className="text-[var(--accent)] text-[12px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
                    >
                        Voir <ChevronRight size={14} />
                    </Link>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full max-w-4xl">
                <LoadingSpinner size="lg" className="min-h-[400px]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full max-w-4xl">
                <ErrorDisplay error={error} retry={fetchAlerts} />
            </div>
        );
    }

    return (
        <div className="px-[var(--page-px)] py-[var(--page-py)] min-h-full max-w-4xl">
            {/* ── Header ── */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2.5 tracking-tight">
                        <Bell size={20} strokeWidth={1.8} className="text-[var(--text-tertiary)]" />
                        Alertes
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                        Suivi des obligations et échéances critiques
                    </p>
                </div>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-red-500 bg-[var(--danger-subtle)] border border-red-200 dark:border-red-800/30">
                    <AlertCircle size={13} /> {totalUnresolved} non résolue{totalUnresolved > 1 ? "s" : ""}
                </span>
            </div>

            {/* ── Content ── */}
            <div className="space-y-8">
                {/* CRITICAL */}
                <div>
                    <h2 className="text-[12px] font-bold text-red-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <AlertCircle size={14} /> Critiques ({critical.length})
                    </h2>
                    <div className="space-y-2">
                        {critical.length === 0 ? (
                            <p className="text-[12px] text-[var(--text-tertiary)] italic">Aucune alerte critique.</p>
                        ) : (
                            critical.map((alert) => (
                                <AlertRow
                                    key={alert._id}
                                    alert={alert}
                                    variant="critical"
                                    onResolve={handleMarkResolved}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* WARNING */}
                <div>
                    <h2 className="text-[12px] font-bold text-amber-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <AlertTriangle size={14} /> Attention ({warning.length})
                    </h2>
                    <div className="space-y-2">
                        {warning.length === 0 ? (
                            <p className="text-[12px] text-[var(--text-tertiary)] italic">Aucune alerte en attention.</p>
                        ) : (
                            warning.map((alert) => (
                                <AlertRow
                                    key={alert._id}
                                    alert={alert}
                                    variant="warning"
                                    onResolve={handleMarkResolved}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* RESOLVED */}
                <div>
                    <button
                        onClick={() => setShowResolved(!showResolved)}
                        className="w-full flex items-center justify-between text-[12px] font-bold text-green-500 mb-3 uppercase tracking-wider hover:bg-[var(--bg-surface-hover)] p-2 rounded-[var(--radius-md)] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle size={14} /> Résolues récemment ({resolved.length})
                        </div>
                        {showResolved ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {showResolved && (
                        <div className="space-y-2">
                            {resolved.length === 0 ? (
                                <p className="text-[12px] text-[var(--text-tertiary)] italic">Aucune alerte résolue.</p>
                            ) : (
                                resolved.map((alert) => (
                                    <AlertRow key={alert._id} alert={alert} variant="resolved" />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

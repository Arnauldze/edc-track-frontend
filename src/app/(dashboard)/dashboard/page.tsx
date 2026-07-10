"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Users, FolderKanban, AlertCircle, TrendingUp } from "lucide-react";
import { getProjectStats } from "@/lib/projectStore";
import { getUsers } from "@/lib/userStore";
import { getUnreadCount } from "@/lib/alertStore";
import { getErrorMessage } from "@/services/api/client";
import { LoadingPage } from "@/components/ui/LoadingSpinner";
import { ErrorPage } from "@/components/ui/ErrorDisplay";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalProjects: 0,
        avgProgress: 0,
        totalUsers: 0,
        unreadAlerts: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all stats in parallel
            const [projectStats, users, alertCount] = await Promise.all([
                getProjectStats(),
                getUsers(),
                getUnreadCount(),
            ]);

            setStats({
                totalProjects: projectStats.total,
                avgProgress: Math.round(projectStats.avgProgress),
                totalUsers: users.length,
                unreadAlerts: alertCount,
            });
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return <LoadingPage />;
    if (error) return <ErrorPage error={error} retry={fetchStats} />;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Overview of your projects and activities
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Projects */}
                <div className="bg-white rounded-lg border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-[var(--text-secondary)] font-medium">Total Projects</p>
                            <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">
                                {stats.totalProjects}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FolderKanban className="text-blue-600" size={24} />
                        </div>
                    </div>
                </div>

                {/* Average Progress */}
                <div className="bg-white rounded-lg border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-[var(--text-secondary)] font-medium">Avg Progress</p>
                            <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">
                                {stats.avgProgress}%
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="text-green-600" size={24} />
                        </div>
                    </div>
                </div>

                {/* Total Users */}
                <div className="bg-white rounded-lg border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-[var(--text-secondary)] font-medium">Total Users</p>
                            <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">
                                {stats.totalUsers}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Users className="text-purple-600" size={24} />
                        </div>
                    </div>
                </div>

                {/* Unread Alerts */}
                <div className="bg-white rounded-lg border border-[var(--border-default)] p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-[var(--text-secondary)] font-medium">Unread Alerts</p>
                            <p className="text-3xl font-bold text-[var(--text-primary)] mt-2">
                                {stats.unreadAlerts}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <AlertCircle className="text-orange-600" size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Welcome Message */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <LayoutDashboard className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Welcome to EDC Track</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Manage your infrastructure projects efficiently. Track progress, manage documents, and collaborate with your team.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

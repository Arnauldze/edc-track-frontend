"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, Construction, ActivitySquare } from "lucide-react";

export default function SuiviProjetSoonPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params);
    const id = unwrappedParams.id;
    
    return (
        <div className="flex h-screen bg-[#0C0E14] text-white">
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                
                {/* Background decorative elements */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

                {/* Back Button */}
                <div className="absolute top-8 left-8">
                    <Link href="/suivi" className="flex items-center gap-2 text-sm font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-4 py-2 rounded-lg hover:bg-white/5">
                        <ChevronLeft size={16} /> Retour aux projets
                    </Link>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center max-w-xl px-6">
                    <div className="w-20 h-20 mb-8 rounded-3xl bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center shadow-2xl shadow-[var(--accent)]/20 animate-pulse">
                        <ActivitySquare size={40} className="text-white" />
                    </div>
                    
                    <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 mb-6 tracking-tight">
                        Coming Soon
                    </h1>
                    
                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-10">
                        Le module de suivi opérationnel détaillé est actuellement en cours de développement. Il vous permettra très bientôt de croiser l'exécution physique, financière et les plannings du projet <strong>{id}</strong>.
                    </p>

                    <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] text-sm font-medium text-[var(--text-tertiary)] shadow-lg">
                        <Construction size={16} className="text-amber-500" />
                        <span>En construction pour le projet {id}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

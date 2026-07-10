"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { subscribeToasts, type Toast } from "@/lib/toastStore";

const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
};

const styles = {
    success: "bg-green-600 text-white border-green-700",
    error: "bg-red-600 text-white border-red-700",
    info: "bg-blue-600 text-white border-blue-700",
};

export function Toaster() {
    const [items, setItems] = useState<Toast[]>([]);

    useEffect(() => {
        return subscribeToasts(setItems);
    }, []);

    if (items.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {items.map((t) => {
                const Icon = icons[t.type];
                return (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] shadow-lg border animate-in fade-in slide-in-from-right-4 duration-300 ${styles[t.type]}`}
                    >
                        <Icon size={18} className="flex-shrink-0" />
                        <p className="text-[13px] font-medium leading-snug">{t.message}</p>
                    </div>
                );
            })}
        </div>
    );
}

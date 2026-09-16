"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToasts, type Toast } from "@/lib/toastStore";

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS : cartes en haut à droite, annoncées aux lecteurs d'écran.
// ══════════════════════════════════════════════════════════════

const TYPES = {
  success: { icon: CheckCircle2, pastille: "bg-success-subtle text-success" },
  error: { icon: XCircle, pastille: "bg-danger-subtle text-danger" },
  info: { icon: Info, pastille: "bg-primary-subtle text-primary-fg" },
} as const;

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-100 flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => {
        const { icon: Icon, pastille } = TYPES[item.type];
        return (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex animate-slide-in items-start gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-lg"
          >
            <span className={cn("flex size-5.5 shrink-0 items-center justify-center rounded-full", pastille)}>
              <Icon aria-hidden className="size-3.5" strokeWidth={2.4} />
            </span>
            <p className="pt-px text-[13px] font-medium leading-snug text-fg">{item.message}</p>
          </div>
        );
      })}
    </div>
  );
}

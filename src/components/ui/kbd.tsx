import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Touche de clavier (raccourci). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("rounded-[4px] border border-line px-1.25 py-px font-mono text-[10.5px] font-medium text-fg-subtle", className)}>
      {children}
    </kbd>
  );
}

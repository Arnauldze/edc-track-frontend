"use client";

import { ThemeProvider } from "next-themes";
import { ReactQueryProvider } from "@/providers/ReactQueryProvider";

// Les providers enveloppent l'arbre dès le rendu serveur : les court-circuiter
// avant le montage priverait les pages de leur QueryClient au prerender.
// L'écart d'hydratation du thème est déjà couvert par le suppressHydrationWarning
// posé sur <html> dans layout.tsx.
export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReactQueryProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                {children}
            </ThemeProvider>
        </ReactQueryProvider>
    );
}

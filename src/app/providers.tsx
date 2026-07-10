"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <AuthProvider>
                {children}
            </AuthProvider>
        </ThemeProvider>
    );
}

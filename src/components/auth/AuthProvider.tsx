"use client";

// ══════════════════════════════════════
// AuthProvider — Session Management
// Connected to Backend API
// L'identité de l'utilisateur connecté s'affiche dans la navigation
// (components/layout/UserMenu.tsx).
// ══════════════════════════════════════

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // No more auto-login - user must login manually
  return <>{children}</>;
}

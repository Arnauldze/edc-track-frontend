"use client";

// ══════════════════════════════════════════════════════════════
// SessionGuard — porte d'entrée de l'espace de travail
//
// La vraie protection reste celle de l'API : chaque requête est authentifiée
// et autorisée par le serveur. Cette garde évite d'afficher l'application à
// qui n'a pas de session — sans elle, la barre latérale et les écrans se
// dessinent, puis disparaissent au premier 401.
//
// Elle s'appuie sur GET /auth/me : c'est le serveur qui dit si la session
// vaut encore, et non un drapeau conservé dans le navigateur.
// ══════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function Attente({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas">
      <p role="status" className="flex items-center gap-2.5 text-[13px] text-fg-muted">
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />
        {message}
      </p>
    </div>
  );
}

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: utilisateur, isLoading, isError } = useCurrentUser();

  const aChangerMotDePasse = utilisateur?.mustChangePassword === true;

  useEffect(() => {
    if (isLoading) return;

    // L'adresse demandée est conservée pour y revenir après la connexion.
    const destination = `${window.location.pathname}${window.location.search}`;

    if (isError) {
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
      return;
    }

    if (aChangerMotDePasse) {
      router.replace(`/mot-de-passe?next=${encodeURIComponent(destination)}`);
    }
  }, [isLoading, isError, aChangerMotDePasse, router]);

  if (isLoading) return <Attente message="Vérification de la session…" />;
  if (isError) return <Attente message="Session expirée, redirection…" />;
  if (aChangerMotDePasse) return <Attente message="Mot de passe à renouveler…" />;

  return <>{children}</>;
}

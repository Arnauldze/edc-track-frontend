"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/lib/authStore";

/**
 * Déconnexion complète. Le cache de requêtes est vidé : sans cela, la personne
 * qui se connecte ensuite dans le même onglet verrait un instant les projets et
 * les documents de la précédente, servis depuis le cache avant la première
 * réponse du serveur.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const [enCours, setEnCours] = useState(false);

  const seDeconnecter = async () => {
    setEnCours(true);
    await logout();
    queryClient.clear();
    // Rechargement complet plutôt que router.push : l'état des pages déjà
    // montées ne doit rien conserver du compte qui vient de partir.
    window.location.href = "/login";
  };

  return { seDeconnecter, enCours };
}

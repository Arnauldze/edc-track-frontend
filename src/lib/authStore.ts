// ══════════════════════════════════════════════════════════════
// AUTH STORE — Session & Authentication
//
// La session vit côté serveur : un cookie httpOnly porte le jeton, et
// GET /auth/me donne l'identité et les droits à jour (hook useCurrentUser).
// Rien n'est recopié dans sessionStorage : une copie locale finit toujours
// par diverger du serveur — un rôle retiré resterait actif dans l'interface —
// et un jeton stocké là est lisible par n'importe quel script injecté.
// ══════════════════════════════════════════════════════════════

import { authService, type LoginRequest } from "@/services/api/authService";
import { setAccessToken } from "@/services/api/client";

/** Connexion. Renvoie vrai si un mot de passe temporaire doit être remplacé. */
export async function login(credentials: LoginRequest): Promise<{ mustChangePassword: boolean }> {
  const reponse = await authService.login(credentials);

  setAccessToken(reponse.accessToken);

  return { mustChangePassword: reponse.user?.mustChangePassword === true };
}

/**
 * Déconnexion. Le serveur efface le cookie ; l'appelant vide le cache de
 * requêtes (cf. useLogout) pour qu'aucune donnée du compte précédent ne
 * subsiste dans l'onglet.
 */
export async function logout(): Promise<void> {
  try {
    await authService.logout();
  } catch (error) {
    // Le cookie a pu expirer : la session locale se termine quand même.
    console.error("Logout error:", error);
  } finally {
    setAccessToken(null);
  }
}

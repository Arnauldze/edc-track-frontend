import type { NextConfig } from "next";

// Relais de développement : avec API_PROXY_TARGET défini (dans .env.local),
// les appels à /backend-api/* sont transmis par le serveur Next à cette API.
// Le navigateur ne parle qu'à localhost, ce qui évite d'ouvrir le CORS de
// l'API de production à localhost. Sans cette variable — sur Vercel —, aucun
// relais n'est créé.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io"],
  // Un `next build` écrit dans .next, le même dossier qu'un `next dev` en
  // cours : les deux se marchent dessus et l'application perd ses styles.
  // NEXT_DIST_DIR=.next-build isole la compilation de vérification.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/backend-api/:path*", destination: `${apiProxyTarget}/:path*` }];
  },
};

export default nextConfig;

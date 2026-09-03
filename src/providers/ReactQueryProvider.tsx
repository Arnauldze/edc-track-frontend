"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache les données pendant 5 minutes
            staleTime: 5 * 60 * 1000,
            // Garde les données en cache pendant 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry automatique en cas d'erreur
            retry: 2,
            // Ne pas refetch automatiquement au focus de la fenêtre
            refetchOnWindowFocus: false,
            // Ne pas refetch au montage si les données sont fraîches
            refetchOnMount: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

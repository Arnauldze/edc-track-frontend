"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavigationGuardContextType {
  isBlocked: boolean;
  blockNavigation: (message?: string) => void;
  unblockNavigation: () => void;
  checkAndNavigate: (path: string) => Promise<boolean>;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined);

export function NavigationGuardProvider({ children }: { children: React.Node }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string>();
  const router = useRouter();
  const pathname = usePathname();

  const blockNavigation = useCallback((message?: string) => {
    setIsBlocked(true);
    setBlockedMessage(message || "Vous avez des modifications non enregistrées. Voulez-vous continuer ?");
  }, []);

  const unblockNavigation = useCallback(() => {
    setIsBlocked(false);
    setBlockedMessage(undefined);
  }, []);

  const checkAndNavigate = useCallback(async (path: string): Promise<boolean> => {
    if (!isBlocked) {
      router.push(path);
      return true;
    }

    // Afficher la modal de confirmation
    const userChoice = window.confirm(blockedMessage);
    
    if (userChoice) {
      unblockNavigation();
      router.push(path);
      return true;
    }
    
    return false;
  }, [isBlocked, blockedMessage, router, unblockNavigation]);

  return (
    <NavigationGuardContext.Provider value={{ isBlocked, blockNavigation, unblockNavigation, checkAndNavigate }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  }
  return context;
}

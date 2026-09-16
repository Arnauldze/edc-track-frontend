"use client";

import { useSyncExternalStore } from "react";
import { SESSION_KEY, getCurrentSession, type AuthSession } from "@/lib/authStore";

// ══════════════════════════════════════════════════════════════
// ÉTATS CÔTÉ NAVIGATEUR
// Lus avec useSyncExternalStore : le rendu serveur reçoit une valeur neutre,
// le client se met à jour sans écart d'hydratation ni setState dans un effet.
// ══════════════════════════════════════════════════════════════

const noSubscription = () => () => {};

/** Vrai une fois le composant monté dans le navigateur. */
export function useHydrated() {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

// ── Session ──

let sessionRaw: string | null = null;
let sessionValue: AuthSession | null = null;

function subscribeSession(onChange: () => void) {
  window.addEventListener("auth-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("auth-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw !== sessionRaw) {
    sessionRaw = raw;
    sessionValue = getCurrentSession();
  }
  return sessionValue;
}

/** Session de l'utilisateur connecté, mise à jour à la connexion et à la déconnexion. */
export function useSession() {
  return useSyncExternalStore(subscribeSession, readSession, () => null);
}

// ── Préférence persistée ──

const PREFERENCE_EVENT = "edc-preference-changed";
// Repli quand le stockage du navigateur est refusé (navigation privée stricte).
const memory = new Map<string, boolean>();

function subscribePreference(onChange: () => void) {
  window.addEventListener(PREFERENCE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readPreference(key: string) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? (memory.get(key) ?? false) : stored === "true";
  } catch {
    return memory.get(key) ?? false;
  }
}

/** Booléen conservé d'une visite à l'autre (menu replié…). Faux côté serveur. */
export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribePreference, () => readPreference(key), () => false);
  const setValue = (next: boolean) => {
    memory.set(key, next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Stockage refusé : la valeur en mémoire vaut jusqu'au rechargement.
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  };
  return [value, setValue];
}

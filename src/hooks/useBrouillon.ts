"use client";

// ══════════════════════════════════════════════════════════════
// BROUILLON AUTOMATIQUE
//
// La saisie en cours est recopiée dans le navigateur, sans passer par le
// serveur : fermer l'onglet, se déconnecter ou perdre le réseau ne fait plus
// perdre le travail. Ce n'est PAS un enregistrement — le brouillon ne vit que
// sur ce poste et dans ce navigateur, et il est proposé à la réouverture.
//
// Le stockage du navigateur peut être refusé (navigation privée stricte,
// réglages d'entreprise) : chaque accès est protégé, et l'absence de
// brouillon n'empêche jamais de travailler.
// ══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIXE = "edc_brouillon:";
const DELAI_ECRITURE_MS = 800;

type Brouillon<T> = { signature: string; etat: T; enregistreLe: string };

function lire<T>(clef: string): Brouillon<T> | null {
  try {
    const brut = localStorage.getItem(PREFIXE + clef);
    return brut ? (JSON.parse(brut) as Brouillon<T>) : null;
  } catch {
    return null;
  }
}

export interface UseBrouillon<T> {
  /** Brouillon retrouvé à l'ouverture, tant qu'il diffère de l'état enregistré. */
  disponible: Brouillon<T> | null;
  /** Oublie le brouillon : après un enregistrement, ou si on préfère l'état serveur. */
  effacer: () => void;
}

/**
 * @param clef      identifie la saisie (projet + activité)
 * @param etat      état courant du formulaire, sérialisable
 * @param signature empreinte de l'état ; un brouillon qui a la même que l'état
 *                  chargé n'a rien à proposer
 * @param actif     n'écrire que s'il y a des modifications non enregistrées
 */
export function useBrouillon<T>({
  clef,
  etat,
  signature,
  actif,
}: {
  clef: string;
  etat: T;
  signature: string;
  actif: boolean;
}): UseBrouillon<T> {
  // Lu une seule fois, avant que le chargement ne remplisse le formulaire.
  const [trouve, setTrouve] = useState<Brouillon<T> | null>(() => (typeof window === "undefined" ? null : lire<T>(clef)));

  // Tenu à jour hors rendu : l'écriture est différée et doit partir avec le
  // dernier état, sans relancer le minuteur à chaque rendu.
  const etatRef = useRef(etat);
  useEffect(() => {
    etatRef.current = etat;
  }, [etat]);

  useEffect(() => {
    if (!actif) return;

    // Écriture différée : la frappe ne doit pas écrire à chaque caractère.
    const minuteur = setTimeout(() => {
      try {
        localStorage.setItem(
          PREFIXE + clef,
          JSON.stringify({ signature, etat: etatRef.current, enregistreLe: new Date().toISOString() }),
        );
      } catch {
        // Stockage refusé ou plein : la saisie continue, sans filet.
      }
    }, DELAI_ECRITURE_MS);

    return () => clearTimeout(minuteur);
  }, [clef, signature, actif]);

  const effacer = useCallback(() => {
    setTrouve(null);
    try {
      localStorage.removeItem(PREFIXE + clef);
    } catch {
      // rien à faire
    }
  }, [clef]);

  // Un brouillon identique à ce qui est enregistré n'a rien à proposer.
  return { disponible: trouve && trouve.signature !== signature ? trouve : null, effacer };
}

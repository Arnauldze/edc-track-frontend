"use client";

// ══════════════════════════════════════
// useStructureEditor — brouillon de structure avec historique
//
// `draft` vaut null hors édition. Chaque modification empile l'état
// précédent : annuler / rétablir parcourent cet historique.
// ══════════════════════════════════════

import { useCallback, useState } from "react";
import type { Component } from "@/services/api/projectService";

const HISTORY_LIMIT = 100;

interface History {
  past: Component[][];
  present: Component[] | null;
  future: Component[][];
}

export function useStructureEditor() {
  const [history, setHistory] = useState<History>({ past: [], present: null, future: [] });

  const start = useCallback((components: Component[]) => {
    setHistory({ past: [], present: components, future: [] });
  }, []);

  const stop = useCallback(() => {
    setHistory({ past: [], present: null, future: [] });
  }, []);

  /** Applique une nouvelle version ; ignorée si elle est identique (opération impossible). */
  const apply = useCallback((next: Component[]) => {
    setHistory((h) => {
      if (!h.present || next === h.present) return h;
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.present || h.past.length === 0) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.present || h.future.length === 0) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    });
  }, []);

  return {
    draft: history.present,
    isEditing: history.present !== null,
    /** Nombre de modifications depuis l'ouverture de l'édition. */
    changeCount: history.past.length,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    start,
    stop,
    apply,
    undo,
    redo,
  };
}

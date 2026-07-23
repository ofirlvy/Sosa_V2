import { useState } from 'react';
import { CardData } from '../types';

/**
 * Pure undo/redo stack management for canvas card snapshots.
 * Knows nothing about workspaces or persistence — callers pass the current
 * card snapshot in and apply the returned snapshot themselves.
 */
export function useCanvasHistory() {
  const [history, setHistory] = useState<CardData[][]>([]);
  const [future, setFuture] = useState<CardData[][]>([]);

  // Record the snapshot BEFORE a mutation, and clear the redo stack.
  const pushHistory = (snapshot: CardData[]) => {
    setHistory(prev => [...prev.slice(-20), snapshot]);
    setFuture([]);
  };

  // Returns the snapshot to restore, or null if nothing to undo.
  const undo = (currentCards: CardData[]): CardData[] | null => {
    if (history.length === 0) return null;
    const previous = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture(prev => [currentCards, ...prev]);
    return previous;
  };

  // Returns the snapshot to restore, or null if nothing to redo.
  const redo = (currentCards: CardData[]): CardData[] | null => {
    if (future.length === 0) return null;
    const next = future[0];
    setFuture(future.slice(1));
    setHistory(prev => [...prev, currentCards]);
    return next;
  };

  const reset = () => {
    setHistory([]);
    setFuture([]);
  };

  return { history, future, pushHistory, undo, redo, reset };
}

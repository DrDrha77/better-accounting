import { create } from 'zustand';

export const UNDO_SECONDS = 10;

interface UndoState {
  item: { id: number; message: string; undo: () => void } | null;
  /** Show an Undo bar for UNDO_SECONDS; a newer one replaces it. */
  push(message: string, undo: () => void): void;
  /** Run the undo action and hide the bar. */
  run(): void;
  dismiss(): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let counter = 0;

export const useUndo = create<UndoState>((set, get) => ({
  item: null,
  push: (message, undo) => {
    clearTimeout(timer);
    const id = ++counter;
    set({ item: { id, message, undo } });
    timer = setTimeout(() => {
      if (get().item?.id === id) set({ item: null });
    }, UNDO_SECONDS * 1000);
  },
  run: () => {
    const item = get().item;
    clearTimeout(timer);
    set({ item: null });
    item?.undo();
  },
  dismiss: () => {
    clearTimeout(timer);
    set({ item: null });
  },
}));

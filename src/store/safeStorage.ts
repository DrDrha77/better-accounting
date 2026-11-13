import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';

/** True when the browser refused to save (private window, storage full or blocked). */
export const useSaveStatus = create<{ failed: boolean; setFailed(failed: boolean): void }>((set) => ({
  failed: false,
  setFailed: (failed) => set({ failed }),
}));

/**
 * localStorage that never throws and reports when a save fails, so the app can warn the user
 * instead of silently losing their work.
 */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      useSaveStatus.getState().setFailed(true);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      if (useSaveStatus.getState().failed) useSaveStatus.getState().setFailed(false);
    } catch {
      useSaveStatus.getState().setFailed(true);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // nothing to remove if storage isn't available
    }
  },
};

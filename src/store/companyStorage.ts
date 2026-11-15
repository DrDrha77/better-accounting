import type { StateStorage } from 'zustand/middleware';
import { safeLocalStorage } from './safeStorage';
import { MAIN_COMPANY_ID, useCompanies } from './useCompanies';

/** Storage keys for one company's data. The first company keeps the key older versions used for its books. */
export const booksKey = (id: string) => (id === MAIN_COMPANY_ID ? 'better-accounting:books' : `better-accounting:books:${id}`);
export const companyDataKey = (id: string) => `better-accounting:company:${id}`;
export const journalsKey = (id: string) => `better-accounting:journals:${id}`;

/**
 * A storage for a store whose data belongs to the active company: every read and write goes to the
 * key of whichever company is active right now. Switching company is just changing the active id
 * and re-reading the store.
 */
export function activeCompanyStorage(keyFor: (id: string) => string): StateStorage {
  const key = () => keyFor(useCompanies.getState().activeId);
  return {
    getItem: () => safeLocalStorage.getItem(key()),
    setItem: (_name, value) => safeLocalStorage.setItem(key(), value),
    removeItem: () => safeLocalStorage.removeItem(key()),
  };
}

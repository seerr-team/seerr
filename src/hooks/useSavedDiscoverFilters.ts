import type { FilterOptions } from '@app/components/Discover/constants';
import { QueryFilterOptions } from '@app/components/Discover/constants';
import { useRef } from 'react';

type FilterType = 'movie' | 'tv';

const storageKey = (type: FilterType) => `${type}-filters`;

const readSavedFilters = (key: string): FilterOptions | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return QueryFilterOptions.parse(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
};

const useSavedDiscoverFilters = (type: FilterType) => {
  const key = storageKey(type);
  const updateLocalStorage = useRef(true);

  const saveFilters = (filters: FilterOptions) =>
    window.localStorage.setItem(key, JSON.stringify(filters));

  const getSavedFilters = () => readSavedFilters(key);

  const removeSavedFilters = () => window.localStorage.removeItem(key);

  return {
    saveFilters,
    getSavedFilters,
    removeSavedFilters,
    updateLocalStorage,
  };
};

export default useSavedDiscoverFilters;

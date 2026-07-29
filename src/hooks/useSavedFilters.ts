import type { FilterOptions } from '@app/components/Discover/constants';
import { QueryFilterOptions } from '@app/components/Discover/constants';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { useRef } from 'react';
import { useIntl } from 'react-intl';

type FilterType = 'movie' | 'tv';

const storageKey = (type: FilterType) => `${type}-filters`;

const messages = defineMessages('components.Discover.FilterSlideover', {
  savingFilterError: 'Unable to save Filters',
  removingFilterError: 'Unable to remove Filters',
});

const useSavedFilters = (type: FilterType) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const key = storageKey(type);
  const updateLocalStorage = useRef(true);

  const saveFilters = (filters: FilterOptions) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(filters));
    } catch {
      addToast(intl.formatMessage(messages.savingFilterError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const getSavedFilters = (): FilterOptions | null => {
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

  const removeSavedFilters = () => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      addToast(intl.formatMessage(messages.removingFilterError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  return {
    saveFilters,
    getSavedFilters,
    removeSavedFilters,
    updateLocalStorage,
  };
};

export default useSavedFilters;

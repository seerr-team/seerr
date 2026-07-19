import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import { filterVisibleTitles } from '@app/utils/mediaFilters';
import type { MediaStatus } from '@server/constants/media';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import useSWRInfinite from 'swr/infinite';
import useSettings from './useSettings';
import { Permission, useUser } from './useUser';

export interface BaseSearchResult<T> {
  page: number;
  totalResults: number;
  totalPages: number;
  results: T[];
}

interface BaseMedia {
  id: number;
  mediaType: string;
  mediaInfo?: {
    status: MediaStatus;
    hasActiveRequest?: boolean;
  };
}

interface DiscoverResult<T, S> {
  isLoadingInitialData: boolean;
  isLoadingMore: boolean;
  fetchMore: () => void;
  isEmpty: boolean;
  isReachingEnd: boolean;
  error: unknown;
  titles: T[];
  firstResultData?: BaseSearchResult<T> & S;
  mutate?: () => void;
}

const extraEncodes: [RegExp, string][] = [
  [/\(/g, '%28'],
  [/\)/g, '%29'],
  [/!/g, '%21'],
  [/\*/g, '%2A'],
];

export const encodeURIExtraParams = (string: string): string => {
  let finalString = encodeURIComponent(string);

  extraEncodes.forEach((encode) => {
    finalString = finalString.replace(encode[0], encode[1]);
  });

  return finalString;
};

const useDiscover = <
  T extends BaseMedia,
  S = Record<string, never>,
  O = Record<string, unknown>,
>(
  endpoint: string,
  options?: O,
  { hideAvailable = true, hideBlocklisted = true, hideRequested = true } = {}
): DiscoverResult<T, S> => {
  const settings = useSettings();
  const { hasPermission } = useUser();
  const { addToast } = useToasts();
  const intl = useIntl();
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<
    BaseSearchResult<T> & S
  >(
    (pageIndex: number, previousPageData) => {
      if (previousPageData && pageIndex + 1 > previousPageData.totalPages) {
        return null;
      }

      const params: Record<string, unknown> = {
        page: pageIndex + 1,
        ...options,
      };

      const finalQueryString = Object.keys(params)
        .map(
          (paramKey) =>
            `${paramKey}=${encodeURIExtraParams(params[paramKey] as string)}`
        )
        .join('&');

      return `${endpoint}?${finalQueryString}`;
    },
    {
      initialSize: 3,
      revalidateFirstPage: false,
      dedupingInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  const resultIds: Set<number> = new Set<number>();

  const isLoadingInitialData = !data && !error;
  const isLoadingMore =
    isLoadingInitialData ||
    (size > 0 &&
      !!data &&
      typeof data[size - 1] === 'undefined' &&
      isValidating);

  const fetchMore = () => {
    setSize(size + 1);
  };

  let titles = (data ?? []).reduce((a, v) => {
    const results: T[] = [];

    for (const result of v.results) {
      if (!resultIds.has(result.id)) {
        resultIds.add(result.id);
        results.push(result);
      }
    }

    return [...a, ...results];
  }, [] as T[]);

  titles = filterVisibleTitles(titles, {
    hideAvailable: settings.currentSettings.hideAvailable && hideAvailable,
    hideBlocklisted:
      settings.currentSettings.hideBlocklisted &&
      hideBlocklisted &&
      hasPermission(Permission.MANAGE_BLOCKLIST),
    hideRequested: settings.currentSettings.hideRequested && hideRequested,
  });

  const isEmpty =
    !isLoadingInitialData && !isLoadingMore && titles?.length === 0;
  const isReachingEnd =
    (!!data && (data[data.length - 1]?.results.length ?? 0) < 20) ||
    (!!data && (data[data.length - 1]?.totalResults ?? 0) <= size * 20) ||
    (!!data && (data[data.length - 1]?.totalResults ?? 0) < 41);

  // When client-side filters (hide available/blocklisted/requested) empty out
  // entire pages, keep fetching a bounded number of extra pages so the view
  // does not appear exhausted while the server still has results.
  useEffect(() => {
    if (
      !!data &&
      titles.length < 20 &&
      size < 5 &&
      !isReachingEnd &&
      !isLoadingMore &&
      !isValidating
    ) {
      setSize(size + 1);
    }
  }, [data, titles, size, isReachingEnd, isLoadingMore, isValidating, setSize]);

  useEffect(() => {
    if (error && titles.length) {
      addToast(intl.formatMessage(globalMessages.error), {
        appearance: 'error',
        autoDismiss: true,
      });
      console.error('Error while fetching discover titles:', error);
    }
  }, [data, error, addToast, intl, titles.length]);

  return {
    isLoadingInitialData,
    isLoadingMore,
    fetchMore,
    isEmpty,
    isReachingEnd,
    error: error && titles.length ? null : error,
    titles,
    firstResultData: data?.[0],
    mutate,
  };
};

export default useDiscover;

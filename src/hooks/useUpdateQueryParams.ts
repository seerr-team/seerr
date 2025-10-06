import { getBasedPath } from '@app/utils/navigationUtil';
import type { NextRouter } from 'next/router';
import { useRouter } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';
import { useCallback } from 'react';

type UseQueryParamReturnedFunction = (
  query: ParsedUrlQuery,
  routerAction?: 'push' | 'replace'
) => void;

interface MergedQueryString {
  pathname: string;
  path: string;
}

/**
 * Returns a filtered object containing only key/value pairs that don't exist in the current
 * router path.
 *
 * @param router Nextjs router instance
 * @param filters Object containing key value pairs for filter items that should be cleaned
 */
export const filterQueryString = (
  router: NextRouter,
  filters: ParsedUrlQuery
): ParsedUrlQuery => {
  const cleanedFilters: ParsedUrlQuery = {};

  Object.keys(filters).forEach((key) => {
    if (!router.pathname.match(new RegExp(`${key}`))) {
      cleanedFilters[key] = filters[key];
    }
  });

  return cleanedFilters;
};

/**
 * Takes a query paramter object and returns a new pathname and path
 * with the new values appended.
 *
 * - If the value already exists, it is updated.
 * - If a key with the value of null is passed, it will be removed from
 *   the current query paramters
 *
 * ## Example usage:
 *
 * If the current URL is `/foo?bar=test` and you want to add a new query parameter, you
 * can do the following:
 *
 * ```
 * const newRoute = mergeQueryString(router, { newParam: 'value' });
 * ```
 * NewRoute will become
 *
 * ```
 * {
 *  pathName: '/foo?bar=test&newParam=value',
 *   path: '/foo?bar=test&newParam=value'
 * }
 * ```
 *
 * @param router Nextjs router instance
 * @param query Key/value pair object containing query paramters
 */
export const mergeQueryString = (
  router: NextRouter,
  query: ParsedUrlQuery
): MergedQueryString => {
  const cleanedQuery = filterQueryString(router, router.query);

  const mergedQuery = Object.assign({}, cleanedQuery, query);

  const queryArray: string[] = [];

  Object.keys(mergedQuery).map((key) => {
    if (mergedQuery[key]) {
      queryArray.push(`${key}=${mergedQuery[key]}`);
    }
  });

  const pathWithoutQuery = router.asPath.match(/(.*)\?.*/);
  const asPath = pathWithoutQuery ? pathWithoutQuery[1] : router.asPath;

  const pathname = `${router.pathname}${
    queryArray.length > 0 ? `?${queryArray.join('&')}` : ''
  }`;
  const path = `${asPath}${
    queryArray.length > 0 ? `?${queryArray.join('&')}` : ''
  }`;

  return { pathname, path };
};

/**
 * useQueryParams hook is used just to provide a callback with a nextjs
 * router instance attached to it. The returned method can be called with
 * an object of key/value pairs to route the user with the new query paramters
 */
export const useQueryParams = (): UseQueryParamReturnedFunction => {
  const router = useRouter();

  return useCallback(
    (query: ParsedUrlQuery, routerAction: 'push' | 'replace' = 'push') => {
      const newRoute = mergeQueryString(router, query);

      if (newRoute.path !== router.asPath) {
        if (routerAction === 'replace') {
          router.replace(
            getBasedPath(newRoute.pathname),
            getBasedPath(newRoute.path)
          );
        } else {
          router.push(
            getBasedPath(newRoute.pathname),
            getBasedPath(newRoute.path)
          );
        }
      }
    },
    [router]
  );
};

export const useUpdateQueryParams = (
  filter: ParsedUrlQuery
): ((key: string, value?: string) => void) => {
  const updateQueryParams = useQueryParams();

  return useCallback(
    (key: string, value?: string) => {
      const query = {
        ...filter,
        [key]: value,
      };
      updateQueryParams(query, 'replace');
    },
    [filter, updateQueryParams]
  );
};

export const useBatchUpdateQueryParams = (
  filter: ParsedUrlQuery
): ((items: Record<string, string | undefined>) => void) => {
  const updateQueryParams = useQueryParams();

  return useCallback(
    (items: Record<string, string | undefined>) => {
      const query = {
        ...filter,
        ...items,
      };
      updateQueryParams(query, 'replace');
    },
    [filter, updateQueryParams]
  );
};

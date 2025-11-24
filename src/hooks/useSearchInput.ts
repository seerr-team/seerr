/* eslint-disable react-hooks/exhaustive-deps */
import { isBookRoute } from '@app/utils/mediaTypeRoutes';
import type { Nullable } from '@app/utils/typeHelpers';
import { useRouter } from 'next/router';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { UrlObject } from 'url';
import useDebouncedState from './useDebouncedState';

type Url = string | UrlObject;

interface SearchObject {
  searchValue: string;
  searchOpen: boolean;
  searchType: string;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setSearchValue: Dispatch<SetStateAction<string>>;
  setSearchType: Dispatch<SetStateAction<string>>;
  clear: () => void;
}

const useSearchInput = (): SearchObject => {
  const router = useRouter();
  const [searchOpen, setIsOpen] = useState(false);
  const [lastRoute, setLastRoute] = useState<Nullable<Url>>(null);
  const [searchValue, debouncedValue, setSearchValue] = useDebouncedState(
    (router.query.query as string) ?? ''
  );
  const [searchType, setSearchType] = useState<string>(
    isBookRoute(router.pathname) ? 'hardcover' : 'tmdb'
  );

  /**
   * This effect syncs the searchType state with the current route
   *
   * When navigating to pages other than /search, the search type
   * automatically updates to match the page content (hardcover for books,
   * tmdb for movies/tv)
   */
  useEffect(() => {
    if (!router.pathname.startsWith('/search')) {
      setSearchType(isBookRoute(router.pathname) ? 'hardcover' : 'tmdb');
    }
  }, [router.pathname]);

  /**
   * This effect syncs the searchType state with URL query parameter
   *
   * When on the /search page, keep searchType in sync with the URL type param
   * to handle direct navigation
   */
  useEffect(() => {
    if (router.pathname.startsWith('/search') && router.query.type) {
      const queryType = router.query.type as string;
      if (queryType === 'hardcover' || queryType === 'tmdb') {
        setSearchType(queryType);
      }
    }
  }, [router.query.type, router.pathname]);

  /**
   * This effect handles routing when the debounced search input
   * value changes.
   *
   * If we are not already on the /search route, then we push
   * in a new route. If we are, then we only replace the history.
   */
  useEffect(() => {
    if (debouncedValue !== '' && searchOpen) {
      if (router.pathname.startsWith('/search')) {
        router.replace({
          pathname: router.pathname,
          query: {
            ...router.query,
            query: debouncedValue,
            type: searchType,
          },
        });
      } else {
        setLastRoute(router.asPath);
        router
          .push({
            pathname: '/search',
            query: {
              query: debouncedValue,
              type: searchType,
            },
          })
          .then(() => window.scrollTo(0, 0));
      }
    }
  }, [debouncedValue, searchType]);

  /**
   * This effect is handling behavior when the search input is closed.
   *
   * If we have a lastRoute, we will route back to it. If we don't
   * (in the case of a deeplink) we take the user back to the index route
   */
  useEffect(() => {
    if (
      searchValue === '' &&
      router.pathname.startsWith('/search') &&
      !searchOpen
    ) {
      if (lastRoute) {
        router.push(lastRoute).then(() => window.scrollTo(0, 0));
      } else {
        router.replace('/').then(() => window.scrollTo(0, 0));
      }
    }
  }, [searchOpen]);

  /**
   * This effect handles behavior for when the route is changed.
   *
   * If after a route change, the new debounced value is not the same
   * as the query value then we will update the searchValue to either the
   * new query or to an empty string (in the case of null). This makes sure
   * that the value in the searchbox is whatever the user last entered regardless
   * of routing to something like a detail page.
   *
   * If the new route is not /search and query is null, then we will close the
   * search if it is open.
   *
   * In the final case, we want the search to always be open in the case the user
   * is on /search
   */
  useEffect(() => {
    if (router.query.query !== debouncedValue) {
      setSearchValue(
        router.query.query
          ? decodeURIComponent(router.query.query as string)
          : ''
      );

      if (!router.pathname.startsWith('/search') && !router.query.query) {
        setIsOpen(false);
      }
    }

    if (router.pathname.startsWith('/search')) {
      setIsOpen(true);
    }
  }, [router, setSearchValue]);

  const clear = () => {
    setIsOpen(false);
    setSearchValue('');
  };

  return {
    searchValue,
    searchOpen,
    searchType,
    setIsOpen,
    setSearchValue,
    setSearchType,
    clear,
  };
};

export default useSearchInput;

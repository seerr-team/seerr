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
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setSearchValue: Dispatch<SetStateAction<string>>;
  clear: () => void;
}

const useSearchInput = (): SearchObject => {
  const router = useRouter();
  const [searchOpen, setIsOpen] = useState(false);
  const [lastRoute, setLastRoute] = useState<Nullable<Url>>(null);
  const [searchValue, debouncedValue, setSearchValue] = useDebouncedState(
    (router.query.query as string) ?? ''
  );

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
          },
        });
      } else {
        setLastRoute(router.asPath);
        router
          .push({
            pathname: '/search',
            query: {
              query: debouncedValue,
              ...(isBookRoute(router.pathname) ? { type: 'book' } : {}),
            },
          })
          .then(() => window.scrollTo(0, 0));
      }
    }
  }, [debouncedValue]);

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
    setIsOpen,
    setSearchValue,
    clear,
  };
};

export default useSearchInput;

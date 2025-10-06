import BlacklistedTagsBadge from '@app/components/BlacklistedTagsBadge';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import useDebouncedState from '@app/hooks/useDebouncedState';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { getBasedPath } from '@app/utils/navigationUtil';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import type {
  BlacklistItem,
  BlacklistResultsResponse,
} from '@server/interfaces/api/blacklistInterfaces';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { FormattedRelativeTime, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.Blacklist', {
  blacklistsettings: 'Blacklist Settings',
  blacklistSettingsDescription: 'Manage blacklisted media.',
  mediaName: 'Name',
  mediaType: 'Type',
  mediaTmdbId: 'tmdb Id',
  blacklistdate: 'date',
  blacklistedby: '{date} by {user}',
  blacklistNotFoundError: '<strong>{title}</strong> is not blacklisted.',
  filterManual: 'Manual',
  filterBlacklistedTags: 'Blacklisted Tags',
  showAllBlacklisted: 'Show All Blacklisted Media',
});

enum Filter {
  ALL = 'all',
  MANUAL = 'manual',
  BLACKLISTEDTAGS = 'blacklistedTags',
}

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

const Blacklist = () => {
  const [currentPageSize, setCurrentPageSize] = useState<number>(10);
  const [searchFilter, debouncedSearchFilter, setSearchFilter] =
    useDebouncedState('');
  const [currentFilter, setCurrentFilter] = useState<Filter>(Filter.MANUAL);
  const router = useRouter();
  const intl = useIntl();

  const page = router.query.page ? Number(router.query.page) : 1;
  const pageIndex = page - 1;
  const updateQueryParams = useUpdateQueryParams({ page: page.toString() });

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<BlacklistResultsResponse>(
    `/api/v1/blacklist/?take=${currentPageSize}&skip=${
      pageIndex * currentPageSize
    }&filter=${currentFilter}${
      debouncedSearchFilter ? `&search=${debouncedSearchFilter}` : ''
    }`,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
    }
  );

  // check if there's no data and no errors in the table
  // so as to show a spinner inside the table and not refresh the whole component
  if (!data && error) {
    return <Error statusCode={500} />;
  }

  const searchItem = (e: ChangeEvent<HTMLInputElement>) => {
    // Remove the "page" query param from the URL
    // so that the "skip" query param on line 62 is empty
    // and the search returns results without skipping items
    if (router.query.page) router.replace(router.basePath);

    setSearchFilter(e.target.value as string);
  };

  const hasNextPage = data && data.pageInfo.pages > pageIndex + 1;
  const hasPrevPage = pageIndex > 0;

  return (
    <>
      <PageTitle title={[intl.formatMessage(globalMessages.blacklist)]} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(globalMessages.blacklist)}</Header>

        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <FunnelIcon className="h-6 w-6" />
            </span>
            <select
              id="filter"
              name="filter"
              onChange={(e) => {
                setCurrentFilter(e.target.value as Filter);
                router.push({
                  pathname: getBasedPath(router.pathname),
                  query: router.query.userId
                    ? { userId: router.query.userId }
                    : {},
                });
              }}
              value={currentFilter}
              className="rounded-r-only"
            >
              <option value="all">
                {intl.formatMessage(globalMessages.all)}
              </option>
              <option value="manual">
                {intl.formatMessage(messages.filterManual)}
              </option>
              <option value="blacklistedTags">
                {intl.formatMessage(messages.filterBlacklistedTags)}
              </option>
            </select>
          </div>

          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 md:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <MagnifyingGlassIcon className="h-6 w-6" />
            </span>
            <input
              type="text"
              className="rounded-r-only"
              value={searchFilter}
              onChange={(e) => searchItem(e)}
            />
          </div>
        </div>
      </div>

      {!data ? (
        <LoadingSpinner />
      ) : data.results.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center py-24 text-white">
          <span className="text-2xl text-gray-400">
            {intl.formatMessage(globalMessages.noresults)}
          </span>
          {currentFilter !== Filter.ALL && (
            <div className="mt-4">
              <Button
                buttonType="primary"
                onClick={() => setCurrentFilter(Filter.ALL)}
              >
                {intl.formatMessage(messages.showAllBlacklisted)}
              </Button>
            </div>
          )}
        </div>
      ) : (
        data.results.map((item: BlacklistItem) => {
          return (
            <div className="py-2" key={`request-list-${item.tmdbId}`}>
              <BlacklistedItem item={item} revalidateList={revalidate} />
            </div>
          );
        })
      )}

      <div className="actions">
        <nav
          className="mb-3 flex flex-col items-center space-y-3 sm:flex-row sm:space-y-0"
          aria-label="Pagination"
        >
          <div className="hidden lg:flex lg:flex-1">
            <p className="text-sm">
              {data &&
                (data?.results.length ?? 0) > 0 &&
                intl.formatMessage(globalMessages.showingresults, {
                  from: pageIndex * currentPageSize + 1,
                  to:
                    data.results.length < currentPageSize
                      ? pageIndex * currentPageSize + data.results.length
                      : (pageIndex + 1) * currentPageSize,
                  total: data.pageInfo.results,
                  strong: (msg: React.ReactNode) => (
                    <span className="font-medium">{msg}</span>
                  ),
                })}
            </p>
          </div>
          <div className="flex justify-center sm:flex-1 sm:justify-start lg:justify-center">
            <span className="-mt-3 items-center truncate text-sm sm:mt-0">
              {intl.formatMessage(globalMessages.resultsperpage, {
                pageSize: (
                  <select
                    id="pageSize"
                    name="pageSize"
                    onChange={(e) => {
                      setCurrentPageSize(Number(e.target.value));
                      router
                        .push({
                          pathname: router.pathname,
                          query: router.query.userId
                            ? { userId: router.query.userId }
                            : {},
                        })
                        .then(() => window.scrollTo(0, 0));
                    }}
                    value={currentPageSize}
                    className="short inline"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                ),
              })}
            </span>
          </div>
          <div className="flex flex-auto justify-center space-x-2 sm:flex-1 sm:justify-end">
            <Button
              disabled={!hasPrevPage}
              onClick={() => updateQueryParams('page', (page - 1).toString())}
            >
              <ChevronLeftIcon />
              <span>{intl.formatMessage(globalMessages.previous)}</span>
            </Button>
            <Button
              disabled={!hasNextPage}
              onClick={() => updateQueryParams('page', (page + 1).toString())}
            >
              <span>{intl.formatMessage(globalMessages.next)}</span>
              <ChevronRightIcon />
            </Button>
          </div>
        </nav>
      </div>
    </>
  );
};

export default Blacklist;

interface BlacklistedItemProps {
  item: BlacklistItem;
  revalidateList: () => void;
}

const BlacklistedItem = ({ item, revalidateList }: BlacklistedItemProps) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { addToast } = useToasts();
  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const intl = useIntl();
  const { hasPermission } = useUser();

  const url =
    item.mediaType === 'movie'
      ? `/api/v1/movie/${item.tmdbId}`
      : `/api/v1/tv/${item.tmdbId}`;
  const { data: title, error } = useSWR<MovieDetails | TvDetails>(
    inView ? url : null
  );

  if (!title && !error) {
    return (
      <div
        className="h-64 w-full animate-pulse rounded-xl bg-gray-800 xl:h-28"
        ref={ref}
      />
    );
  }

  const removeFromBlacklist = async (tmdbId: number, title?: string) => {
    setIsUpdating(true);

    try {
      await axios.delete(`/api/v1/blacklist/${tmdbId}`);

      addToast(
        <span>
          {intl.formatMessage(globalMessages.removeFromBlacklistSuccess, {
            title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );
    } catch {
      addToast(intl.formatMessage(globalMessages.blacklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    revalidateList();
    setIsUpdating(false);
  };

  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-4 text-gray-400 shadow-md ring-1 ring-gray-700 xl:h-28 xl:flex-row">
      {title && title.backdropPath && (
        <div className="absolute inset-0 z-0 w-full bg-cover bg-center xl:w-2/3">
          <CachedImage
            type="tmdb"
            src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${title.backdropPath}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(31, 41, 55, 0.47) 0%, rgba(31, 41, 55, 1) 100%)',
            }}
          />
        </div>
      )}
      <div className="relative flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="relative z-10 flex w-full items-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          <Link
            href={
              item.mediaType === 'movie'
                ? `/movie/${item.tmdbId}`
                : `/tv/${item.tmdbId}`
            }
            className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105"
          >
            <CachedImage
              type="tmdb"
              src={
                title?.posterPath
                  ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${title.posterPath}`
                  : '/images/jellyseerr_poster_not_found.png'
              }
              alt=""
              sizes="100vw"
              style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
              width={600}
              height={900}
            />
          </Link>
          <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
            <div className="pt-0.5 text-xs font-medium text-white sm:pt-1">
              {title &&
                (isMovie(title)
                  ? title.releaseDate
                  : title.firstAirDate
                )?.slice(0, 4)}
            </div>
            <Link
              href={
                item.mediaType === 'movie'
                  ? `/movie/${item.tmdbId}`
                  : `/tv/${item.tmdbId}`
              }
            >
              <span className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl">
                {title && (isMovie(title) ? title.title : title.name)}
              </span>
            </Link>
          </div>
        </div>

        <div className="z-10 mt-4 ml-4 flex w-full flex-col justify-center overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          <div className="card-field">
            <span className="card-field-name">Status</span>
            <Badge badgeType="danger">
              {intl.formatMessage(globalMessages.blacklisted)}
            </Badge>
          </div>

          {item.createdAt && (
            <div className="card-field">
              <span className="card-field-name">
                {intl.formatMessage(globalMessages.blacklisted)}
              </span>
              <span className="flex truncate text-sm text-gray-300">
                {intl.formatMessage(messages.blacklistedby, {
                  date: (
                    <FormattedRelativeTime
                      value={Math.floor(
                        (new Date(item.createdAt).getTime() - Date.now()) / 1000
                      )}
                      updateIntervalInSeconds={1}
                      numeric="auto"
                    />
                  ),
                  user: item.user ? (
                    <Link href={`/users/${item.user.id}`}>
                      <span className="group flex items-center truncate">
                        <CachedImage
                          type="avatar"
                          src={item.user.avatar}
                          alt=""
                          className="avatar-sm ml-1.5"
                          width={20}
                          height={20}
                          style={{ objectFit: 'cover' }}
                        />
                        <span className="ml-1 truncate text-sm font-semibold group-hover:text-white group-hover:underline">
                          {item.user.displayName}
                        </span>
                      </span>
                    </Link>
                  ) : item.blacklistedTags ? (
                    <span className="ml-1">
                      <BlacklistedTagsBadge data={item} />
                    </span>
                  ) : (
                    <span className="ml-1 truncate text-sm font-semibold">
                      ???
                    </span>
                  ),
                })}
              </span>
            </div>
          )}
          <div className="card-field">
            {item.mediaType === 'movie' ? (
              <div className="pointer-events-none z-40 self-start rounded-full border border-blue-500 bg-blue-600 bg-opacity-80 shadow-md">
                <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                  {intl.formatMessage(globalMessages.movie)}
                </div>
              </div>
            ) : (
              <div className="pointer-events-none z-40 self-start rounded-full border border-purple-600 bg-purple-600 bg-opacity-80 shadow-md">
                <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                  {intl.formatMessage(globalMessages.tvshow)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="z-10 mt-4 flex w-full flex-col justify-center space-y-2 pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
        {hasPermission(Permission.MANAGE_BLACKLIST) && (
          <ConfirmButton
            onClick={() =>
              removeFromBlacklist(
                item.tmdbId,
                title && (isMovie(title) ? title.title : title.name)
              )
            }
            confirmText={intl.formatMessage(
              isUpdating ? globalMessages.deleting : globalMessages.areyousure
            )}
            className={`w-full ${
              isUpdating ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <TrashIcon />
            <span>
              {intl.formatMessage(globalMessages.removefromBlacklist)}
            </span>
          </ConfirmButton>
        )}
      </div>
    </div>
  );
};

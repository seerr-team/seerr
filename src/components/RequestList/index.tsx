import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tooltip from '@app/components/Common/Tooltip';
import RequestItem from '@app/components/RequestList/RequestItem';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars3BottomLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  FunnelIcon,
} from '@heroicons/react/24/solid';
import type { RequestResultsResponse } from '@server/interfaces/api/requestInterfaces';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.RequestList', {
  requests: 'Requests',
  showallrequests: 'Show All Requests',
  sortAdded: 'Most Recent',
  sortModified: 'Last Modified',
  sortDirection: 'Toggle Sort Direction',
});

enum Filter {
  ALL = 'all',
  PENDING = 'pending',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  FAILED = 'failed',
  DELETED = 'deleted',
  COMPLETED = 'completed',
}

type Sort = 'added' | 'modified';

type SortDirection = 'asc' | 'desc';

type MediaType = 'all' | 'movie' | 'tv';

const RequestList = () => {
  const router = useRouter();
  const intl = useIntl();
  const { user } = useUser({
    id: Number(router.query.userId),
  });
  const { user: currentUser } = useUser();
  const [currentFilter, setCurrentFilter] = useState<Filter>(Filter.PENDING);
  const [currentSort, setCurrentSort] = useState<Sort>('added');
  const [currentMediaType, setCurrentMediaType] = useState<string>('all');
  const [currentSortDirection, setCurrentSortDirection] =
    useState<SortDirection>('desc');
  const [currentPageSize, setCurrentPageSize] = useState<number>(10);

  const page = router.query.page ? Number(router.query.page) : 1;
  const pageIndex = page - 1;
  const updateQueryParams = useUpdateQueryParams({ page: page.toString() });

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<RequestResultsResponse>(
    `/api/v1/request?take=${currentPageSize}&skip=${
      pageIndex * currentPageSize
    }&filter=${currentFilter}&mediaType=${currentMediaType}&sort=${currentSort}&sortDirection=${currentSortDirection}${
      router.pathname.startsWith('/profile')
        ? `&requestedBy=${currentUser?.id}`
        : router.query.userId
        ? `&requestedBy=${router.query.userId}`
        : ''
    }`
  );

  // Restore last set filter values on component mount
  useEffect(() => {
    const filterString = window.localStorage.getItem('rl-filter-settings');

    if (filterString) {
      const filterSettings = JSON.parse(filterString);

      setCurrentFilter(filterSettings.currentFilter);
      setCurrentSort(filterSettings.currentSort);
      setCurrentPageSize(filterSettings.currentPageSize);
      if (['asc', 'desc'].includes(filterSettings.currentSortDirection)) {
        setCurrentSortDirection(filterSettings.currentSortDirection);
      }
    }

    // If filter value is provided in query, use that instead
    if (Object.values(Filter).includes(router.query.filter as Filter)) {
      setCurrentFilter(router.query.filter as Filter);
    }
  }, [router.query.filter]);

  // Set filter values to local storage any time they are changed
  useEffect(() => {
    window.localStorage.setItem(
      'rl-filter-settings',
      JSON.stringify({
        currentFilter,
        currentMediaType,
        currentSort,
        currentSortDirection,
        currentPageSize,
      })
    );
  }, [
    currentFilter,
    currentMediaType,
    currentSort,
    currentSortDirection,
    currentPageSize,
  ]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <LoadingSpinner />;
  }

  const hasNextPage = data.pageInfo.pages > pageIndex + 1;
  const hasPrevPage = pageIndex > 0;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.requests),
          router.query.userId ? user?.displayName : '',
        ]}
      />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header
          subtext={
            router.pathname.startsWith('/profile') ? (
              <Link href={`/profile`} className="hover:underline">
                {currentUser?.displayName}
              </Link>
            ) : router.query.userId ? (
              <Link href={`/users/${user?.id}`} className="hover:underline">
                {user?.displayName}
              </Link>
            ) : (
              ''
            )
          }
        >
          {intl.formatMessage(messages.requests)}
        </Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <CircleStackIcon className="h-6 w-6" />
            </span>
            <select
              id="mediaType"
              name="mediaType"
              onChange={(e) => {
                setCurrentMediaType(e.target.value as MediaType);
                router.push({
                  pathname: router.pathname,
                  query: router.query.userId
                    ? { userId: router.query.userId }
                    : {},
                });
              }}
              value={currentMediaType}
              className="rounded-r-only"
            >
              <option value="all">
                {intl.formatMessage(globalMessages.all)}
              </option>
              <option value="movie">
                {intl.formatMessage(globalMessages.movies)}
              </option>
              <option value="tv">
                {intl.formatMessage(globalMessages.tvshows)}
              </option>
            </select>
          </div>
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
                  pathname: router.pathname,
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
              <option value="pending">
                {intl.formatMessage(globalMessages.pending)}
              </option>
              <option value="approved">
                {intl.formatMessage(globalMessages.approved)}
              </option>
              <option value="completed">
                {intl.formatMessage(globalMessages.completed)}
              </option>
              <option value="processing">
                {intl.formatMessage(globalMessages.processing)}
              </option>
              <option value="failed">
                {intl.formatMessage(globalMessages.failed)}
              </option>
              <option value="available">
                {intl.formatMessage(globalMessages.available)}
              </option>
              <option value="unavailable">
                {intl.formatMessage(globalMessages.unavailable)}
              </option>
              <option value="deleted">
                {intl.formatMessage(globalMessages.deleted)}
              </option>
            </select>
          </div>
          <div className="mb-2 flex flex-grow sm:mb-0 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
              <Bars3BottomLeftIcon className="h-6 w-6" />
            </span>
            <select
              id="sort"
              name="sort"
              onChange={(e) => {
                setCurrentSort(e.target.value as Sort);
                router.push({
                  pathname: router.pathname,
                  query: router.query.userId
                    ? { userId: router.query.userId }
                    : {},
                });
              }}
              value={currentSort}
              className="rounded-none border-r-0"
            >
              <option value="added">
                {intl.formatMessage(messages.sortAdded)}
              </option>
              <option value="modified">
                {intl.formatMessage(messages.sortModified)}
              </option>
            </select>
            <Tooltip content={intl.formatMessage(messages.sortDirection)}>
              <Button
                buttonType="default"
                className="z-40 mr-2 rounded-l-none border !border-gray-500 !bg-gray-800 !px-3 !text-gray-500 hover:!bg-gray-400 hover:!text-white"
                buttonSize="md"
                onClick={() =>
                  setCurrentSortDirection(
                    currentSortDirection === 'asc' ? 'desc' : 'asc'
                  )
                }
              >
                {currentSortDirection === 'asc' ? (
                  <ArrowUpIcon className="h-6 w-6" />
                ) : (
                  <ArrowDownIcon className="h-6 w-6" />
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
      {data.results.map((request) => {
        return (
          <div className="py-2" key={`request-list-${request.id}`}>
            <RequestItem
              request={request}
              revalidateList={() => revalidate()}
            />
          </div>
        );
      })}

      {data.results.length === 0 && (
        <div className="flex w-full flex-col items-center justify-center py-24 text-white">
          <span className="text-2xl text-gray-400">
            {intl.formatMessage(globalMessages.noresults)}
          </span>
          {(currentFilter !== Filter.ALL ||
            currentMediaType !== Filter.ALL) && (
            <div className="mt-4">
              <Button
                buttonType="primary"
                onClick={() => {
                  setCurrentFilter(Filter.ALL);
                  setCurrentMediaType(Filter.ALL);
                }}
              >
                {intl.formatMessage(messages.showallrequests)}
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="actions">
        <nav
          className="mb-3 flex flex-col items-center space-y-3 sm:flex-row sm:space-y-0"
          aria-label="Pagination"
        >
          <div className="hidden lg:flex lg:flex-1">
            <p className="text-sm">
              {data.results.length > 0 &&
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

export default RequestList;

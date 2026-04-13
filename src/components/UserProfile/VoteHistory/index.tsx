import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tooltip from '@app/components/Common/Tooltip';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars3BottomLeftIcon,
  CircleStackIcon,
  FunnelIcon,
} from '@heroicons/react/24/solid';
import type {
  VoteHistoryResponse,
  VoteResponse,
} from '@server/interfaces/api/voteInterfaces';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const PAGE_SIZE = 20;

const messages = defineMessages('components.UserProfile.VoteHistory', {
  voteHistory: 'Vote History',
  interested: 'Interested',
  notInterested: 'Not interested',
  sortAdded: 'Vote Time',
  sortDirection: 'Toggle Sort Direction',
  votedAt: 'Voted {date}',
  showAllVotes: 'Show All Votes',
  page: 'Page {page} of {pages}',
  unknownTitle: 'Unknown title',
});

type VoteFilter = 'all' | 'interested' | 'not_interested';
type SortDirection = 'asc' | 'desc';
type MediaTypeFilter = 'all' | 'movie' | 'tv';

const VoteHistoryItem = ({ vote }: { vote: VoteResponse }) => {
  const intl = useIntl();
  const detailsPath =
    vote.mediaType === 'movie'
      ? `/api/v1/movie/${vote.tmdbId}`
      : `/api/v1/tv/${vote.tmdbId}`;
  const { data } = useSWR<MovieDetails | TvDetails>(detailsPath);
  const title = data
    ? 'title' in data
      ? data.title
      : data.name
    : intl.formatMessage(messages.unknownTitle);
  const href =
    vote.mediaType === 'movie' ? `/movie/${vote.tmdbId}` : `/tv/${vote.tmdbId}`;
  const posterPath = data?.posterPath;

  return (
    <li className="rounded-xl bg-gray-800/60 p-3 ring-1 ring-gray-700">
      <div className="flex items-center gap-3">
        <Link href={href}>
          <CachedImage
            type="tmdb"
            src={
              posterPath
                ? `https://image.tmdb.org/t/p/w342${posterPath}`
                : '/images/seerr_poster_not_found.png'
            }
            alt=""
            width={48}
            height={72}
            className="rounded-md"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={href}
              className="truncate font-medium text-white hover:underline"
            >
              {title}
            </Link>
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-medium text-white ${
                vote.actionType === 'interested'
                  ? 'border-green-500 bg-green-500/80'
                  : 'border-red-500 bg-red-600/80'
              }`}
            >
              {vote.actionType === 'interested'
                ? intl.formatMessage(messages.interested)
                : intl.formatMessage(messages.notInterested)}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {intl.formatMessage(messages.votedAt, {
              date: intl.formatDate(vote.updatedAt, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </p>
        </div>
        <Link href={href} className="text-gray-300 hover:text-white">
          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
        </Link>
      </div>
    </li>
  );
};

const VoteHistory = () => {
  const intl = useIntl();
  const settings = useSettings();
  const { hasPermission } = useUser();
  const canViewVotes =
    settings.currentSettings.enableVoting && hasPermission(Permission.VOTE);
  const [page, setPage] = useState(1);
  const [currentFilter, setCurrentFilter] = useState<VoteFilter>('all');
  const [currentMediaType, setCurrentMediaType] =
    useState<MediaTypeFilter>('all');
  const [currentSort, setCurrentSort] = useState<'added'>('added');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const historyPath = useMemo(() => {
    if (!canViewVotes) {
      return null;
    }

    const params = new URLSearchParams({
      take: String(PAGE_SIZE),
      skip: String((page - 1) * PAGE_SIZE),
      filter: currentFilter,
      mediaType: currentMediaType,
      sort: currentSort,
      sortDirection,
    });

    return `/api/v1/vote/history?${params.toString()}`;
  }, [
    canViewVotes,
    currentFilter,
    currentMediaType,
    currentSort,
    page,
    sortDirection,
  ]);

  const { data, error, isLoading } = useSWR<VoteHistoryResponse>(historyPath);
  const isEmpty = !isLoading && (data?.results.length ?? 0) === 0;
  const totalPages = data?.pageInfo.pages ?? 1;

  if (error) {
    return <Error statusCode={500} />;
  }

  if (!canViewVotes) {
    return <Error statusCode={404} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.voteHistory)} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(messages.voteHistory)}</Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <CircleStackIcon className="h-6 w-6" />
            </span>
            <select
              id="mediaType"
              name="mediaType"
              onChange={(e) => {
                setCurrentMediaType(e.target.value as MediaTypeFilter);
                setPage(1);
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
                setCurrentFilter(e.target.value as VoteFilter);
                setPage(1);
              }}
              value={currentFilter}
              className="rounded-r-only"
            >
              <option value="all">
                {intl.formatMessage(globalMessages.all)}
              </option>
              <option value="interested">
                {intl.formatMessage(messages.interested)}
              </option>
              <option value="not_interested">
                {intl.formatMessage(messages.notInterested)}
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
                setCurrentSort(e.target.value as 'added');
                setPage(1);
              }}
              value={currentSort}
              className="rounded-none border-r-0"
            >
              <option value="added">
                {intl.formatMessage(messages.sortAdded)}
              </option>
            </select>
            <Tooltip content={intl.formatMessage(messages.sortDirection)}>
              <Button
                buttonType="default"
                className="z-40 mr-2 rounded-l-none border !border-gray-500 !bg-gray-800 !px-3 !text-gray-500 hover:!bg-gray-400 hover:!text-white"
                buttonSize="md"
                onClick={() => {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  setPage(1);
                }}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUpIcon className="h-6 w-6" />
                ) : (
                  <ArrowDownIcon className="h-6 w-6" />
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
      {isLoading ? (
        <LoadingSpinner />
      ) : isEmpty ? (
        <>
          <div className="mt-64 w-full text-center text-2xl text-gray-400">
            {intl.formatMessage(globalMessages.noresults)}
          </div>
          {(currentFilter !== 'all' || currentMediaType !== 'all') && (
            <div className="mt-4">
              <Button
                buttonType="primary"
                onClick={() => {
                  setCurrentFilter('all');
                  setCurrentMediaType('all');
                }}
              >
                {intl.formatMessage(messages.showAllVotes)}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {(data?.results ?? []).map((vote) => (
              <VoteHistoryItem
                key={`vote-history-item-${vote.id}`}
                vote={vote}
              />
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <Button
              buttonSize="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              {intl.formatMessage(globalMessages.previous)}
            </Button>
            <span className="text-sm text-gray-300">
              {intl.formatMessage(messages.page, { page, pages: totalPages })}
            </span>
            <Button
              buttonSize="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {intl.formatMessage(globalMessages.next)}
            </Button>
          </div>
        </>
      )}
    </>
  );
};

export default VoteHistory;

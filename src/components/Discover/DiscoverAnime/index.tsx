import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SlideCheckbox from '@app/components/Common/SlideCheckbox';
import FilterSlideover from '@app/components/Discover/FilterSlideover';
import type { FilterOptions } from '@app/components/Discover/constants';
import {
  countActiveFilters,
  prepareFilterValues,
} from '@app/components/Discover/constants';
import TitleCard from '@app/components/TitleCard';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import useDiscover from '@app/hooks/useDiscover';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import useVerticalScroll from '@app/hooks/useVerticalScroll';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { BarsArrowDownIcon, FunnelIcon } from '@heroicons/react/24/solid';
import type { SortOptions as TMDBSortOptions } from '@server/api/themoviedb';
import type { SeasonalAnimeResult } from '@server/interfaces/api/discoverInterfaces';
import type { TvResult } from '@server/models/Search';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverAnime', {
  discoveranime: 'Anime',
  seasonal: 'Seasonal',
  activefilters:
    '{count, plural, one {# Active Filter} other {# Active Filters}}',
  sortPopularityAsc: 'Popularity Ascending',
  sortPopularityDesc: 'Popularity Descending',
  sortFirstAirDateAsc: 'First Air Date Ascending',
  sortFirstAirDateDesc: 'First Air Date Descending',
  sortTmdbRatingAsc: 'TMDB Rating Ascending',
  sortTmdbRatingDesc: 'TMDB Rating Descending',
  sortTitleAsc: 'Title (A-Z) Ascending',
  sortTitleDesc: 'Title (Z-A) Descending',
});

const SortOptions: Record<string, TMDBSortOptions> = {
  PopularityAsc: 'popularity.asc',
  PopularityDesc: 'popularity.desc',
  FirstAirDateAsc: 'first_air_date.asc',
  FirstAirDateDesc: 'first_air_date.desc',
  TmdbRatingAsc: 'vote_average.asc',
  TmdbRatingDesc: 'vote_average.desc',
  TitleAsc: 'original_title.asc',
  TitleDesc: 'original_title.desc',
} as const;

const AnimeError = ({ onRetry }: { onRetry: () => void }) => {
  const intl = useIntl();

  return (
    <div data-testid="discover-anime-error">
      <ErrorPage statusCode={500} />
      <div className="mt-4 flex justify-center">
        <Button
          onClick={onRetry}
          data-testid="discover-anime-retry"
          type="button"
        >
          {intl.formatMessage(globalMessages.retry)}
        </Button>
      </div>
    </div>
  );
};

interface SeasonalAnimeListViewProps {
  titles: SeasonalAnimeResult[];
  isEmpty: boolean;
  isLoading: boolean;
  isReachingEnd: boolean;
  fetchMore: () => void;
  mutate?: () => void;
}

const SeasonalAnimeListView = ({
  titles,
  isEmpty,
  isLoading,
  isReachingEnd,
  fetchMore,
  mutate,
}: SeasonalAnimeListViewProps) => {
  const intl = useIntl();

  useVerticalScroll(fetchMore, !isLoading && !isEmpty && !isReachingEnd);

  return (
    <>
      {isEmpty && (
        <div className="mt-64 w-full text-center text-2xl text-gray-400">
          {intl.formatMessage(globalMessages.noresults)}
        </div>
      )}
      <ul className="cards-vertical">
        {titles.map((title, index) => (
          <li key={`${title.ratingKey}-${index}`}>
            <TmdbTitleCard
              id={title.tmdbId}
              tmdbId={title.tmdbId}
              type={title.mediaType}
              canExpand
              mutateParent={mutate}
            />
          </li>
        ))}
        {isLoading &&
          !isReachingEnd &&
          [...Array(20)].map((_item, index) => (
            <li key={`placeholder-${index}`}>
              <TitleCard.Placeholder canExpand />
            </li>
          ))}
      </ul>
    </>
  );
};

const AnimeList = ({ filters }: { filters: FilterOptions }) => {
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    mutate,
  } = useDiscover<TvResult, never, FilterOptions>('/api/v1/discover/anime', {
    ...filters,
  });

  if (error) {
    return <AnimeError onRetry={() => mutate?.()} />;
  }

  return (
    <ListView
      items={titles}
      isEmpty={isEmpty}
      isReachingEnd={isReachingEnd}
      isLoading={
        isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
      }
      onScrollBottom={fetchMore}
    />
  );
};

const SeasonalAnimeList = () => {
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    mutate,
  } = useDiscover<SeasonalAnimeResult>(
    '/api/v1/discover/seasonal-anime',
    undefined,
    { initialSize: 1 }
  );

  if (error) {
    return <AnimeError onRetry={() => mutate?.()} />;
  }

  return (
    <SeasonalAnimeListView
      titles={titles}
      isEmpty={isEmpty}
      isReachingEnd={isReachingEnd}
      isLoading={
        isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
      }
      fetchMore={fetchMore}
      mutate={mutate}
    />
  );
};

const DiscoverAnime = () => {
  const intl = useIntl();
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const preparedFilters = prepareFilterValues(router.query);
  const updateQueryParams = useUpdateQueryParams({});

  const seasonal = router.query.seasonal === 'true';

  const title = intl.formatMessage(messages.discoveranime);

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{title}</Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row sm:items-center lg:flex-grow-0">
          <div className="mb-2 flex items-center sm:mb-0 sm:mr-4">
            <span className="mr-2 text-sm text-gray-100">
              {intl.formatMessage(messages.seasonal)}
            </span>
            <SlideCheckbox
              checked={seasonal}
              onClick={() =>
                updateQueryParams('seasonal', seasonal ? undefined : 'true')
              }
            />
          </div>
          {!seasonal && (
            <>
              <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
                <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
                  <BarsArrowDownIcon className="h-6 w-6" />
                </span>
                <select
                  id="sortBy"
                  name="sortBy"
                  className="rounded-r-only"
                  value={preparedFilters.sortBy || SortOptions.PopularityDesc}
                  onChange={(e) => updateQueryParams('sortBy', e.target.value)}
                >
                  <option value={SortOptions.PopularityDesc}>
                    {intl.formatMessage(messages.sortPopularityDesc)}
                  </option>
                  <option value={SortOptions.PopularityAsc}>
                    {intl.formatMessage(messages.sortPopularityAsc)}
                  </option>
                  <option value={SortOptions.FirstAirDateDesc}>
                    {intl.formatMessage(messages.sortFirstAirDateDesc)}
                  </option>
                  <option value={SortOptions.FirstAirDateAsc}>
                    {intl.formatMessage(messages.sortFirstAirDateAsc)}
                  </option>
                  <option value={SortOptions.TmdbRatingDesc}>
                    {intl.formatMessage(messages.sortTmdbRatingDesc)}
                  </option>
                  <option value={SortOptions.TmdbRatingAsc}>
                    {intl.formatMessage(messages.sortTmdbRatingAsc)}
                  </option>
                  <option value={SortOptions.TitleAsc}>
                    {intl.formatMessage(messages.sortTitleAsc)}
                  </option>
                  <option value={SortOptions.TitleDesc}>
                    {intl.formatMessage(messages.sortTitleDesc)}
                  </option>
                </select>
              </div>
              <FilterSlideover
                type="tv"
                currentFilters={preparedFilters}
                onClose={() => setShowFilters(false)}
                show={showFilters}
              />
              <div className="mb-2 flex flex-grow sm:mb-0 lg:flex-grow-0">
                <Button onClick={() => setShowFilters(true)} className="w-full">
                  <FunnelIcon />
                  <span>
                    {intl.formatMessage(messages.activefilters, {
                      count: countActiveFilters(preparedFilters),
                    })}
                  </span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      {!router.isReady ? (
        <LoadingSpinner />
      ) : seasonal ? (
        <SeasonalAnimeList />
      ) : (
        <AnimeList filters={preparedFilters} />
      )}
    </>
  );
};

export default DiscoverAnime;

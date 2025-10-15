import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import { prepareFilterValues } from '@app/components/Discover/constants';
import useDiscover from '@app/hooks/useDiscover';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { BarsArrowDownIcon } from '@heroicons/react/24/solid';
import type { ArtistResult } from '@server/models/Search';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverMusicArtists', {
  discoverartists: 'Artists',
  sortPopularityDesc: 'Most Listened',
  sortPopularityAsc: 'Least Listened',
  sortNameAsc: 'Name (A-Z) Ascending',
  sortNameDesc: 'Name (Z-A) Descending',
});

const SortOptions = {
  PopularityDesc: 'listen_count.desc',
  PopularityAsc: 'listen_count.asc',
  NameAsc: 'name.asc',
  NameDesc: 'name.desc',
} as const;

const DiscoverMusicArtists = () => {
  const intl = useIntl();
  const router = useRouter();
  const updateQueryParams = useUpdateQueryParams({});

  const preparedFilters = prepareFilterValues(router.query);

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<ArtistResult>(
    '/api/v1/discover/music/artists',
    preparedFilters
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  const title = intl.formatMessage(messages.discoverartists);

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{title}</Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
              <BarsArrowDownIcon className="h-6 w-6" />
            </span>
            <select
              id="sortBy"
              name="sortBy"
              className="rounded-r-only"
              value={preparedFilters.sortBy}
              onChange={(e) => updateQueryParams('sortBy', e.target.value)}
            >
              <option value={SortOptions.PopularityDesc}>
                {intl.formatMessage(messages.sortPopularityDesc)}
              </option>
              <option value={SortOptions.PopularityAsc}>
                {intl.formatMessage(messages.sortPopularityAsc)}
              </option>
              <option value={SortOptions.NameAsc}>
                {intl.formatMessage(messages.sortNameAsc)}
              </option>
              <option value={SortOptions.NameDesc}>
                {intl.formatMessage(messages.sortNameDesc)}
              </option>
            </select>
          </div>
        </div>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default DiscoverMusicArtists;

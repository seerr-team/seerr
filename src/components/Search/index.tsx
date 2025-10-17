import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { CircleStackIcon } from '@heroicons/react/24/outline';
import type {
  AlbumResult,
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';

type MediaType =
  | 'all'
  | 'album'
  | 'ep'
  | 'single'
  | 'live'
  | 'compilation'
  | 'remix'
  | 'soundtrack'
  | 'broadcast'
  | 'demo'
  | 'other';

const messages = defineMessages('components.Search', {
  search: 'Search',
  searchresults: 'Search Results',
});

const Search = () => {
  const intl = useIntl();
  const router = useRouter();
  const [currentMediaType, setCurrentMediaType] = useState<string>('all');

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<MovieResult | TvResult | PersonResult | AlbumResult>(
    `/api/v1/search`,
    {
      query: router.query.query,
    },
    { hideAvailable: false, hideBlacklisted: false }
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  const mediaTypePicker = (
    <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
      <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
        <CircleStackIcon className="h-6 w-6" />
      </span>
      <select
        id="mediaType"
        name="mediaType"
        onChange={(e) => {
          setCurrentMediaType(e.target.value as MediaType);
        }}
        value={currentMediaType}
        className="rounded-r-only"
      >
        <option value="all">{intl.formatMessage(globalMessages.all)}</option>
        <option value="movie">
          {intl.formatMessage(globalMessages.movie)}
        </option>
        <option value="tv">{intl.formatMessage(globalMessages.tvshow)}</option>
        <option value="collection">
          {intl.formatMessage(globalMessages.collection)}
        </option>
        <option value="album">
          {intl.formatMessage(globalMessages.music)}
        </option>
        <option value="person">
          {intl.formatMessage(globalMessages.person)}
        </option>
      </select>
    </div>
  );

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.search)} />
      <div className="mt-1 mb-5 flex w-full items-center justify-center lg:justify-between">
        <Header>{intl.formatMessage(messages.searchresults)}</Header>
        <div className="hidden flex-shrink-0 lg:block">{mediaTypePicker}</div>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
        mediaTypeFilter={currentMediaType}
      />
    </>
  );
};

export default Search;

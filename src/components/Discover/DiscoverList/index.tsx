import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MediaListResponse } from '@server/lib/medialists/types';
import type { MovieResult, TvResult } from '@server/models/Search';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverList', {
  listTitle: 'TMDB List',
  listunavailable: 'This list is no longer available',
  listunavailabledescription:
    'It may have been deleted, or it may no longer be public on TMDB.',
});

const DiscoverList = () => {
  const router = useRouter();
  const intl = useIntl();

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    firstResultData,
  } = useDiscover<MovieResult | TvResult, Pick<MediaListResponse, 'list'>>(
    `/api/v1/discover/list/${router.query.listId}`
  );

  if (error) {
    return <ErrorPage statusCode={500} />;
  }

  // A list that could not be read at all is a different story from a list that
  // is simply empty, and deserves more than the generic "No results." grid.
  const isUnavailable = !!firstResultData?.list.unavailable;

  const title = isLoadingInitialData
    ? intl.formatMessage(globalMessages.loading)
    : (firstResultData?.list.name ?? intl.formatMessage(messages.listTitle));

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-5 mt-1">
        <Header>{title}</Header>
      </div>
      {isUnavailable ? (
        <div className="mt-64 w-full text-center text-gray-400">
          <p className="text-2xl">
            {intl.formatMessage(messages.listunavailable)}
          </p>
          <p className="mt-2 text-sm">
            {intl.formatMessage(messages.listunavailabledescription)}
          </p>
        </div>
      ) : (
        <ListView
          items={titles}
          isEmpty={isEmpty}
          isLoading={
            isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
          }
          isReachingEnd={isReachingEnd}
          onScrollBottom={fetchMore}
        />
      )}
    </>
  );
};

export default DiscoverList;

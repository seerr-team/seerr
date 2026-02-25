import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover, { encodeURIExtraParams } from '@app/hooks/useDiscover';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { TmdbKeyword } from '@server/api/themoviedb/interfaces';
import type { TvResult } from '@server/models/Search';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverTvKeyword', {
  keywordSeries: '{keywordTitle} Series',
});

const DiscoverTvKeyword = () => {
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
  } = useDiscover<TvResult, { keywords: TmdbKeyword[] }>(
    `/api/v1/discover/tv`,
    {
      keywords: encodeURIExtraParams(router.query.keywords as string),
    }
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  const title = isLoadingInitialData
    ? intl.formatMessage(globalMessages.loading)
    : intl.formatMessage(messages.keywordSeries, {
        keywordTitle: firstResultData?.keywords
          .map((k) => `${k.name[0].toUpperCase()}${k.name.substring(1)}`)
          .join(', '),
      });

  return (
    <>
      <PageTitle title={title} />
      <div className="mt-1 mb-5">
        <Header>{title}</Header>
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

export default DiscoverTvKeyword;

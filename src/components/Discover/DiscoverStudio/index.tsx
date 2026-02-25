import CachedImage from '@app/components/Common/CachedImage';
import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { ProductionCompany } from '@server/models/common';
import type { MovieResult } from '@server/models/Search';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverStudio', {
  studioMovies: '{studio} Movies',
});

const DiscoverMovieStudio = () => {
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
  } = useDiscover<MovieResult, { studio: ProductionCompany }>(
    `/api/v1/discover/movies/studio/${router.query.studioId}`
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  const title = isLoadingInitialData
    ? intl.formatMessage(globalMessages.loading)
    : intl.formatMessage(messages.studioMovies, {
        studio: firstResultData?.studio.name,
      });

  return (
    <>
      <PageTitle title={title} />
      <div className="mt-1 mb-5">
        <Header>
          {firstResultData?.studio.logoPath ? (
            <div className="relative mb-6 flex h-24 justify-center sm:h-32">
              <CachedImage
                type="tmdb"
                src={`https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)${firstResultData.studio.logoPath}`}
                alt={firstResultData.studio.name}
                className="object-contain"
                fill
              />
            </div>
          ) : (
            title
          )}
        </Header>
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

export default DiscoverMovieStudio;

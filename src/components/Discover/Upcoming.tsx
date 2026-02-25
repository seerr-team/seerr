import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MovieResult } from '@server/models/Search';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover', {
  upcomingmovies: 'Upcoming Movies',
});

const UpcomingMovies = () => {
  const intl = useIntl();

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<MovieResult>('/api/v1/discover/movies/upcoming');

  if (error) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.upcomingmovies)} />
      <div className="mt-1 mb-5">
        <Header>{intl.formatMessage(messages.upcomingmovies)}</Header>
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

export default UpcomingMovies;

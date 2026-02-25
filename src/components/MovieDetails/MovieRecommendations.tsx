import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MovieDetails } from '@server/models/Movie';
import type { MovieResult } from '@server/models/Search';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MovieDetails', {
  recommendations: 'Recommendations',
});

const MovieRecommendations = () => {
  const intl = useIntl();
  const router = useRouter();
  const { data: movieData } = useSWR<MovieDetails>(
    `/api/v1/movie/${router.query.movieId}`
  );
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<MovieResult>(
    `/api/v1/movie/${router.query.movieId}/recommendations`
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[intl.formatMessage(messages.recommendations), movieData?.title]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link href={`/movie/${movieData?.id}`} className="hover:underline">
              {movieData?.title}
            </Link>
          }
        >
          {intl.formatMessage(messages.recommendations)}
        </Header>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isReachingEnd={isReachingEnd}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default MovieRecommendations;

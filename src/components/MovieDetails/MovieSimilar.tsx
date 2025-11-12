import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import useFilterByLanguages from '@app/hooks/useFilterByLanguages';
import Error from '@app/pages/_error';
import { FilterByLanguage } from '@app/types/filters';
import defineMessages from '@app/utils/defineMessages';
import type { MovieDetails } from '@server/models/Movie';
import type { MovieResult } from '@server/models/Search';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MovieDetails', {
  similar: 'Similar Titles',
});

const MovieSimilar = () => {
  const router = useRouter();
  const intl = useIntl();
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
  } = useDiscover<MovieResult>(`/api/v1/movie/${router.query.movieId}/similar`);

  const filteredTitles = useFilterByLanguages({
    titles,
    movie: true,
    tv: false,
    key: FilterByLanguage.SIMILAR_MOVIES,
  });

  if (error) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[intl.formatMessage(messages.similar), movieData?.title]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link href={`/movie/${movieData?.id}`} className="hover:underline">
              {movieData?.title}
            </Link>
          }
        >
          {intl.formatMessage(messages.similar)}
        </Header>
      </div>
      <ListView
        items={filteredTitles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData ||
          (isLoadingMore && (filteredTitles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default MovieSimilar;

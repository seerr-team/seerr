import TitleCard from '@app/components/TitleCard';
import { Permission, useUser } from '@app/hooks/useUser';
import type { BookDetails } from '@server/models/Book';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import { useInView } from 'react-intersection-observer';
import useSWR from 'swr';

export interface TmdbTitleCardProps {
  id: number;
  tmdbId?: number;
  tvdbId?: number;
  hcId?: number;
  type: 'movie' | 'tv' | 'book';
  canExpand?: boolean;
  isAddedToWatchlist?: boolean;
  mutateParent?: () => void;
}

const isMovie = (
  movie: MovieDetails | TvDetails | BookDetails
): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

const isBook = (
  book: MovieDetails | TvDetails | BookDetails
): book is BookDetails => {
  return (book as BookDetails).author !== undefined;
};

const TmdbTitleCard = ({
  id,
  tmdbId,
  tvdbId,
  hcId,
  type,
  canExpand,
  isAddedToWatchlist = false,
  mutateParent,
}: TmdbTitleCardProps) => {
  const { hasPermission } = useUser();

  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const url =
    type === 'movie'
      ? `/api/v1/movie/${tmdbId}`
      : type === 'book'
      ? `/api/v1/book/${hcId}`
      : `/api/v1/tv/${tmdbId}`;
  const { data: title, error } = useSWR<MovieDetails | TvDetails | BookDetails>(
    inView ? `${url}` : null
  );

  if (!title && !error) {
    return (
      <div ref={ref}>
        <TitleCard.Placeholder canExpand={canExpand} />
      </div>
    );
  }

  if (!title) {
    return hasPermission(Permission.ADMIN) ? (
      <TitleCard.ErrorCard
        id={id}
        tmdbId={tmdbId}
        tvdbId={tvdbId}
        hcId={hcId}
        type={type}
      />
    ) : null;
  }

  return isBook(title) ? (
    <TitleCard
      key={title.id}
      id={title.id}
      image={title.posterPath}
      status={title.mediaInfo?.status}
      summary={title.description}
      title={title.title}
      year={title.releaseDate}
      mediaType={'book'}
      canExpand={canExpand}
      mutateParent={mutateParent}
    />
  ) : isMovie(title) ? (
    <TitleCard
      key={title.id}
      id={title.id}
      isAddedToWatchlist={
        title.mediaInfo?.watchlists?.length || isAddedToWatchlist
      }
      image={title.posterPath}
      status={title.mediaInfo?.status}
      summary={title.overview}
      title={title.title}
      userScore={title.voteAverage}
      year={title.releaseDate}
      mediaType={'movie'}
      canExpand={canExpand}
      mutateParent={mutateParent}
    />
  ) : (
    <TitleCard
      key={title.id}
      id={title.id}
      isAddedToWatchlist={
        title.mediaInfo?.watchlists?.length || isAddedToWatchlist
      }
      image={title.posterPath}
      status={title.mediaInfo?.status}
      summary={title.overview}
      title={title.name}
      userScore={title.voteAverage}
      year={title.firstAirDate}
      mediaType={'tv'}
      canExpand={canExpand}
      mutateParent={mutateParent}
    />
  );
};

export default TmdbTitleCard;

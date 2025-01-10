import TitleCard from '@app/components/TitleCard';
import { Permission, useUser } from '@app/hooks/useUser';
import type { MovieDetails } from '@server/models/Movie';
import type { MusicDetails } from '@server/models/Music';
import type { TvDetails } from '@server/models/Tv';
import { useInView } from 'react-intersection-observer';
import useSWR from 'swr';

export interface AddedCardProps {
  id?: number | string;
  tmdbId?: number;
  tvdbId?: number;
  mbId?: string;
  type: 'movie' | 'tv' | 'music';
  canExpand?: boolean;
  isAddedToWatchlist?: boolean;
  mutateParent?: () => void;
}

const isMovie = (
  media: MovieDetails | TvDetails | MusicDetails
): media is MovieDetails => {
  return (media as MovieDetails).title !== undefined;
};

const isMusic = (
  media: MovieDetails | TvDetails | MusicDetails
): media is MusicDetails => {
  return (media as MusicDetails).artistId !== undefined;
};

const AddedCard = ({
  id,
  tmdbId,
  tvdbId,
  mbId,
  type,
  canExpand,
  isAddedToWatchlist = false,
  mutateParent,
}: AddedCardProps) => {
  const { hasPermission } = useUser();

  const { ref, inView } = useInView({
    triggerOnce: true,
  });

  const url =
    type === 'music'
      ? `/api/v1/music/${mbId}`
      : type === 'movie'
      ? `/api/v1/movie/${tmdbId}`
      : `/api/v1/tv/${tmdbId}`;

  const { data: title, error } = useSWR<
    MovieDetails | TvDetails | MusicDetails
  >(inView ? url : null);

  if (!title && !error) {
    return (
      <div ref={ref}>
        <TitleCard.Placeholder canExpand={canExpand} />
      </div>
    );
  }

  if (!title) {
    return hasPermission(Permission.ADMIN) && id ? (
      <TitleCard.ErrorCard
        id={id}
        tmdbId={tmdbId}
        tvdbId={tvdbId}
        mbId={mbId}
        type={type}
      />
    ) : null;
  }

  if (isMusic(title)) {
    return (
      <TitleCard
        key={title.id}
        id={title.id}
        isAddedToWatchlist={
          title.mediaInfo?.watchlists?.length || isAddedToWatchlist
        }
        image={title.images?.find((image) => image.CoverType === 'Cover')?.Url}
        status={title.mediaInfo?.status}
        title={title.title}
        artist={title.artist.artistName}
        type={title.type}
        year={title.releaseDate}
        mediaType={'album'}
        canExpand={canExpand}
        mutateParent={mutateParent}
      />
    );
  }

  return isMovie(title) ? (
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

export default AddedCard;

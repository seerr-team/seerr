import RTAudFresh from '@app/assets/rt_aud_fresh.svg';
import RTAudRotten from '@app/assets/rt_aud_rotten.svg';
import RTFresh from '@app/assets/rt_fresh.svg';
import RTRotten from '@app/assets/rt_rotten.svg';
import ImdbLogo from '@app/assets/services/imdb.svg';
import TmdbLogo from '@app/assets/services/tmdb.svg';
import defineMessages from '@app/utils/defineMessages';
import type { RTRating } from '@server/api/rating/rottentomatoes';
import type { RatingResponse } from '@server/api/ratings';
import type { MediaType } from '@server/models/Search';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

interface TitleCardRatingsProps {
  id: number;
  mediaType: MediaType;
  userScore?: number;
  visible: boolean;
}

const RATINGS_REQUEST_DELAY_MS = 300;

const messages = defineMessages('components.TitleCard.TitleCardRatings', {
  ratings: 'Ratings',
  rottenTomatoesAudienceScore: 'Rotten Tomatoes Audience Score',
  rottenTomatoesCriticsScore: 'Rotten Tomatoes Critics Score',
  imdbUserScore: 'IMDb User Score',
  tmdbUserScore: 'TMDB User Score',
});

const TitleCardRatings = ({
  id,
  mediaType,
  userScore,
  visible,
}: TitleCardRatingsProps) => {
  const intl = useIntl();
  const [ratingsRequested, setRatingsRequested] = useState(false);

  useEffect(() => {
    if (!visible || ratingsRequested) {
      return;
    }

    const timeout = setTimeout(() => {
      setRatingsRequested(true);
    }, RATINGS_REQUEST_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [ratingsRequested, visible]);

  const { data: movieRatings } = useSWR<RatingResponse>(
    ratingsRequested && mediaType === 'movie'
      ? `/api/v1/movie/${id}/ratingscombined`
      : null,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  const { data: tvRatings } = useSWR<RTRating>(
    ratingsRequested && mediaType === 'tv' ? `/api/v1/tv/${id}/ratings` : null,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const rtRating =
    mediaType === 'movie'
      ? movieRatings?.rt
      : mediaType === 'tv'
        ? tvRatings
        : undefined;
  const imdbRating = movieRatings?.imdb;
  const hasRtAudienceScore =
    typeof rtRating?.audienceScore === 'number' &&
    rtRating.audienceRating !== undefined;
  const hasRtCriticsScore =
    !hasRtAudienceScore &&
    typeof rtRating?.criticsScore === 'number' &&
    rtRating.criticsRating !== undefined;
  const hasImdbScore = typeof imdbRating?.criticsScore === 'number';
  const hasTmdbScore = typeof userScore === 'number' && userScore > 0;

  if (
    !hasRtAudienceScore &&
    !hasRtCriticsScore &&
    !hasImdbScore &&
    !hasTmdbScore
  ) {
    return null;
  }

  return (
    <div
      className="mt-1 flex min-h-4 min-w-0 items-center gap-1 whitespace-nowrap text-[10px] font-medium md:gap-2 md:text-xs"
      aria-label={intl.formatMessage(messages.ratings)}
    >
      {hasRtAudienceScore && (
        <span className="flex min-w-0 items-center gap-0.5 md:gap-1">
          <span className="sr-only">
            {intl.formatMessage(messages.rottenTomatoesAudienceScore)}:{' '}
          </span>
          {rtRating.audienceRating === 'Spilled' ? (
            <RTAudRotten
              className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4"
              aria-hidden="true"
            />
          ) : (
            <RTAudFresh
              className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4"
              aria-hidden="true"
            />
          )}
          <span>{rtRating.audienceScore}%</span>
        </span>
      )}
      {hasRtCriticsScore && (
        <span className="flex min-w-0 items-center gap-0.5 md:gap-1">
          <span className="sr-only">
            {intl.formatMessage(messages.rottenTomatoesCriticsScore)}:{' '}
          </span>
          {rtRating.criticsRating === 'Rotten' ? (
            <RTRotten
              className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4"
              aria-hidden="true"
            />
          ) : (
            <RTFresh
              className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4"
              aria-hidden="true"
            />
          )}
          <span>{rtRating.criticsScore}%</span>
        </span>
      )}
      {hasImdbScore && (
        <span className="flex min-w-0 items-center gap-0.5 md:gap-1">
          <span className="sr-only">
            {intl.formatMessage(messages.imdbUserScore)}:{' '}
          </span>
          <ImdbLogo
            className="h-2.5 w-4 shrink-0 md:h-3 md:w-5"
            aria-hidden="true"
          />
          <span>{imdbRating.criticsScore}</span>
        </span>
      )}
      {hasTmdbScore && (
        <span className="flex min-w-0 items-center gap-0.5 md:gap-1">
          <span className="sr-only">
            {intl.formatMessage(messages.tmdbUserScore)}:{' '}
          </span>
          <TmdbLogo
            className="h-3.5 w-4 shrink-0 md:h-4 md:w-5"
            aria-hidden="true"
          />
          <span>{Math.round(userScore * 10)}%</span>
        </span>
      )}
    </div>
  );
};

export default TitleCardRatings;

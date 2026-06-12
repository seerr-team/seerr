import { type IMDBRating } from '@server/api/rating/imdbRadarrProxy';
import { type RTRating } from '@server/api/rating/rottentomatoes';

export interface RatingResponse {
  rt?: RTRating;
  imdb?: IMDBRating;
}

export const combineMovieRatingResults = (
  rtResult: PromiseSettledResult<RTRating | null>,
  imdbResult: PromiseSettledResult<IMDBRating | null>,
  imdbAttempted: boolean
): {
  ratings: RatingResponse;
  allProvidersFailed: boolean;
} => {
  const ratings: RatingResponse = {
    ...(rtResult.status === 'fulfilled' && rtResult.value
      ? { rt: rtResult.value }
      : {}),
    ...(imdbResult.status === 'fulfilled' && imdbResult.value
      ? { imdb: imdbResult.value }
      : {}),
  };
  const providerResults = imdbAttempted ? [rtResult, imdbResult] : [rtResult];

  return {
    ratings,
    allProvidersFailed: providerResults.every(
      (result) => result.status === 'rejected'
    ),
  };
};

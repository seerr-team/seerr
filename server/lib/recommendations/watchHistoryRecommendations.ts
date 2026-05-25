import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import { getWatchHistoryProvider } from '@server/lib/watchHistory';
import { mapMovieResult, mapTvResult } from '@server/models/Search';

type MovieRecommendationCandidate = {
  tmdbId: number;
  mediaType: MediaType.MOVIE;
  result: TmdbMovieResult;
  score: number;
};

type TvRecommendationCandidate = {
  tmdbId: number;
  mediaType: MediaType.TV;
  result: TmdbTvResult;
  score: number;
};

type RecommendationCandidate =
  | MovieRecommendationCandidate
  | TvRecommendationCandidate;

type WatchHistoryRecommendationSource = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
};

type RecommendationScoreResult = {
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
};

const getCandidateKey = (mediaType: MediaType, tmdbId: number): string => {
  return `${mediaType}:${tmdbId}`;
};

const getCandidateScore = ({
  result,
  sourceIndex,
  duplicateBoost,
}: {
  result: RecommendationScoreResult;
  sourceIndex: number;
  duplicateBoost: number;
}): number => {
  const recencyScore = 10 / (sourceIndex + 1);
  const popularityScore = Math.log10((result.popularity ?? 1) + 1);
  const ratingScore = (result.vote_average ?? 0) / 2;
  const voteCountScore = Math.log10((result.vote_count ?? 1) + 1) / 2;

  return (
    recencyScore +
    popularityScore +
    ratingScore +
    voteCountScore +
    duplicateBoost
  );
};

export const getWatchHistoryRecommendationSources = async ({
  userId,
  language,
  limit = 10,
}: {
  userId: number;
  language?: string;
  limit?: number;
}): Promise<WatchHistoryRecommendationSource[]> => {
  const tmdb = new TheMovieDb();
  const watchData = await getWatchHistoryProvider().getUserWatchData(userId);

  const watchedItems = watchData.recentlyWatched
    .filter((item) => item.tmdbId && item.mediaType)
    .slice(0, limit);

  const uniqueWatchedItems = [
    ...new Map(
      watchedItems.map((item) => [
        getCandidateKey(item.mediaType, item.tmdbId),
        item,
      ])
    ).values(),
  ];

  const sources = await Promise.all(
    uniqueWatchedItems.map(async (item) => {
      if (item.mediaType === MediaType.MOVIE) {
        const movie = await tmdb.getMovie({
          movieId: item.tmdbId,
          language,
        });

        return {
          tmdbId: item.tmdbId,
          mediaType: MediaType.MOVIE,
          title: movie.title,
        };
      }

      if (item.mediaType === MediaType.TV) {
        const tv = await tmdb.getTvShow({
          tvId: item.tmdbId,
          language,
        });

        return {
          tmdbId: item.tmdbId,
          mediaType: MediaType.TV,
          title: tv.name,
        };
      }

      return null;
    })
  );

  return sources.filter(
    (source): source is WatchHistoryRecommendationSource => !!source
  );
};

export const getBecauseYouWatchedRecommendations = async ({
  user,
  tmdbId,
  mediaType,
  page = 1,
  language,
}: {
  user?: User;
  tmdbId: number;
  mediaType: MediaType;
  page?: number;
  language?: string;
}) => {
  const tmdb = new TheMovieDb();

  if (mediaType === MediaType.MOVIE) {
    const results = await tmdb.getMovieRecommendations({
      movieId: tmdbId,
      page,
      language,
    });

    const relatedMedia = await Media.getRelatedMedia(
      user,
      results.results.map((result) => ({
        tmdbId: result.id,
        mediaType: MediaType.MOVIE,
      }))
    );

    return {
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
      results: results.results
        .filter((result) => result.id !== tmdbId)
        .map((result) => {
          const media = relatedMedia.find(
            (item) =>
              item.tmdbId === result.id && item.mediaType === MediaType.MOVIE
          );

          return mapMovieResult(result, media);
        }),
    };
  }

  const results = await tmdb.getTvRecommendations({
    tvId: tmdbId,
    page,
    language,
  });

  const relatedMedia = await Media.getRelatedMedia(
    user,
    results.results.map((result) => ({
      tmdbId: result.id,
      mediaType: MediaType.TV,
    }))
  );

  return {
    page: results.page,
    totalPages: results.total_pages,
    totalResults: results.total_results,
    results: results.results
      .filter((result) => result.id !== tmdbId)
      .map((result) => {
        const media = relatedMedia.find(
          (item) => item.tmdbId === result.id && item.mediaType === MediaType.TV
        );

        return mapTvResult(result, media);
      }),
  };
};

export const getPersonalizedWatchHistoryRecommendations = async ({
  user,
  userId,
  language,
}: {
  user?: User;
  userId: number;
  language?: string;
}) => {
  const tmdb = new TheMovieDb();
  const watchData = await getWatchHistoryProvider().getUserWatchData(userId);

  const watchedItems = watchData.recentlyWatched
    .filter((item) => item.tmdbId && item.mediaType)
    .slice(0, 10);

  const watchedKeys = new Set(
    watchedItems.map((item) => getCandidateKey(item.mediaType, item.tmdbId))
  );

  const candidates = new Map<string, RecommendationCandidate>();

  for (const [sourceIndex, source] of watchedItems.entries()) {
    if (source.mediaType === MediaType.MOVIE) {
      const response = await tmdb.getMovieRecommendations({
        movieId: source.tmdbId,
        page: 1,
        language,
      });

      for (const result of response.results) {
        const key = getCandidateKey(MediaType.MOVIE, result.id);

        if (watchedKeys.has(key)) {
          continue;
        }

        const existingCandidate = candidates.get(key);

        candidates.set(key, {
          tmdbId: result.id,
          mediaType: MediaType.MOVIE,
          result,
          score:
            (existingCandidate?.score ?? 0) +
            getCandidateScore({
              result,
              sourceIndex,
              duplicateBoost: existingCandidate ? 4 : 0,
            }),
        });
      }

      continue;
    }

    if (source.mediaType === MediaType.TV) {
      const response = await tmdb.getTvRecommendations({
        tvId: source.tmdbId,
        page: 1,
        language,
      });

      for (const result of response.results) {
        const key = getCandidateKey(MediaType.TV, result.id);

        if (watchedKeys.has(key)) {
          continue;
        }

        const existingCandidate = candidates.get(key);

        candidates.set(key, {
          tmdbId: result.id,
          mediaType: MediaType.TV,
          result,
          score:
            (existingCandidate?.score ?? 0) +
            getCandidateScore({
              result,
              sourceIndex,
              duplicateBoost: existingCandidate ? 4 : 0,
            }),
        });
      }
    }
  }

  const sortedCandidates = [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  const relatedMedia = await Media.getRelatedMedia(
    user,
    sortedCandidates.map((candidate) => ({
      tmdbId: candidate.tmdbId,
      mediaType: candidate.mediaType,
    }))
  );

  const results = sortedCandidates
    .map((candidate) => {
      const media = relatedMedia.find(
        (item) =>
          item.tmdbId === candidate.tmdbId &&
          item.mediaType === candidate.mediaType
      );

      if (candidate.mediaType === MediaType.MOVIE) {
        return mapMovieResult(candidate.result, media);
      }

      return mapTvResult(candidate.result, media);
    })
    .slice(0, 20);

  return {
    page: 1,
    totalPages: 1,
    totalResults: results.length,
    results,
  };
};

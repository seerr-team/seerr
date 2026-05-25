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

type WatchHistoryMediaItem = Media & {
  tmdbId: number;
  mediaType: MediaType.MOVIE | MediaType.TV;
};

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
  mediaType: MediaType.MOVIE | MediaType.TV;
  title: string;
};

type RecommendationScoreResult = {
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
};

const isWatchHistoryMediaItem = (
  item: Media
): item is WatchHistoryMediaItem => {
  return (
    !!item.tmdbId &&
    (item.mediaType === MediaType.MOVIE || item.mediaType === MediaType.TV)
  );
};

const getCandidateKey = (
  mediaType: MediaType.MOVIE | MediaType.TV,
  tmdbId: number
): string => {
  return `${mediaType}:${tmdbId}`;
};

const getUniqueWatchedItems = ({
  items,
  limit,
}: {
  items: Media[];
  limit: number;
}): WatchHistoryMediaItem[] => {
  const seenKeys = new Set<string>();

  return items
    .filter(isWatchHistoryMediaItem)
    .filter((item) => {
      const key = getCandidateKey(item.mediaType, item.tmdbId);

      if (seenKeys.has(key)) {
        return false;
      }

      seenKeys.add(key);
      return true;
    })
    .slice(0, limit);
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

  const uniqueWatchedItems = getUniqueWatchedItems({
    items: watchData.recentlyWatched,
    limit,
  });

  const sources = await Promise.all(
    uniqueWatchedItems.map(
      async (item): Promise<WatchHistoryRecommendationSource | null> => {
        try {
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

          const tv = await tmdb.getTvShow({
            tvId: item.tmdbId,
            language,
          });

          return {
            tmdbId: item.tmdbId,
            mediaType: MediaType.TV,
            title: tv.name,
          };
        } catch {
          return null;
        }
      }
    )
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
  page = 1,
  language,
}: {
  user?: User;
  userId: number;
  page?: number;
  language?: string;
}) => {
  const tmdb = new TheMovieDb();
  const watchData = await getWatchHistoryProvider().getUserWatchData(userId);

  const resultsPerPage = 20;
  const maxCandidates = 40;
  const currentPage = Math.max(1, page);
  const offset = (currentPage - 1) * resultsPerPage;

  const watchedItems = getUniqueWatchedItems({
    items: watchData.recentlyWatched,
    limit: 10,
  });

  const watchedKeys = new Set(
    watchedItems.map((item) => getCandidateKey(item.mediaType, item.tmdbId))
  );

  const candidates = new Map<string, RecommendationCandidate>();

  for (const [sourceIndex, source] of watchedItems.entries()) {
    if (source.mediaType === MediaType.MOVIE) {
      try {
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
      } catch {
        continue;
      }

      continue;
    }

    try {
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
    } catch {
      continue;
    }
  }

  const sortedCandidates = [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);

  const paginatedCandidates = sortedCandidates.slice(
    offset,
    offset + resultsPerPage
  );

  const relatedMedia = await Media.getRelatedMedia(
    user,
    paginatedCandidates.map((candidate) => ({
      tmdbId: candidate.tmdbId,
      mediaType: candidate.mediaType,
    }))
  );

  const results = paginatedCandidates.map((candidate) => {
    const media = relatedMedia.find(
      (item) =>
        item.tmdbId === candidate.tmdbId &&
        item.mediaType === candidate.mediaType
    );

    if (candidate.mediaType === MediaType.MOVIE) {
      return mapMovieResult(candidate.result, media);
    }

    return mapTvResult(candidate.result, media);
  });

  return {
    page: currentPage,
    totalPages: Math.max(
      1,
      Math.ceil(sortedCandidates.length / resultsPerPage)
    ),
    totalResults: sortedCandidates.length,
    results,
  };
};

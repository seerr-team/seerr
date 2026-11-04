import TheMovieDb from '@server/api/themoviedb';
import type {
  TmdbMovieDetails,
  TmdbMovieResult,
  TmdbPersonDetails,
  TmdbPersonResult,
  TmdbSearchMovieResponse,
  TmdbSearchMultiResponse,
  TmdbSearchTvResponse,
  TmdbTvDetails,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';
import {
  mapMovieDetailsToResult,
  mapPersonDetailsToResult,
  mapTvDetailsToResult,
} from '@server/models/Search';
import {
  isMovie,
  isMovieDetails,
  isTvDetails,
} from '@server/utils/typeHelpers';

interface SearchProvider {
  pattern: RegExp;
  search: ({
    id,
    language,
    query,
  }: {
    id: string;
    language?: string;
    query?: string;
  }) => Promise<TmdbSearchMultiResponse>;
}

const searchProviders: SearchProvider[] = [];

export const findSearchProvider = (
  query: string
): SearchProvider | undefined => {
  return searchProviders.find((provider) => provider.pattern.test(query));
};

export const parseTrailingYear = (
  query: string
): { title: string; year: number } | undefined => {
  const match = query
    .trim()
    .match(/^(.*?)(?:\s*\((\d{4})\)|\s*\[(\d{4})\]|\s+(\d{4}))$/);
  if (!match) return undefined;

  const title = match[1].trim();
  const year = Number(match[2] ?? match[3] ?? match[4]);
  if (!title || year < 1870 || year > 2099) return undefined;

  return { title, year };
};

export const searchTitleWithYear = async ({
  query,
  title,
  year,
  language,
  page,
}: {
  query: string;
  title: string;
  year: number;
  language?: string;
  page?: number;
}): Promise<TmdbSearchMultiResponse> => {
  const tmdb = new TheMovieDb();
  const yearProvider = findSearchProvider(`year:${year}`);
  if (!yearProvider) return tmdb.searchMulti({ query, language, page });

  const [original, filtered] = await Promise.all([
    tmdb.searchMulti({ query, language, page }),
    yearProvider.search({
      id: String(year),
      query: `${title} year:${year}`,
      language,
    }),
  ]);

  // A trailing year can be part of the title (for example, Blade Runner 2049).
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const hasExactTitle = original.results.some(
    (result) =>
      ('title' in result &&
        result.title?.toLocaleLowerCase() === normalizedQuery) ||
      ('name' in result && result.name?.toLocaleLowerCase() === normalizedQuery)
  );
  return hasExactTitle || filtered.results.length === 0 ? original : filtered;
};

searchProviders.push({
  pattern: new RegExp(/(?<=tmdb:)\d+/),
  search: async ({ id, language }) => {
    const tmdb = new TheMovieDb();

    const moviePromise = tmdb.getMovie({ movieId: parseInt(id), language });
    const tvShowPromise = tmdb.getTvShow({ tvId: parseInt(id), language });
    const personPromise = tmdb.getPerson({ personId: parseInt(id), language });

    const responses = await Promise.allSettled([
      moviePromise,
      tvShowPromise,
      personPromise,
    ]);

    const successfulResponses = responses.filter(
      (r) => r.status === 'fulfilled'
    ) as (
      | PromiseFulfilledResult<TmdbMovieDetails>
      | PromiseFulfilledResult<TmdbTvDetails>
      | PromiseFulfilledResult<TmdbPersonDetails>
    )[];

    const results: (TmdbMovieResult | TmdbTvResult | TmdbPersonResult)[] = [];

    if (successfulResponses.length) {
      results.push(
        ...successfulResponses.map((r) => {
          if (isMovieDetails(r.value)) {
            return mapMovieDetailsToResult(r.value);
          } else if (isTvDetails(r.value)) {
            return mapTvDetailsToResult(r.value);
          } else {
            return mapPersonDetailsToResult(r.value);
          }
        })
      );
    }

    return {
      page: 1,
      total_pages: 1,
      total_results: results.length,
      results,
    };
  },
});

searchProviders.push({
  pattern: new RegExp(/(?<=imdb:)(tt|nm)\d+/),
  search: async ({ id, language }) => {
    const tmdb = new TheMovieDb();

    const responses = await tmdb.getByExternalId({
      externalId: id,
      type: 'imdb',
      language,
    });

    const results: (TmdbMovieResult | TmdbTvResult | TmdbPersonResult)[] = [];

    // set the media_type here since searching by external id doesn't return it
    results.push(
      ...(responses.movie_results.map((movie) => ({
        ...movie,
        media_type: 'movie',
      })) as TmdbMovieResult[]),
      ...(responses.tv_results.map((tv) => ({
        ...tv,
        media_type: 'tv',
      })) as TmdbTvResult[]),
      ...(responses.person_results.map((person) => ({
        ...person,
        media_type: 'person',
      })) as TmdbPersonResult[])
    );

    return {
      page: 1,
      total_pages: 1,
      total_results: results.length,
      results,
    };
  },
});

searchProviders.push({
  pattern: new RegExp(/(?<=tvdb:)\d+/),
  search: async ({ id, language }) => {
    const tmdb = new TheMovieDb();

    const responses = await tmdb.getByExternalId({
      externalId: parseInt(id),
      type: 'tvdb',
      language,
    });

    const results: (TmdbMovieResult | TmdbTvResult | TmdbPersonResult)[] = [];

    // set the media_type here since searching by external id doesn't return it
    results.push(
      ...(responses.movie_results.map((movie) => ({
        ...movie,
        media_type: 'movie',
      })) as TmdbMovieResult[]),
      ...(responses.tv_results.map((tv) => ({
        ...tv,
        media_type: 'tv',
      })) as TmdbTvResult[]),
      ...(responses.person_results.map((person) => ({
        ...person,
        media_type: 'person',
      })) as TmdbPersonResult[])
    );

    return {
      page: 1,
      total_pages: 1,
      total_results: results.length,
      results,
    };
  },
});

searchProviders.push({
  pattern: /(?<=(?<!\w)(?:year|y):)\d{4}(?!\d)/,
  search: async ({ id: year, query, language }) => {
    const tmdb = new TheMovieDb();

    const moviesPromise = tmdb.searchMovies({
      query: query?.replace(/\b(?:year|y):\d{4}(?!\d)/i, '').trim() ?? '',
      year: parseInt(year),
      language,
    });
    const tvShowsPromise = tmdb.searchTvShows({
      query: query?.replace(/\b(?:year|y):\d{4}(?!\d)/i, '').trim() ?? '',
      year: parseInt(year),
      language,
    });

    const responses = await Promise.allSettled([moviesPromise, tvShowsPromise]);

    const successfulResponses = responses.filter(
      (r) => r.status === 'fulfilled'
    ) as (
      | PromiseFulfilledResult<TmdbSearchMovieResponse>
      | PromiseFulfilledResult<TmdbSearchTvResponse>
    )[];

    const results: (TmdbMovieResult | TmdbTvResult)[] = [];

    if (successfulResponses.length) {
      successfulResponses.forEach((response) => {
        response.value.results.forEach((result) =>
          // set the media_type here since the search endpoints don't return it
          results.push(
            isMovie(result)
              ? { ...result, media_type: 'movie' }
              : { ...result, media_type: 'tv' }
          )
        );
      });
    }

    return {
      page: 1,
      total_pages: 1,
      total_results: results.length,
      results,
    };
  },
});

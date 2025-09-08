import defineMessages from '@app/utils/defineMessages';
import type { ParsedUrlQuery } from 'querystring';
import { z } from 'zod';

type AvailableColors =
  | 'black'
  | 'red'
  | 'darkred'
  | 'blue'
  | 'lightblue'
  | 'darkblue'
  | 'orange'
  | 'darkorange'
  | 'green'
  | 'lightgreen'
  | 'purple'
  | 'darkpurple'
  | 'yellow'
  | 'pink';

export const colorTones: Record<AvailableColors, [string, string]> = {
  red: ['991B1B', 'FCA5A5'],
  darkred: ['1F2937', 'F87171'],
  blue: ['032541', '01b4e4'],
  lightblue: ['1F2937', '60A5FA'],
  darkblue: ['1F2937', '2864d2'],
  orange: ['92400E', 'FCD34D'],
  lightgreen: ['065F46', '6EE7B7'],
  green: ['087d29', '21cb51'],
  purple: ['5B21B6', 'C4B5FD'],
  yellow: ['777e0d', 'e4ed55'],
  darkorange: ['552c01', 'd47c1d'],
  black: ['1F2937', 'D1D5DB'],
  pink: ['9D174D', 'F9A8D4'],
  darkpurple: ['480c8b', 'a96bef'],
};

export const genreColorMap: Record<number, [string, string]> = {
  0: colorTones.black,
  28: colorTones.red, // Action
  12: colorTones.darkpurple, // Adventure
  16: colorTones.blue, // Animation
  35: colorTones.orange, // Comedy
  80: colorTones.darkblue, // Crime
  99: colorTones.lightgreen, // Documentary
  18: colorTones.pink, // Drama
  10751: colorTones.yellow, // Family
  14: colorTones.lightblue, // Fantasy
  36: colorTones.orange, // History
  27: colorTones.black, // Horror
  10402: colorTones.blue, // Music
  9648: colorTones.purple, // Mystery
  10749: colorTones.pink, // Romance
  878: colorTones.lightblue, // Science Fiction
  10770: colorTones.red, // TV Movie
  53: colorTones.black, // Thriller
  10752: colorTones.darkred, // War
  37: colorTones.orange, // Western
  10759: colorTones.darkpurple, // Action & Adventure
  10762: colorTones.blue, // Kids
  10763: colorTones.black, // News
  10764: colorTones.darkorange, // Reality
  10765: colorTones.lightblue, // Sci-Fi & Fantasy
  10766: colorTones.pink, // Soap
  10767: colorTones.lightgreen, // Talk
  10768: colorTones.darkred, // War & Politics
};

export const sliderTitles = defineMessages('components.Discover', {
  recentrequests: 'Recent Requests',
  popularmovies: 'Popular Movies',
  populartv: 'Popular Series',
  upcomingtv: 'Upcoming Series',
  recentlyAdded: 'Recently Added',
  upcoming: 'Upcoming Movies',
  trending: 'Trending',
  plexwatchlist: 'Your Watchlist',
  moviegenres: 'Movie Genres',
  tvgenres: 'Series Genres',
  studios: 'Studios',
  networks: 'Networks',
  tmdbmoviekeyword: 'TMDB Movie Keyword',
  tmdbtvkeyword: 'TMDB Series Keyword',
  tmdbmoviegenre: 'TMDB Movie Genre',
  tmdbtvgenre: 'TMDB Series Genre',
  tmdbnetwork: 'TMDB Network',
  tmdbstudio: 'TMDB Studio',
  tmdbsearch: 'TMDB Search',
  tmdbmoviestreamingservices: 'TMDB Movie Streaming Services',
  tmdbtvstreamingservices: 'TMDB TV Streaming Services',
});

export const QueryFilterOptions = z.object({
  sortBy: z.string().optional(),
  primaryReleaseDateGte: z.string().optional(),
  primaryReleaseDateLte: z.string().optional(),
  firstAirDateGte: z.string().optional(),
  firstAirDateLte: z.string().optional(),
  studio: z.string().optional(),
  genre: z.string().optional(),
  keywords: z.string().optional(),
  language: z.string().optional(),
  withRuntimeGte: z.string().optional(),
  withRuntimeLte: z.string().optional(),
  voteAverageGte: z.string().optional(),
  voteAverageLte: z.string().optional(),
  voteCountLte: z.string().optional(),
  voteCountGte: z.string().optional(),
  watchRegion: z.string().optional(),
  watchProviders: z.string().optional(),
  status: z.string().optional(),
  certification: z.string().optional(),
  certificationGte: z.string().optional(),
  certificationLte: z.string().optional(),
  certificationCountry: z.string().optional(),
  certificationMode: z.enum(['exact', 'range']).optional(),
});

export type FilterOptions = z.infer<typeof QueryFilterOptions>;

export const prepareFilterValues = (
  inputValues: ParsedUrlQuery
): FilterOptions => {
  const filterValues: FilterOptions = {};

  const values = QueryFilterOptions.parse(inputValues);

  if (values.sortBy) {
    filterValues.sortBy = values.sortBy;
  }

  if (values.primaryReleaseDateGte) {
    filterValues.primaryReleaseDateGte = values.primaryReleaseDateGte;
  }

  if (values.primaryReleaseDateLte) {
    filterValues.primaryReleaseDateLte = values.primaryReleaseDateLte;
  }

  if (values.firstAirDateGte) {
    filterValues.firstAirDateGte = values.firstAirDateGte;
  }

  if (values.firstAirDateLte) {
    filterValues.firstAirDateLte = values.firstAirDateLte;
  }

  if (values.studio) {
    filterValues.studio = values.studio;
  }

  if (values.genre) {
    filterValues.genre = values.genre;
  }

  if (values.status) {
    filterValues.status = values.status;
  }

  if (values.keywords) {
    filterValues.keywords = values.keywords;
  }

  if (values.language) {
    filterValues.language = values.language;
  }

  if (values.withRuntimeGte) {
    filterValues.withRuntimeGte = values.withRuntimeGte;
  }

  if (values.withRuntimeLte) {
    filterValues.withRuntimeLte = values.withRuntimeLte;
  }

  if (values.voteAverageGte) {
    filterValues.voteAverageGte = values.voteAverageGte;
  }

  if (values.voteAverageLte) {
    filterValues.voteAverageLte = values.voteAverageLte;
  }

  if (values.voteCountGte) {
    filterValues.voteCountGte = values.voteCountGte;
  }

  if (values.voteCountLte) {
    filterValues.voteCountLte = values.voteCountLte;
  }

  if (values.watchProviders) {
    filterValues.watchProviders = values.watchProviders;
  }

  if (values.watchRegion) {
    filterValues.watchRegion = values.watchRegion;
  }

  if (values.certification) {
    filterValues.certification = values.certification;
  }

  if (values.certificationGte) {
    filterValues.certificationGte = values.certificationGte;
  }

  if (values.certificationLte) {
    filterValues.certificationLte = values.certificationLte;
  }

  if (values.certificationCountry) {
    filterValues.certificationCountry = values.certificationCountry;
  }

  if (values.certificationMode) {
    filterValues.certificationMode = values.certificationMode;
  } else if (values.certification) {
    filterValues.certificationMode = 'exact';
  } else if (values.certificationGte || values.certificationLte) {
    filterValues.certificationMode = 'range';
  }

  return filterValues;
};

export const countActiveFilters = (filterValues: FilterOptions): number => {
  let totalCount = 0;
  const clonedFilters = Object.assign({}, filterValues);

  if (clonedFilters.voteAverageGte || filterValues.voteAverageLte) {
    totalCount += 1;
    delete clonedFilters.voteAverageGte;
    delete clonedFilters.voteAverageLte;
  }

  if (clonedFilters.voteCountGte || filterValues.voteCountLte) {
    totalCount += 1;
    delete clonedFilters.voteCountGte;
    delete clonedFilters.voteCountLte;
  }

  if (clonedFilters.withRuntimeGte || filterValues.withRuntimeLte) {
    totalCount += 1;
    delete clonedFilters.withRuntimeGte;
    delete clonedFilters.withRuntimeLte;
  }

  if (clonedFilters.watchProviders) {
    totalCount += 1;
    delete clonedFilters.watchProviders;
    delete clonedFilters.watchRegion;
  }

  if (
    clonedFilters.certification ||
    clonedFilters.certificationGte ||
    clonedFilters.certificationLte ||
    clonedFilters.certificationCountry
  ) {
    totalCount += 1;
    delete clonedFilters.certification;
    delete clonedFilters.certificationGte;
    delete clonedFilters.certificationLte;
    delete clonedFilters.certificationCountry;
  }

  delete clonedFilters.certificationMode;
  totalCount += Object.keys(clonedFilters).length;

  return totalCount;
};

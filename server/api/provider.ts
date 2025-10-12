import type {
  TmdbSeasonWithEpisodes,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';

export interface TvShowProvider {
  getTvShow({
    tvId,
    language,
  }: {
    tvId: number;
    language?: string;
  }): Promise<TmdbTvDetails>;
  getTvSeason({
    tvId,
    seasonNumber,
    language,
  }: {
    tvId: number;
    seasonNumber: number;
    language?: string;
  }): Promise<TmdbSeasonWithEpisodes>;
  getShowByTvdbId({
    tvdbId,
    language,
  }: {
    tvdbId: number;
    language?: string;
  }): Promise<TmdbTvDetails>;
}

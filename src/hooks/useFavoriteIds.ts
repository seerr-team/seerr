import type { FavoriteResponse } from '@server/interfaces/api/discoverInterfaces';
import useSWR from 'swr';

export const FAVORITE_IDS_KEY = '/api/v1/favorites?take=1000';

const useFavoriteIds = () => {
  const { data, mutate } = useSWR<FavoriteResponse>(FAVORITE_IDS_KEY);

  const favoriteSet = new Set(
    (data?.results ?? []).map((f) => `${f.mediaType}:${f.tmdbId}`)
  );

  return {
    isFavorite: (tmdbId: number, mediaType: string) =>
      favoriteSet.has(`${mediaType}:${tmdbId}`),
    mutate,
  };
};

export default useFavoriteIds;

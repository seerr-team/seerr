import type {
  TmdbMovieResult,
  TmdbTvResult,
} from '@server/api/themoviedb/interfaces';

export type PersonalizedRecommendation = TmdbMovieResult | TmdbTvResult;

export const recommendationKey = (
  result: Pick<PersonalizedRecommendation, 'id' | 'media_type'>
): string => `${result.media_type}:${result.id}`;

export const shuffleRecommendations = <T>(items: T[]): T[] => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

export const selectPersonalizedRecommendations = (
  candidates: PersonalizedRecommendation[],
  excludedKeys: Set<string>,
  limit = 20,
  now = new Date()
): PersonalizedRecommendation[] => {
  const unique = new Map<string, PersonalizedRecommendation>();

  for (const candidate of shuffleRecommendations(candidates)) {
    const key = recommendationKey(candidate);
    if (!excludedKeys.has(key) && !unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  const pool = [...unique.values()];
  const selected: PersonalizedRecommendation[] = [];
  const selectedKeys = new Set<string>();
  const recentBoundary = new Date(now);
  recentBoundary.setMonth(recentBoundary.getMonth() - 18);

  const take = (items: PersonalizedRecommendation[], amount: number): void => {
    for (const item of shuffleRecommendations(items)) {
      if (selected.length >= limit || amount <= 0) {
        break;
      }

      const key = recommendationKey(item);
      if (!selectedKeys.has(key)) {
        selected.push(item);
        selectedKeys.add(key);
        amount -= 1;
      }
    }
  };

  const releaseDate = (item: PersonalizedRecommendation): string =>
    item.media_type === 'movie' ? item.release_date : item.first_air_date;
  const isLesserKnown = (item: PersonalizedRecommendation): boolean =>
    item.vote_count >= 10 && item.vote_count <= 500 && item.vote_average >= 6;

  take(
    pool.filter((item) => {
      const date = releaseDate(item);
      return date && new Date(date) >= recentBoundary && new Date(date) <= now;
    }),
    6
  );
  take(
    pool.filter((item) => item.media_type === 'tv' && isLesserKnown(item)),
    5
  );
  take(pool.filter(isLesserKnown), 3);
  take(pool, limit);

  return shuffleRecommendations(selected);
};

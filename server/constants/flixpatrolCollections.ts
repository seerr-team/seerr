type DiscoverCollectionMediaType = 'movie' | 'tv';

interface FlixPatrolDiscoverCollection {
  id: string;
  title: string;
  mediaType: DiscoverCollectionMediaType;
  platform: string;
  limit: number;
}

const MOVIE_COLLECTIONS: FlixPatrolDiscoverCollection[] = [
  {
    id: 'netflix-top-10',
    title: 'Netflix Top 10',
    mediaType: 'movie',
    platform: 'netflix',
    limit: 10,
  },
  {
    id: 'prime-video-top-10',
    title: 'Prime Video Top 10',
    mediaType: 'movie',
    platform: 'amazon-prime',
    limit: 10,
  },
  {
    id: 'disney-plus-top-10',
    title: 'Disney+ Top 10',
    mediaType: 'movie',
    platform: 'disney',
    limit: 10,
  },
];

const TV_COLLECTIONS: FlixPatrolDiscoverCollection[] = [
  {
    id: 'netflix-top-10',
    title: 'Netflix Top 10',
    mediaType: 'tv',
    platform: 'netflix',
    limit: 10,
  },
  {
    id: 'prime-video-top-10',
    title: 'Prime Video Top 10',
    mediaType: 'tv',
    platform: 'amazon-prime',
    limit: 10,
  },
  {
    id: 'apple-tv-plus-top-10',
    title: 'Apple TV+ Top 10',
    mediaType: 'tv',
    platform: 'apple-tv',
    limit: 10,
  },
];

export const getFlixPatrolDiscoverCollections = (
  mediaType: DiscoverCollectionMediaType
): FlixPatrolDiscoverCollection[] =>
  mediaType === 'movie' ? MOVIE_COLLECTIONS : TV_COLLECTIONS;

export const getFlixPatrolDiscoverCollection = (
  mediaType: DiscoverCollectionMediaType,
  collectionId: string
): FlixPatrolDiscoverCollection | undefined =>
  getFlixPatrolDiscoverCollections(mediaType).find(
    (collection) => collection.id === collectionId
  );

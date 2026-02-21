import type {
  WatchProviderDetails,
  WatchProviders,
} from '@server/models/common';

interface UseExcludedProvidersResult {
  streamingProviders: WatchProviderDetails[];
  watchProviderLink: string | undefined;
  excludedWatchProviders: number[];
  firstExcludedProvider: WatchProviderDetails | undefined;
  isAvailableOnExcludedProvider: boolean;
}

/**
 * Computes excluded-provider state from watch-provider data.
 *
 * @param watchProviders  - The full list of watch-provider regions from the
 *                          media item (data?.watchProviders).
 * @param streamingRegion - The active streaming region (e.g. "US").
 * @param userExcludedProviders    - Pipe-delimited string from user settings.
 * @param globalExcludedProviders  - Pipe-delimited string from global settings.
 */
export function useExcludedProviders(
  watchProviders: WatchProviders[] | undefined,
  streamingRegion: string,
  userExcludedProviders: string | undefined,
  globalExcludedProviders: string
): UseExcludedProvidersResult {
  const streamingProviderData = watchProviders?.find(
    (provider) => provider.iso_3166_1 === streamingRegion
  );
  const streamingProviders = streamingProviderData?.flatrate ?? [];
  const watchProviderLink = streamingProviderData?.link;

  const excludedWatchProviders = (
    userExcludedProviders ??
    globalExcludedProviders ??
    ''
  )
    .split('|')
    .filter(Boolean)
    .map(Number);

  const firstExcludedProvider = streamingProviders.find((p) =>
    excludedWatchProviders.includes(p.id)
  );

  const isAvailableOnExcludedProvider =
    excludedWatchProviders.length > 0 &&
    streamingProviders.some((p) => excludedWatchProviders.includes(p.id));

  return {
    streamingProviders,
    watchProviderLink,
    excludedWatchProviders,
    firstExcludedProvider,
    isAvailableOnExcludedProvider,
  };
}

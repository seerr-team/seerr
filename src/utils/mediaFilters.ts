import { MediaStatus } from '@server/constants/media';

interface FilterableMedia {
  mediaType: string;
  mediaInfo?: {
    status?: MediaStatus;
    hasActiveRequest?: boolean;
  };
}

export interface MediaFilterOptions {
  hideAvailable?: boolean;
  hideBlocklisted?: boolean;
  hideRequested?: boolean;
}

/**
 * Shared visibility check for discover-style listings. Only movies and
 * series are ever hidden; people, collections, and any other result types
 * always remain visible.
 */
export const isVisibleTitle = (
  title: FilterableMedia,
  {
    hideAvailable = false,
    hideBlocklisted = false,
    hideRequested = false,
  }: MediaFilterOptions
): boolean => {
  if (title.mediaType !== 'movie' && title.mediaType !== 'tv') {
    return true;
  }

  const status = title.mediaInfo?.status;

  if (
    hideAvailable &&
    (status === MediaStatus.AVAILABLE ||
      status === MediaStatus.PARTIALLY_AVAILABLE)
  ) {
    return false;
  }

  if (hideBlocklisted && status === MediaStatus.BLOCKLISTED) {
    return false;
  }

  if (hideRequested && title.mediaInfo?.hasActiveRequest) {
    return false;
  }

  return true;
};

export const filterVisibleTitles = <T extends FilterableMedia>(
  titles: T[],
  options: MediaFilterOptions
): T[] => titles.filter((title) => isVisibleTitle(title, options));

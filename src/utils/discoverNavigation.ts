export type DiscoverNavigationMediaType = 'movie' | 'tv';

export interface DiscoverNavigationItem {
  id: number;
  mediaType: DiscoverNavigationMediaType;
}

interface DiscoverNavigationContext {
  sourceUrl: string;
  items: DiscoverNavigationItem[];
}

interface DiscoverNavigationPending {
  path: string;
  expiresAt: number;
}

export interface DiscoverNavigationState {
  previous?: DiscoverNavigationItem;
  next?: DiscoverNavigationItem;
}

const CONTEXT_KEY = 'seerr.discoverNavigation.context';
const PENDING_KEY = 'seerr.discoverNavigation.pending';
const PENDING_TTL_MS = 5 * 60 * 1000;

const isBrowser = (): boolean => typeof window !== 'undefined';

export const getDiscoverNavigationPath = (
  item: DiscoverNavigationItem
): string => `/${item.mediaType}/${item.id}`;

export const storeDiscoverNavigationContext = (
  items: DiscoverNavigationItem[],
  currentItem: DiscoverNavigationItem
): void => {
  if (!isBrowser()) {
    return;
  }

  const uniqueItems = items.filter(
    (item, index, allItems) =>
      allItems.findIndex(
        (candidate) =>
          candidate.id === item.id && candidate.mediaType === item.mediaType
      ) === index
  );

  const context: DiscoverNavigationContext = {
    sourceUrl: `${window.location.pathname}${window.location.search}`,
    items: uniqueItems,
  };

  window.sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  markDiscoverNavigationPending(currentItem);
};

export const markDiscoverNavigationPending = (
  item: DiscoverNavigationItem
): void => {
  if (!isBrowser()) {
    return;
  }

  const pending: DiscoverNavigationPending = {
    path: getDiscoverNavigationPath(item),
    expiresAt: Date.now() + PENDING_TTL_MS,
  };

  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
};

export const getDiscoverNavigationState = (
  currentItem: DiscoverNavigationItem
): DiscoverNavigationState | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const pending = JSON.parse(
      window.sessionStorage.getItem(PENDING_KEY) ?? 'null'
    ) as DiscoverNavigationPending | null;

    if (
      !pending ||
      pending.expiresAt < Date.now() ||
      pending.path !== getDiscoverNavigationPath(currentItem)
    ) {
      return null;
    }

    const context = JSON.parse(
      window.sessionStorage.getItem(CONTEXT_KEY) ?? 'null'
    ) as DiscoverNavigationContext | null;

    if (!context?.items.length) {
      return null;
    }

    const currentIndex = context.items.findIndex(
      (item) =>
        item.id === currentItem.id && item.mediaType === currentItem.mediaType
    );

    if (currentIndex === -1) {
      return null;
    }

    return {
      previous: context.items[currentIndex - 1],
      next: context.items[currentIndex + 1],
    };
  } catch {
    window.sessionStorage.removeItem(CONTEXT_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    return null;
  }
};

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

const getSessionStorage = (): Storage | null => {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const removeDiscoverNavigationStorage = (): void => {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(CONTEXT_KEY);
    storage.removeItem(PENDING_KEY);
  } catch {
    // Ignore storage cleanup failures. Navigation state is optional.
  }
};

export const getDiscoverNavigationPath = (
  item: DiscoverNavigationItem
): string => `/${item.mediaType}/${item.id}`;

export const storeDiscoverNavigationContext = (
  items: DiscoverNavigationItem[],
  currentItem: DiscoverNavigationItem
): void => {
  const storage = getSessionStorage();

  if (!storage) {
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

  try {
    storage.setItem(CONTEXT_KEY, JSON.stringify(context));
  } catch {
    removeDiscoverNavigationStorage();
    return;
  }

  markDiscoverNavigationPending(currentItem);
};

export const markDiscoverNavigationPending = (
  item: DiscoverNavigationItem
): void => {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  const pending: DiscoverNavigationPending = {
    path: getDiscoverNavigationPath(item),
    expiresAt: Date.now() + PENDING_TTL_MS,
  };

  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    removeDiscoverNavigationStorage();
  }
};

export const getDiscoverNavigationState = (
  currentItem: DiscoverNavigationItem
): DiscoverNavigationState | null => {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  try {
    const pending = JSON.parse(
      storage.getItem(PENDING_KEY) ?? 'null'
    ) as DiscoverNavigationPending | null;

    if (
      !pending ||
      pending.expiresAt < Date.now() ||
      pending.path !== getDiscoverNavigationPath(currentItem)
    ) {
      return null;
    }

    const context = JSON.parse(
      storage.getItem(CONTEXT_KEY) ?? 'null'
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
    removeDiscoverNavigationStorage();
    return null;
  }
};

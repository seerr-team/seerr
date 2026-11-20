import { useRouter } from 'next/router';
import { useEffect, useLayoutEffect, useRef } from 'react';

const ENTRIES_KEY = 'scroll-restoration';
const HIDDEN_ENTRY_KEY = 'scroll-restoration-hidden-entry';
const CHECK_INTERVAL_MS = 100;
const SETTLE_MS = 1000;
const MAX_WAIT_MS = 10000;
const INPUT_EVENTS = ['keydown', 'pointerdown', 'wheel'];
const KEY_REFRESH_EVENTS = ['keydown', 'pointerdown', 'scroll'];

interface ScrollEntry {
  url: string;
  y: number;
  pages?: number;
}

let listPages: number | undefined;
let pageRestore: { url: string; pages: number } | undefined;

// sessionStorage throws when site data is blocked or the quota is full
const tryStorage = <T>(access: () => T): T | undefined => {
  try {
    return access();
  } catch {
    return undefined;
  }
};

const readEntries = (): Record<string, ScrollEntry> =>
  tryStorage(() => JSON.parse(sessionStorage.getItem(ENTRIES_KEY) ?? '{}')) ??
  {};

export const usePageCountRestoration = (
  size: number,
  setSize: (size: number) => void,
  isLoading: boolean
) => {
  const router = useRouter();

  useEffect(() => {
    listPages = size;
    return () => {
      listPages = undefined;
    };
  }, [size]);

  useEffect(() => {
    if (pageRestore?.url !== router.asPath || isLoading) {
      return;
    }

    if (size < pageRestore.pages) {
      setSize(pageRestore.pages);
    } else {
      pageRestore = undefined;
    }
  }, [isLoading, router.asPath, setSize, size]);
};

const useScrollRestoration = () => {
  const router = useRouter();
  const isLandingRef = useRef(true);
  const poppedRef = useRef(false);

  // a layout effect so pageRestore is set before the page's own effects read it
  useLayoutEffect(() => {
    const url = router.asPath;
    const isLanding = isLandingRef.current;
    const popped = poppedRef.current;
    isLandingRef.current = false;
    poppedRef.current = false;
    pageRestore = undefined;

    // routeChangeStart can fire after a back/forward has already moved history.state
    let entryKey: string | undefined = window.history.state?.key;
    let pendingY: number | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    const refreshKey = () => {
      if (!poppedRef.current) {
        entryKey = window.history.state?.key;
      }
    };
    const save = () => {
      if (!entryKey) {
        return;
      }

      const entries = readEntries();
      entries[entryKey] = {
        url,
        y: pendingY ?? window.scrollY,
        pages: pageRestore?.pages ?? listPages,
      };
      tryStorage(() =>
        sessionStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
      );
    };
    const saveIfHidden = () => {
      if (document.visibilityState === 'hidden') {
        refreshKey();
        save();
        const hiddenKey = entryKey;
        if (hiddenKey) {
          tryStorage(() => sessionStorage.setItem(HIDDEN_ENTRY_KEY, hiddenKey));
        }
      }
    };
    const onPopState = () => {
      poppedRef.current = true;
      stop();
    };
    const stop = () => {
      clearInterval(timer);
      INPUT_EVENTS.forEach((event) =>
        window.removeEventListener(event, cancel)
      );
    };
    const done = () => {
      pendingY = undefined;
      stop();
    };
    const cancel = () => {
      pageRestore = undefined;
      done();
    };

    let entry: ScrollEntry | undefined;
    if (isLanding) {
      // a fresh load opened from another page won't match the hidden URL
      const hiddenKey = tryStorage(() =>
        sessionStorage.getItem(HIDDEN_ENTRY_KEY)
      );
      tryStorage(() => sessionStorage.removeItem(HIDDEN_ENTRY_KEY));
      entry = hiddenKey ? readEntries()[hiddenKey] : undefined;
    } else if (popped && entryKey) {
      entry = readEntries()[entryKey];
    }

    if (entry?.url === url && entry.y) {
      const { y } = entry;
      pendingY = y;
      if (entry.pages) {
        pageRestore = { url, pages: entry.pages };
      }

      const startedAt = Date.now();
      let height: number | undefined;
      let changedAt: number | undefined;
      const check = () => {
        const now = Date.now();
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        // a spinner holds the height still, so settling counts from the first change
        if (height !== undefined && maxY !== height) {
          changedAt = now;
        }
        height = maxY;

        // a list still loading its saved pages has not settled
        const isSettled =
          !pageRestore &&
          changedAt !== undefined &&
          now - changedAt >= SETTLE_MS;
        if (maxY >= y || isSettled) {
          window.scrollTo(0, y);
          done();
        } else if (
          !pageRestore &&
          changedAt === undefined &&
          now - startedAt >= MAX_WAIT_MS
        ) {
          done();
        }
      };

      INPUT_EVENTS.forEach((event) =>
        window.addEventListener(event, cancel, { passive: true })
      );
      timer = setInterval(check, CHECK_INTERVAL_MS);
      check();
    }

    router.events.on('routeChangeStart', save);
    window.addEventListener('popstate', onPopState);
    KEY_REFRESH_EVENTS.forEach((event) =>
      window.addEventListener(event, refreshKey, { passive: true })
    );
    document.addEventListener('visibilitychange', saveIfHidden);

    return () => {
      stop();
      router.events.off('routeChangeStart', save);
      window.removeEventListener('popstate', onPopState);
      KEY_REFRESH_EVENTS.forEach((event) =>
        window.removeEventListener(event, refreshKey)
      );
      document.removeEventListener('visibilitychange', saveIfHidden);
    };
  }, [router.asPath, router.events]);
};

export default useScrollRestoration;

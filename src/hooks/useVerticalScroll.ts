import { debounce } from 'lodash';
import type { MutableRefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

const IS_SCROLLING_CHECK_THROTTLE = 200;
const BUFFER_HEIGHT = 200;

/**
 * useVerticalScroll is a custom hook to handle infinite scrolling
 *
 * @param callback Callback is executed when page reaches bottom
 * @param shouldFetch Disables callback if true
 */
const useVerticalScroll = (
  callback: () => void,
  shouldFetch: boolean
): boolean => {
  const [isScrolling, setScrolling] = useState(false);

  type SetTimeoutReturnType = ReturnType<typeof setTimeout>;
  const scrollingTimer: MutableRefObject<SetTimeoutReturnType | undefined> =
    useRef(undefined);

  const runCallback = () => {
    if (shouldFetch) {
      const scrollTop = Math.max(
        window.pageYOffset,
        document.documentElement.scrollTop,
        document.body.scrollTop
      );
      if (
        window.innerHeight + scrollTop >=
        document.documentElement.offsetHeight - BUFFER_HEIGHT
      ) {
        callback();
      }
    }
  };

  const debouncedCallback = debounce(runCallback, 50);

  useEffect(() => {
    runCallback();
  });

  useEffect(() => {
    const onScroll = () => {
      if (scrollingTimer.current !== undefined) {
        clearTimeout(scrollingTimer.current);
      }
      if (!isScrolling) {
        setScrolling(true);
      }

      scrollingTimer.current = setTimeout(() => {
        setScrolling(false);
      }, IS_SCROLLING_CHECK_THROTTLE);
      debouncedCallback();
    };

    const onResize = () => {
      debouncedCallback();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);

      if (scrollingTimer.current !== undefined) {
        clearTimeout(scrollingTimer.current);
      }
    };
  });

  return isScrolling;
};

export default useVerticalScroll;

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

const PullToRefresh = () => {
  const router = useRouter();
  const [pullStartPoint, setPullStartPoint] = useState(0);
  const [pullChange, setPullChange] = useState(0);
  const refreshDiv = useRef<HTMLDivElement>(null);

  // Various pull down thresholds that determine icon location
  const pullDownInitThreshold = pullChange > 20;
  const pullDownStopThreshold = 120;
  const pullDownReloadThreshold = pullChange > 340;
  const pullDownIconLocation = pullChange / 3;

  useEffect(() => {
    // Reload function that is called when reload threshold has been hit
    // Add loading class to determine when to add spin animation
    const forceReload = () => {
      setPullStartPoint(0);
      refreshDiv.current?.classList.add('loading');
      setTimeout(() => {
        router.reload();
      }, 1000);
    };

    const html = document.querySelector('html');

    // Determines if we are at the top of the page
    // Locks or unlocks page when pulling down to refresh
    const pullStart = (e: TouchEvent) => {
      setPullStartPoint(e.targetTouches[0].screenY);

      const html = document.querySelector('html');

      if (window.scrollY === 0 && window.scrollX === 0) {
        refreshDiv.current?.classList.add('block');
        refreshDiv.current?.classList.remove('hidden');
        document.body.style.touchAction = 'none';
        document.body.style.overscrollBehavior = 'none';
        if (html) {
          html.style.overscrollBehaviorY = 'none';
        }
      } else {
        setPullStartPoint(0);
        refreshDiv.current?.classList.remove('block');
        refreshDiv.current?.classList.add('hidden');
      }
    };

    // Tracks how far we have pulled down the refresh icon
    const pullDown = async (e: TouchEvent) => {
      const screenY = e.targetTouches[0].screenY;
      const pullLength =
        pullStartPoint < screenY ? Math.abs(screenY - pullStartPoint) : 0;

      setPullChange(pullLength);
    };

    // Will reload the page if we are past the threshold
    // Otherwise, we reset the pull
    const pullFinish = () => {
      if (pullDownReloadThreshold && pullStartPoint !== 0) {
        forceReload();
      } else {
        setPullChange(0);
        setTimeout(() => setPullStartPoint(0), 200);
      }

      document.body.style.touchAction = 'auto';
      document.body.style.overscrollBehaviorY = 'auto';
      if (html) {
        html.style.overscrollBehaviorY = 'auto';
      }
    };

    window.addEventListener('touchstart', pullStart, { passive: false });
    window.addEventListener('touchmove', pullDown, { passive: false });
    window.addEventListener('touchend', pullFinish, { passive: false });

    return () => {
      window.removeEventListener('touchstart', pullStart);
      window.removeEventListener('touchmove', pullDown);
      window.removeEventListener('touchend', pullFinish);
    };
  }, [
    pullDownInitThreshold,
    pullDownReloadThreshold,
    pullStartPoint,
    refreshDiv,
    router,
    setPullStartPoint,
  ]);

  if (
    pullStartPoint === 0 &&
    !refreshDiv.current?.classList.contains('loading')
  ) {
    return null;
  }

  return (
    <div
      ref={refreshDiv}
      className="absolute top-0 right-0 left-0 z-50 m-auto w-fit transition-all ease-out"
      id="refreshIcon"
      style={{
        top:
          pullDownIconLocation < pullDownStopThreshold && pullDownInitThreshold
            ? pullDownIconLocation
            : pullDownInitThreshold
              ? pullDownStopThreshold
              : '',
      }}
    >
      <div
        className={`${
          refreshDiv.current?.classList.contains('loading') && 'animate-spin'
        } relative -top-28 h-9 w-9 rounded-full border-4 border-gray-800 bg-gray-800 shadow-md ring-1 shadow-black ring-gray-700`}
        style={{ animationDirection: 'reverse' }}
      >
        <ArrowPathIcon
          className={`rounded-full ${
            pullDownReloadThreshold && 'rotate-180'
          } text-indigo-500 transition-all duration-300`}
        />
      </div>
    </div>
  );
};

export default PullToRefresh;

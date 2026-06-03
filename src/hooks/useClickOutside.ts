import { useEffect } from 'react';

/**
 * useClickOutside
 *
 * Simple hook to add an event listener to the body and allow a callback to
 * be triggered when clicking outside of the target ref
 *
 * @param ref Any HTML Element ref
 * @param callback Callback triggered when clicking outside of ref element
 */
const useClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  callback: (e: MouseEvent) => void
): void => {
  useEffect(() => {
    const handleBodyClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback(e);
      }
    };
    document.body.addEventListener('click', handleBodyClick, { capture: true });

    return () => {
      document.body.removeEventListener('click', handleBodyClick);
    };
  }, [ref, callback]);
};

export default useClickOutside;

import CachedImage from '@app/components/Common/CachedImage';
import { useLockBodyScroll } from '@app/hooks/useLockBodyScroll';
import { Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface PosterLightboxProps {
  show: boolean;
  posterPath?: string | null;
  alt?: string;
  onClose: () => void;
}

const PosterLightbox = ({
  show,
  posterPath,
  alt = '',
  onClose,
}: PosterLightboxProps) => {
  useLockBodyScroll(show);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show, onClose]);

  if (typeof window === 'undefined') return null;

  return ReactDOM.createPortal(
    <Transition
      as={Fragment}
      show={show}
      enter="transition-opacity duration-150"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-150"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label={alt || 'Poster preview'}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-zoom-out bg-black/90 focus:outline-none"
          onClick={onClose}
          aria-label="Close poster preview"
        />
        <button
          type="button"
          className="absolute right-4 top-4 z-20 rounded-full bg-gray-800/80 p-2 text-white hover:bg-gray-700/80 focus:outline-none focus:ring-2 focus:ring-white"
          onClick={onClose}
          aria-label="Close poster preview"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="pointer-events-none relative z-10 flex h-full w-full items-center justify-center">
          <CachedImage
            type="tmdb"
            src={
              posterPath
                ? `https://image.tmdb.org/t/p/original${posterPath}`
                : '/images/seerr_poster_not_found.png'
            }
            alt={alt}
            width={1000}
            height={1500}
            sizes="100vw"
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            priority
          />
        </div>
      </div>
    </Transition>,
    document.body
  );
};

export default PosterLightbox;

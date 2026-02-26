/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useLockBodyScroll } from '@app/hooks/useLockBodyScroll';
import { Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface SlideOverProps {
  show?: boolean;
  title: React.ReactNode;
  subText?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const SlideOver = ({
  show = false,
  title,
  subText,
  onClose,
  children,
}: SlideOverProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const slideoverRef = useRef(null);
  useLockBodyScroll(show);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return ReactDOM.createPortal(
    <Transition
      as={Fragment}
      show={show}
      appear
      enter="transition-opacity ease-in-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in-out duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden bg-gray-800/70`}
        onClick={() => onClose()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <section className="absolute inset-y-0 right-0 flex max-w-full">
            <Transition.Child
              appear
              enter="transition-transform ease-in-out duration-500 sm:duration-700"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transition-transform ease-in-out duration-500 sm:duration-700"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <div
                className="slideover relative h-full w-screen max-w-md p-2 sm:p-3"
                ref={slideoverRef}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex h-full flex-col rounded-lg bg-gray-800/80 shadow-xl ring-1 ring-gray-700 backdrop-blur">
                  <header className="space-y-1 border-b border-gray-700 px-4 py-4">
                    <div className="flex items-center justify-between space-x-3">
                      <h2 className="text-overseerr text-2xl font-bold leading-7">
                        {title}
                      </h2>
                      <div className="flex h-7 items-center">
                        <button
                          aria-label="Close panel"
                          className="text-gray-200 transition duration-150 ease-in-out hover:text-white"
                          onClick={() => onClose()}
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                    {subText && (
                      <div>
                        <p className="font-semibold leading-5 text-gray-300">
                          {subText}
                        </p>
                      </div>
                    )}
                  </header>
                  <div className="hide-scrollbar flex flex-1 flex-col overflow-y-auto">
                    <div className="flex-1 px-4 py-6 text-white">
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </Transition.Child>
          </section>
        </div>
      </div>
    </Transition>,
    document.body
  );
};

export default SlideOver;

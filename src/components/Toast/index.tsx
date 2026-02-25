import { Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Fragment } from 'react';
import type { ToastProps } from 'react-toast-notifications';

const Toast = ({
  appearance,
  children,
  onDismiss,
  transitionState,
}: ToastProps) => {
  return (
    <div className="toast pointer-events-none flex max-w-full items-end justify-center px-2 py-2 sm:items-start sm:justify-end">
      <Transition
        as={Fragment}
        show={transitionState === 'entered'}
        enter="transition duration-300 transform-gpu"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition duration-150 transform-gpu"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-90"
      >
        <div className="pointer-events-auto w-full max-w-sm rounded-lg bg-gray-800 shadow-lg ring-1 ring-gray-500">
          <div className="ring-opacity-5 overflow-hidden rounded-lg ring-1 ring-black">
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {appearance === 'success' && (
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                  )}
                  {appearance === 'error' && (
                    <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
                  )}
                  {appearance === 'info' && (
                    <InformationCircleIcon className="h-6 w-6 text-indigo-500" />
                  )}
                  {appearance === 'warning' && (
                    <ExclamationTriangleIcon className="h-6 w-6 text-orange-400" />
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 text-white">{children}</div>
                <div className="ml-4 flex flex-shrink-0">
                  <button
                    onClick={() => onDismiss()}
                    className="inline-flex text-gray-400 transition duration-150 ease-in-out focus:text-gray-500 focus:outline-hidden"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  );
};

export default Toast;

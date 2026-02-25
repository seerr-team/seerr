import type { ButtonType } from '@app/components/Common/Button';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import useClickOutside from '@app/hooks/useClickOutside';
import { useLockBodyScroll } from '@app/hooks/useLockBodyScroll';
import globalMessages from '@app/i18n/globalMessages';
import { Transition } from '@headlessui/react';
import type { MouseEvent } from 'react';
import React, { Fragment, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useIntl } from 'react-intl';

interface ModalProps {
  title?: string;
  subTitle?: string;
  onCancel?: (e?: MouseEvent<HTMLElement>) => void;
  onOk?: (e?: MouseEvent<HTMLButtonElement>) => void;
  onSecondary?: (e?: MouseEvent<HTMLButtonElement>) => void;
  onTertiary?: (e?: MouseEvent<HTMLButtonElement>) => void;
  cancelText?: string;
  okText?: string;
  secondaryText?: string;
  tertiaryText?: string;
  okDisabled?: boolean;
  cancelButtonType?: ButtonType;
  okButtonType?: ButtonType;
  secondaryButtonType?: ButtonType;
  secondaryDisabled?: boolean;
  tertiaryDisabled?: boolean;
  tertiaryButtonType?: ButtonType;
  okButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  cancelButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  secondaryButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  tertiaryButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  disableScrollLock?: boolean;
  backgroundClickable?: boolean;
  loading?: boolean;
  backdrop?: string;
  children?: React.ReactNode;
  dialogClass?: string;
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      title,
      subTitle,
      onCancel,
      onOk,
      cancelText,
      okText,
      okDisabled = false,
      cancelButtonType = 'default',
      okButtonType = 'primary',
      children,
      disableScrollLock,
      backgroundClickable = true,
      secondaryButtonType = 'default',
      secondaryDisabled = false,
      onSecondary,
      secondaryText,
      tertiaryButtonType = 'default',
      tertiaryDisabled = false,
      tertiaryText,
      loading = false,
      onTertiary,
      backdrop,
      dialogClass,
      okButtonProps,
      cancelButtonProps,
      secondaryButtonProps,
      tertiaryButtonProps,
    },
    parentRef
  ) => {
    const intl = useIntl();
    const modalRef = useRef<HTMLDivElement>(null);
    const backgroundClickableRef = useRef(backgroundClickable); // This ref is used to detect state change inside the useClickOutside hook
    useEffect(() => {
      backgroundClickableRef.current = backgroundClickable;
    }, [backgroundClickable]);
    useClickOutside(modalRef, () => {
      if (onCancel && backgroundClickableRef.current) {
        onCancel();
      }
    });
    useLockBodyScroll(true, disableScrollLock);

    return ReactDOM.createPortal(
      <Transition.Child
        appear
        as="div"
        className="fixed top-0 right-0 bottom-0 left-0 z-50 flex h-full w-full items-center justify-center bg-gray-800/70"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        ref={parentRef}
      >
        <Transition
          appear
          as={Fragment}
          enter="transition duration-300"
          enterFrom="opacity-0 scale-75"
          enterTo="opacity-100 scale-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          show={loading}
        >
          <div style={{ position: 'absolute' }}>
            <LoadingSpinner />
          </div>
        </Transition>
        <Transition
          className={`hide-scrollbar relative inline-block w-full overflow-auto bg-gray-800 px-4 pt-4 pb-4 text-left align-bottom shadow-xl ring-1 ring-gray-700 transition-all sm:my-8 sm:max-w-3xl sm:rounded-lg sm:align-middle ${dialogClass}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-headline"
          style={{
            maxHeight: 'calc(100% - env(safe-area-inset-top) * 2)',
          }}
          appear
          as="div"
          enter="transition duration-300"
          enterFrom="opacity-0 scale-75"
          enterTo="opacity-100 scale-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          show={!loading}
          ref={modalRef}
        >
          {backdrop && (
            <div className="absolute top-0 right-0 left-0 z-0 h-64 max-h-full w-full">
              <CachedImage
                type="tmdb"
                alt=""
                src={backdrop}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                fill
                priority
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(180deg, rgba(31, 41, 55, 0.75) 0%, rgba(31, 41, 55, 1) 100%)',
                }}
              />
            </div>
          )}
          <div className="relative -mx-4 overflow-x-hidden px-4 pt-0.5 sm:flex sm:items-center">
            <div
              className={`mt-3 truncate text-center text-white sm:mt-0 sm:text-left`}
            >
              {(title || subTitle) && (
                <div className="flex flex-col space-y-1">
                  {title && (
                    <span
                      className="text-overseerr truncate pb-0.5 text-2xl leading-6 font-bold"
                      id="modal-headline"
                      data-testid="modal-title"
                    >
                      {title}
                    </span>
                  )}
                  {subTitle && (
                    <span
                      className="truncate text-lg leading-6 font-semibold text-gray-200"
                      id="modal-headline"
                      data-testid="modal-title"
                    >
                      {subTitle}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {children && (
            <div
              className={`relative mt-4 text-sm leading-5 text-gray-300 ${
                !(onCancel || onOk || onSecondary || onTertiary) ? 'mb-3' : ''
              }`}
            >
              {children}
            </div>
          )}
          {(onCancel || onOk || onSecondary || onTertiary) && (
            <div className="relative mt-5 flex flex-row-reverse justify-center sm:mt-4 sm:justify-start">
              {typeof onOk === 'function' && (
                <Button
                  buttonType={okButtonType}
                  onClick={onOk}
                  className="ml-3"
                  disabled={okDisabled}
                  data-testid="modal-ok-button"
                  {...okButtonProps}
                >
                  {okText ? okText : 'Ok'}
                </Button>
              )}
              {typeof onSecondary === 'function' && secondaryText && (
                <Button
                  buttonType={secondaryButtonType}
                  onClick={onSecondary}
                  className="ml-3"
                  disabled={secondaryDisabled}
                  data-testid="modal-secondary-button"
                  {...secondaryButtonProps}
                >
                  {secondaryText}
                </Button>
              )}
              {typeof onTertiary === 'function' && tertiaryText && (
                <Button
                  buttonType={tertiaryButtonType}
                  onClick={onTertiary}
                  className="ml-3"
                  disabled={tertiaryDisabled}
                  {...tertiaryButtonProps}
                >
                  {tertiaryText}
                </Button>
              )}
              {typeof onCancel === 'function' && (
                <Button
                  buttonType={cancelButtonType}
                  onClick={onCancel}
                  className="ml-3 sm:ml-0"
                  data-testid="modal-cancel-button"
                  {...cancelButtonProps}
                >
                  {cancelText
                    ? cancelText
                    : intl.formatMessage(globalMessages.cancel)}
                </Button>
              )}
            </div>
          )}
        </Transition>
      </Transition.Child>,
      document.body
    );
  }
);

Modal.displayName = 'Modal';

export default Modal;

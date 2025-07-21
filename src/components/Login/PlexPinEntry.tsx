import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import { LockClosedIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Login.PlexPinEntry', {
  pinRequired: 'PIN Required',
  pinDescription: 'Enter the PIN for this profile',
  submit: 'Submit',
  cancel: 'Cancel',
  invalidPin: 'Invalid PIN. Please try again.',
  pinCheck: 'Checking PIN...',
  accessDenied: 'Access denied.',
});

interface PlexPinEntryProps {
  profileId: string;
  profileName: string;
  profileThumb?: string | null;
  isProtected?: boolean;
  isMainUser?: boolean;
  error?: string | null;
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
}

const PlexPinEntry = ({
  profileName,
  profileThumb,
  isProtected,
  isMainUser,
  error,
  onSubmit,
  onCancel,
}: PlexPinEntryProps) => {
  const intl = useIntl();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (pinToSubmit?: string) => {
    const pinValue = pinToSubmit || pin;
    if (!pinValue || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(pinValue);
      setPin('');
    } catch (err) {
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin && !isSubmitting) {
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setPin(value);
    if (value.length === 4 && !isSubmitting) {
      handleSubmit(value);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // PIN boxes rendering
  const pinDigits = pin.split('').slice(0, 4);
  const boxes = Array.from({ length: 4 }, (_, i) => (
    <div
      key={i}
      className={`mx-2 flex h-12 w-12 items-center justify-center rounded-lg border-2 font-mono text-2xl transition-all
        ${
          i === pin.length
            ? 'border-indigo-500 ring-2 ring-indigo-500'
            : 'border-white/30'
        }
        ${pinDigits[i] ? 'text-white' : 'text-white/40'}`}
      aria-label={pinDigits[i] ? 'Entered' : 'Empty'}
    >
      {pinDigits[i] ? '•' : ''}
    </div>
  ));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur">
      <div className="flex w-full flex-col items-center">
        {/* Avatar */}
        <div className="relative mx-auto mb-1 flex h-20 w-20 shrink-0 grow-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 shadow ring-2 ring-indigo-400">
          {profileThumb ? (
            <Image
              src={profileThumb}
              alt={profileName}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700 text-3xl font-bold text-white">
              {profileName?.[0] || '?'}
            </span>
          )}
        </div>
        {/* Icons */}
        <div className="mb-1 flex items-center justify-center gap-2">
          {isProtected && (
            <span className="z-10 rounded-full bg-black/80 p-1.5">
              <LockClosedIcon className="h-4 w-4 text-indigo-400" />
            </span>
          )}
          {isMainUser && (
            <span className="z-10 rounded-full bg-black/80 p-1.5">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-yellow-400"
              >
                <path d="M2.166 6.5l3.5 7 4.334-7 4.334 7 3.5-7L17.5 17.5h-15z" />
              </svg>
            </span>
          )}
        </div>
        <p className="mb-3 text-center text-base font-semibold text-white">
          {profileName}
        </p>
        <h2 className="mb-3 text-center text-xl font-bold text-white">
          {intl.formatMessage(messages.pinRequired)}
        </h2>
        <p className="mb-4 text-center text-sm text-gray-200">
          {intl.formatMessage(messages.pinDescription)}
        </p>
        <div className="mb-4 flex flex-row items-center justify-center">
          {boxes}
          {/* Visually hidden input for keyboard entry */}
          <input
            ref={inputRef}
            type="password"
            className="absolute opacity-0"
            value={pin}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            maxLength={4}
            pattern="[0-9]{4}"
            inputMode="numeric"
            aria-label="PIN Input"
          />
        </div>
        {error && (
          <div
            className="mb-4 text-center font-medium text-red-400"
            aria-live="polite"
          >
            {error}
          </div>
        )}
        <div className="flex w-full justify-between">
          <Button
            buttonType="default"
            onClick={onCancel}
            className="mr-2 flex-1"
          >
            {intl.formatMessage(messages.cancel)}
          </Button>
          <Button
            buttonType="primary"
            disabled={!pin || isSubmitting}
            onClick={() => handleSubmit()}
            className="ml-2 flex-1"
          >
            {isSubmitting
              ? intl.formatMessage(messages.pinCheck)
              : intl.formatMessage(messages.submit)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlexPinEntry;

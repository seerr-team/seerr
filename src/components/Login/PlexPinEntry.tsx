import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import { ApiErrorCode } from '@server/constants/error';
import { useEffect, useState } from 'react';
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
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
  error?: string | null;
}

const PlexPinEntry = ({
  profileName,
  onSubmit,
  onCancel,
  error: externalError,
}: PlexPinEntryProps) => {
  const intl = useIntl();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const displayError = externalError || internalError;

  useEffect(() => {
    if (externalError) {
      setInternalError(null);
    }
  }, [externalError]);

  const handleSubmit = async () => {
    if (!pin || isSubmitting) return;

    setIsSubmitting(true);
    setInternalError(null);

    try {
      await onSubmit(pin);
    } catch (err: any) {
      const code = err?.response?.data?.error as string | undefined;
      const httpStatus = err?.response?.status;

      let msg: string;
      switch (code) {
        case ApiErrorCode.InvalidPin:
          msg = intl.formatMessage(messages.invalidPin);
          break;
        case ApiErrorCode.NewPlexLoginDisabled:
          msg = intl.formatMessage(messages.accessDenied);
          break;
        default:
          if (httpStatus === 401) {
            msg = intl.formatMessage(messages.invalidPin);
          } else if (httpStatus === 403) {
            msg = intl.formatMessage(messages.accessDenied);
          } else {
            msg =
              err?.response?.data?.message ??
              intl.formatMessage(messages.invalidPin);
          }
      }

      setInternalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin && !isSubmitting) {
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="mb-6 text-center text-xl font-bold text-gray-100">
        {intl.formatMessage(messages.pinRequired)}
      </h2>
      <p className="mb-6 text-center text-sm text-gray-300">
        {intl.formatMessage(messages.pinDescription)}{' '}
        <strong>{profileName}</strong>
      </p>

      {displayError && (
        <div
          className="mb-4 rounded-md bg-red-500/90 p-3 text-center text-sm font-medium text-white shadow-md transition-all duration-300"
          role="alert"
          aria-live="polite"
        >
          {displayError}
        </div>
      )}

      <div className="mb-6">
        <input
          type="password"
          className="w-full rounded-md bg-white/10 px-4 py-3 text-center font-mono text-3xl tracking-[0.3em] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="• • • •"
          maxLength={4}
          autoFocus
          pattern="[0-9]{4}"
          inputMode="numeric"
        />
      </div>

      <div className="flex justify-between">
        <Button buttonType="default" onClick={onCancel} className="mr-2 flex-1">
          {intl.formatMessage(messages.cancel)}
        </Button>
        <Button
          buttonType="primary"
          disabled={!pin || isSubmitting}
          onClick={handleSubmit}
          className="ml-2 flex-1"
        >
          {isSubmitting
            ? intl.formatMessage(messages.pinCheck)
            : intl.formatMessage(messages.submit)}
        </Button>
      </div>
    </div>
  );
};

export default PlexPinEntry;

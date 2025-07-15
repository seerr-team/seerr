import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
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
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
  error?: string | null;
}

const PlexPinEntry = ({
  profileName,
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

  return (
    <div className="w-full max-w-md">
      <h2 className="mb-6 text-center text-xl font-bold text-gray-100">
        {intl.formatMessage(messages.pinRequired)}
      </h2>
      <p className="mb-6 text-center text-sm text-gray-300">
        {intl.formatMessage(messages.pinDescription)}{' '}
        <strong>{profileName}</strong>
      </p>

      <div className="mb-6">
        <input
          ref={inputRef}
          type="password"
          className="w-full rounded-md bg-white/10 px-4 py-3 text-center font-mono text-3xl tracking-[0.3em] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={pin}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="• • • •"
          maxLength={4}
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
          onClick={() => handleSubmit()}
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

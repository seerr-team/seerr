import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import CopyButton from '@app/components/Settings/CopyButton';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserApiKey',
  {
    apiKey: 'API Key',
    generate: 'Generate',
    regenerate: 'Regenerate',
    revoke: 'Revoke',
    copyNow: 'Copy this key now. It will not be shown again.',
    copied: 'API key copied to clipboard.',
  }
);

const UserApiKey = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { user } = useUser();
  const url = `/api/v1/user/${user?.id}/settings/api-key`;
  const { data, error, mutate } = useSWR<{ hasApiKey: boolean }>(
    user ? url : null
  );
  const [apiKey, setApiKey] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (method: 'post' | 'delete') => {
    setIsSubmitting(true);
    try {
      const res = await axios.request<{ apiKey?: string }>({ method, url });
      setApiKey(res.data?.apiKey);
      mutate();
    } catch {
      addToast(intl.formatMessage(globalMessages.error), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.apiKey),
          intl.formatMessage(globalMessages.usersettings),
          user?.displayName,
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.apiKey)}</h3>
      </div>
      <div className="section max-w-xl">
        {apiKey && (
          <>
            <div className="form-input-field">
              <SensitiveInput
                type="text"
                aria-label={intl.formatMessage(messages.apiKey)}
                className="rounded-l-only"
                value={apiKey}
                readOnly
              />
              <CopyButton
                textToCopy={apiKey}
                toastMessage={intl.formatMessage(messages.copied)}
                key={apiKey}
              />
            </div>
            <p className="mb-4 mt-2 text-sm text-gray-400">
              {intl.formatMessage(messages.copyNow)}
            </p>
          </>
        )}
        <div className="flex gap-2">
          <Button
            buttonType={data.hasApiKey ? 'warning' : 'primary'}
            onClick={() => submit('post')}
            disabled={isSubmitting}
          >
            {intl.formatMessage(
              data.hasApiKey ? messages.regenerate : messages.generate
            )}
          </Button>
          {data.hasApiKey && (
            <Button
              buttonType="danger"
              onClick={() => submit('delete')}
              disabled={isSubmitting}
            >
              {intl.formatMessage(messages.revoke)}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default UserApiKey;

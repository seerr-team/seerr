import Alert from '@app/components/Common/Alert';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { TraktPublicSettings } from '@server/interfaces/api/traktInterfaces';
import { useIntl } from 'react-intl';
import useSWR, { mutate as globalMutate } from 'swr';
import TraktApplicationForm from './TraktApplicationForm';
import TraktConnectionList from './TraktConnectionList';

const messages = defineMessages('components.Settings.SettingsTrakt', {
  trakt: 'Trakt',
  loadFailed: 'Trakt settings could not be loaded.',
});

const SettingsTrakt = () => {
  const intl = useIntl();
  const {
    data: settings,
    error,
    mutate,
  } = useSWR<TraktPublicSettings>('/api/v1/settings/trakt');

  if (!settings && !error) {
    return <LoadingSpinner />;
  }

  if (!settings) {
    return (
      <Alert title={intl.formatMessage(messages.loadFailed)} type="error" />
    );
  }

  const applicationConfigured =
    settings.clientId.trim().length > 0 && settings.clientSecretConfigured;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.trakt),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <TraktApplicationForm
        settings={settings}
        onSaved={(nextSettings) =>
          Promise.all([
            mutate(nextSettings, false),
            globalMutate('/api/v1/settings/trakt/connections'),
          ])
        }
      />
      <TraktConnectionList applicationConfigured={applicationConfigured} />
    </>
  );
};

export default SettingsTrakt;

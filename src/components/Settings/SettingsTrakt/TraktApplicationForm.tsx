import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import CopyButton from '@app/components/Settings/CopyButton';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type {
  TraktPublicSettings,
  TraktSettingsUpdate,
} from '@server/interfaces/api/traktInterfaces';
import axios from 'axios';
import type { FormikHelpers } from 'formik';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.Settings.SettingsTrakt.TraktApplicationForm',
  {
    title: 'Trakt application',
    description:
      'Configure the Trakt OAuth application used by household accounts.',
    clientId: 'Client ID',
    clientSecret: 'Client secret',
    secretConfigured: 'Client secret configured',
    secretNotConfigured: 'Client secret not configured',
    secretHint: 'Leave blank to keep the saved client secret.',
    callbackUrl: 'Callback URL',
    callbackCopied: 'Callback URL copied.',
    copyCallback: 'Copy Trakt callback URL',
    callbackUnavailable:
      'Set the Application URL in General settings to generate the callback URL',
    secretVisibility: 'Show or hide client secret',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Trakt settings saved.',
    saveFailed: 'Trakt settings could not be saved.',
    reconnectTitle: 'Reconnect all Trakt users?',
    reconnectWarning:
      'All connected users will need to reconnect because the Trakt client ID is changing.',
    confirmReconnect: 'Save and require reconnect',
  }
);

interface FormValues {
  clientId: string;
  clientSecret: string;
  confirmReconnectAll: boolean;
}

interface PendingConfirmation {
  values: FormValues;
  helpers: FormikHelpers<FormValues>;
}

interface TraktApplicationFormProps {
  settings: TraktPublicSettings;
  onSaved: (settings: TraktPublicSettings) => void | Promise<unknown>;
}

const TraktApplicationForm = ({
  settings,
  onSaved,
}: TraktApplicationFormProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [confirmationSaving, setConfirmationSaving] = useState(false);

  const save = async (
    values: FormValues,
    helpers: FormikHelpers<FormValues>,
    confirmReconnectAll: boolean
  ) => {
    const body: TraktSettingsUpdate = {
      clientId: values.clientId.trim(),
      confirmReconnectAll,
    };
    if (values.clientSecret.length > 0) {
      body.clientSecret = values.clientSecret;
    }

    try {
      const { data } = await axios.put<TraktPublicSettings>(
        '/api/v1/settings/trakt',
        body
      );
      await onSaved(data);
      helpers.resetForm({
        values: {
          clientId: data.clientId,
          clientSecret: '',
          confirmReconnectAll: false,
        },
      });
      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      addToast(intl.formatMessage(messages.saveFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      helpers.setSubmitting(false);
    }
  };

  return (
    <div className="section">
      <Transition
        appear
        show={pendingConfirmation !== null}
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Modal
          title={intl.formatMessage(messages.reconnectTitle)}
          onCancel={() => setPendingConfirmation(null)}
          onOk={() => {
            if (!pendingConfirmation) return;
            setConfirmationSaving(true);
            void save(
              pendingConfirmation.values,
              pendingConfirmation.helpers,
              true
            ).finally(() => {
              setConfirmationSaving(false);
              setPendingConfirmation(null);
            });
          }}
          okText={intl.formatMessage(messages.confirmReconnect)}
          okButtonType="warning"
          okDisabled={confirmationSaving}
          backgroundClickable={false}
        >
          <Alert title={intl.formatMessage(messages.reconnectWarning)} />
        </Modal>
      </Transition>

      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
        <p className="description">
          {intl.formatMessage(messages.description)}
        </p>
      </div>
      <Formik<FormValues>
        initialValues={{
          clientId: settings.clientId,
          clientSecret: '',
          confirmReconnectAll: false,
        }}
        enableReinitialize
        onSubmit={(values, helpers) => {
          const clientIdChanged =
            settings.clientId.trim().length > 0 &&
            values.clientId.trim() !== settings.clientId.trim();
          if (clientIdChanged) {
            helpers.setSubmitting(false);
            setPendingConfirmation({ values: { ...values }, helpers });
            return;
          }
          void save(values, helpers, false);
        }}
      >
        {({ isSubmitting }) => (
          <Form data-testid="trakt-application-form">
            <div className="form-row">
              <label htmlFor="trakt-client-id" className="text-label">
                {intl.formatMessage(messages.clientId)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="trakt-client-id"
                    name="clientId"
                    type="text"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="trakt-client-secret" className="text-label">
                {intl.formatMessage(messages.clientSecret)}
                <span className="label-tip">
                  {intl.formatMessage(messages.secretHint)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <SensitiveInput
                    as="field"
                    id="trakt-client-secret"
                    name="clientSecret"
                    type="password"
                    visibilityToggleLabel={intl.formatMessage(
                      messages.secretVisibility
                    )}
                  />
                </div>
                <div className="mt-2">
                  <span
                    className={
                      settings.clientSecretConfigured
                        ? 'text-sm text-green-400'
                        : 'text-sm text-yellow-300'
                    }
                  >
                    {intl.formatMessage(
                      settings.clientSecretConfigured
                        ? messages.secretConfigured
                        : messages.secretNotConfigured
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="trakt-callback-url" className="text-label">
                {intl.formatMessage(messages.callbackUrl)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <input
                    id="trakt-callback-url"
                    type="text"
                    value={settings.callbackUrl ?? ''}
                    readOnly
                  />
                  {settings.callbackUrl && (
                    <CopyButton
                      textToCopy={settings.callbackUrl}
                      toastMessage={intl.formatMessage(messages.callbackCopied)}
                      ariaLabel={intl.formatMessage(messages.copyCallback)}
                    />
                  )}
                </div>
                {!settings.callbackUrl && (
                  <span className="label-tip">
                    {intl.formatMessage(messages.callbackUnavailable)}
                  </span>
                )}
              </div>
            </div>
            <div className="actions">
              <div className="flex justify-end">
                <Button
                  buttonType="primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  <ArrowDownOnSquareIcon />
                  <span>
                    {intl.formatMessage(
                      isSubmitting ? messages.saving : messages.save
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default TraktApplicationForm;

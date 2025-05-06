import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsWebPush',
  {
    agentenabled: 'Enable Agent',
    webpushsettingssaved: 'Web push notification settings saved successfully!',
    webpushsettingsfailed: 'Web push notification settings failed to save.',
    toastWebPushTestSending: 'Sending web push test notification…',
    toastWebPushTestSuccess: 'Web push test notification sent!',
    toastWebPushTestFailed: 'Web push test notification failed to send.',
    httpsRequirement:
      'In order to receive web push notifications, Jellyseerr must be served over HTTPS.',
  }
);

const NotificationsWebPush = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const [isHttps, setIsHttps] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/webpush');

  useEffect(() => {
    setIsHttps(window.location.protocol.startsWith('https'));
  }, []);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <>
      {!isHttps && (
        <Alert
          title={intl.formatMessage(messages.httpsRequirement)}
          type="warning"
        />
      )}
      <Formik
        initialValues={{
          enabled: data.enabled,
        }}
        onSubmit={async (values) => {
          try {
            await axios.post('/api/v1/settings/notifications/webpush', {
              enabled: values.enabled,
              options: {},
            });
            mutate('/api/v1/settings/public');
            addToast(intl.formatMessage(messages.webpushsettingssaved), {
              appearance: 'success',
              autoDismiss: true,
            });
          } catch (e) {
            addToast(intl.formatMessage(messages.webpushsettingsfailed), {
              appearance: 'error',
              autoDismiss: true,
            });
          } finally {
            revalidate();
          }
        }}
      >
        {({ isSubmitting }) => {
          const testSettings = async () => {
            setIsTesting(true);
            let toastId: string | undefined;
            try {
              addToast(
                intl.formatMessage(messages.toastWebPushTestSending),
                {
                  autoDismiss: false,
                  appearance: 'info',
                },
                (id) => {
                  toastId = id;
                }
              );
              await axios.post('/api/v1/settings/notifications/webpush/test', {
                enabled: true,
                options: {},
              });

              if (toastId) {
                removeToast(toastId);
              }
              addToast(intl.formatMessage(messages.toastWebPushTestSuccess), {
                autoDismiss: true,
                appearance: 'success',
              });
            } catch (e) {
              if (toastId) {
                removeToast(toastId);
              }
              addToast(intl.formatMessage(messages.toastWebPushTestFailed), {
                autoDismiss: true,
                appearance: 'error',
              });
            } finally {
              setIsTesting(false);
            }
          };

          return (
            <Form className="section">
              <div className="form-row">
                <label htmlFor="enabled" className="checkbox-label">
                  {intl.formatMessage(messages.agentenabled)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <Field type="checkbox" id="enabled" name="enabled" />
                </div>
              </div>
              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="warning"
                      disabled={isSubmitting || isTesting}
                      onClick={(e) => {
                        e.preventDefault();
                        testSettings();
                      }}
                    >
                      <BeakerIcon />
                      <span>
                        {isTesting
                          ? intl.formatMessage(globalMessages.testing)
                          : intl.formatMessage(globalMessages.test)}
                      </span>
                    </Button>
                  </span>
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isSubmitting || isTesting}
                    >
                      <ArrowDownOnSquareIcon />
                      <span>
                        {isSubmitting
                          ? intl.formatMessage(globalMessages.saving)
                          : intl.formatMessage(globalMessages.save)}
                      </span>
                    </Button>
                  </span>
                </div>
              </div>
            </Form>
          );
        }}
      </Formik>
    </>
  );
};

export default NotificationsWebPush;

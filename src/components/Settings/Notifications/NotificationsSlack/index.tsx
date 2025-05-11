import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsSlack',
  {
    agentenabled: 'Enable Agent',
    embedImage: 'Embed Image',
    webhookUrl: 'Webhook URL',
    webhookUrlTip:
      'Create an <WebhookLink>Incoming Webhook</WebhookLink> integration',
    slacksettingssaved: 'Slack notification settings saved successfully!',
    slacksettingsfailed: 'Slack notification settings failed to save.',
    toastSlackTestSending: 'Sending Slack test notification…',
    toastSlackTestSuccess: 'Slack test notification sent!',
    toastSlackTestFailed: 'Slack test notification failed to send.',
    validationWebhookUrl: 'You must provide a valid URL',
    validationTypes: 'You must select at least one notification type',
  }
);

const NotificationsSlack = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/slack');

  const NotificationsSlackSchema = Yup.object().shape({
    webhookUrl: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationWebhookUrl)),
        otherwise: Yup.string().nullable(),
      })
      .url(intl.formatMessage(messages.validationWebhookUrl)),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        enabled: data.enabled,
        embedImage: data.embedImage,
        types: data.types,
        webhookUrl: data.options.webhookUrl,
      }}
      validationSchema={NotificationsSlackSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/slack', {
            enabled: values.enabled,
            embedImage: values.embedImage,
            types: values.types,
            options: {
              webhookUrl: values.webhookUrl,
            },
          });
          addToast(intl.formatMessage(messages.slacksettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.slacksettingsfailed), {
            appearance: 'error',
            autoDismiss: true,
          });
        } finally {
          revalidate();
        }
      }}
    >
      {({
        errors,
        touched,
        isSubmitting,
        values,
        isValid,
        setFieldValue,
        setFieldTouched,
      }) => {
        const testSettings = async () => {
          setIsTesting(true);
          let toastId: string | undefined;
          try {
            addToast(
              intl.formatMessage(messages.toastSlackTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/slack/test', {
              enabled: true,
              embedImage: values.embedImage,
              types: values.types,
              options: {
                webhookUrl: values.webhookUrl,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastSlackTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastSlackTestFailed), {
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
              <label htmlFor="isDefault" className="checkbox-label">
                {intl.formatMessage(messages.agentenabled)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <Field type="checkbox" id="enabled" name="enabled" />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="embedImage" className="checkbox-label">
                {intl.formatMessage(messages.embedImage)}
              </label>
              <div className="form-input-area">
                <Field type="checkbox" id="embedImage" name="embedImage" />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="name" className="text-label">
                {intl.formatMessage(messages.webhookUrl)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.webhookUrlTip, {
                    WebhookLink: (msg: React.ReactNode) => (
                      <a
                        href="https://my.slack.com/services/new/incoming-webhook/"
                        className="text-white transition duration-300 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {msg}
                      </a>
                    ),
                  })}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="webhookUrl"
                    name="webhookUrl"
                    type="text"
                    inputMode="url"
                  />
                </div>
                {errors.webhookUrl &&
                  touched.webhookUrl &&
                  typeof errors.webhookUrl === 'string' && (
                    <div className="error">{errors.webhookUrl}</div>
                  )}
              </div>
            </div>
            <NotificationTypeSelector
              currentTypes={values.enabled ? values.types : 0}
              onUpdate={(newTypes) => {
                setFieldValue('types', newTypes);
                setFieldTouched('types');

                if (newTypes) {
                  setFieldValue('enabled', true);
                }
              }}
              error={
                values.enabled && !values.types && touched.types
                  ? intl.formatMessage(messages.validationTypes)
                  : undefined
              }
            />
            <div className="actions">
              <div className="flex justify-end">
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="warning"
                    disabled={isSubmitting || !isValid || isTesting}
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
                    disabled={
                      isSubmitting ||
                      !isValid ||
                      isTesting ||
                      (values.enabled && !values.types)
                    }
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
  );
};

export default NotificationsSlack;

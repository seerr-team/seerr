import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import SettingsBadge from '@app/components/Settings/SettingsBadge';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import {
  ArrowPathIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/solid';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const JSONEditor = dynamic(() => import('@app/components/JSONEditor'), {
  ssr: false,
});

const defaultPayload = {
  notification_type: '{{notification_type}}',
  event: '{{event}}',
  subject: '{{subject}}',
  message: '{{message}}',
  image: '{{image}}',
  '{{media}}': {
    media_type: '{{media_type}}',
    tmdbId: '{{media_tmdbid}}',
    tvdbId: '{{media_tvdbid}}',
    status: '{{media_status}}',
    status4k: '{{media_status4k}}',
  },
  '{{request}}': {
    request_id: '{{request_id}}',
    requestedBy_email: '{{requestedBy_email}}',
    requestedBy_username: '{{requestedBy_username}}',
    requestedBy_avatar: '{{requestedBy_avatar}}',
    requestedBy_settings_discordId: '{{requestedBy_settings_discordId}}',
    requestedBy_settings_telegramChatId:
      '{{requestedBy_settings_telegramChatId}}',
  },
  '{{issue}}': {
    issue_id: '{{issue_id}}',
    issue_type: '{{issue_type}}',
    issue_status: '{{issue_status}}',
    reportedBy_email: '{{reportedBy_email}}',
    reportedBy_username: '{{reportedBy_username}}',
    reportedBy_avatar: '{{reportedBy_avatar}}',
    reportedBy_settings_discordId: '{{reportedBy_settings_discordId}}',
    reportedBy_settings_telegramChatId:
      '{{reportedBy_settings_telegramChatId}}',
  },
  '{{comment}}': {
    comment_message: '{{comment_message}}',
    commentedBy_email: '{{commentedBy_email}}',
    commentedBy_username: '{{commentedBy_username}}',
    commentedBy_avatar: '{{commentedBy_avatar}}',
    commentedBy_settings_discordId: '{{commentedBy_settings_discordId}}',
    commentedBy_settings_telegramChatId:
      '{{commentedBy_settings_telegramChatId}}',
  },
  '{{extra}}': [],
};

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsWebhook',
  {
    agentenabled: 'Enable Agent',
    webhookUrl: 'Webhook URL',
    webhookUrlTip:
      'Test Notification URL is set to {testUrl} instead of the actual webhook URL.',
    supportPlaceholders: 'Support URL Placeholders',
    supportPlaceholdersTip: 'Available Placeholders: {placeholders}',
    authheader: 'Authorization Header',
    validationJsonPayloadRequired: 'You must provide a valid JSON payload',
    webhooksettingssaved: 'Webhook notification settings saved successfully!',
    webhooksettingsfailed: 'Webhook notification settings failed to save.',
    toastWebhookTestSending: 'Sending webhook test notification…',
    toastWebhookTestSuccess: 'Webhook test notification sent!',
    toastWebhookTestFailed: 'Webhook test notification failed to send.',
    resetPayload: 'Reset to Default',
    resetPayloadSuccess: 'JSON payload reset successfully!',
    customJson: 'JSON Payload',
    templatevariablehelp: 'Template Variable Help',
    validationWebhookUrl: 'You must provide a valid URL',
    validationTypes: 'You must select at least one notification type',
  }
);

const NotificationsWebhook = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const placeholders = ['{{requestedBy_username}}'];
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/webhook');

  const NotificationsWebhookSchema = Yup.object().shape({
    webhookUrl: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationWebhookUrl)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.validationWebhookUrl),
        function (value) {
          const { supportPlaceholders } = this.parent;

          // allow placeholder syntax through
          if (
            supportPlaceholders &&
            typeof value === 'string' &&
            value.includes('{{')
          ) {
            return true;
          }

          // otherwise fall back to the built‑in URL check
          return isValidURL(value);
        }
      ),

    supportPlaceholders: Yup.boolean(),

    jsonPayload: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationJsonPayloadRequired)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'validate-json',
        intl.formatMessage(messages.validationJsonPayloadRequired),
        (value) => {
          try {
            JSON.parse(value ?? '');
            return true;
          } catch (e) {
            return false;
          }
        }
      ),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        enabled: data.enabled,
        types: data.types,
        webhookUrl: data.options.webhookUrl,
        jsonPayload: data.options.jsonPayload,
        authHeader: data.options.authHeader,
        supportPlaceholders: data.options.supportPlaceholders ?? false,
      }}
      validationSchema={NotificationsWebhookSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/webhook', {
            enabled: values.enabled,
            types: values.types,
            options: {
              webhookUrl: values.webhookUrl,
              jsonPayload: JSON.stringify(values.jsonPayload),
              authHeader: values.authHeader,
              supportPlaceholders: values.supportPlaceholders,
            },
          });
          addToast(intl.formatMessage(messages.webhooksettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.webhooksettingsfailed), {
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
        const resetPayload = () => {
          setFieldValue(
            'jsonPayload',
            JSON.stringify(defaultPayload, undefined, '    ')
          );
          addToast(intl.formatMessage(messages.resetPayloadSuccess), {
            appearance: 'info',
            autoDismiss: true,
          });
        };

        const testSettings = async () => {
          setIsTesting(true);
          let toastId: string | undefined;
          try {
            addToast(
              intl.formatMessage(messages.toastWebhookTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/webhook/test', {
              enabled: true,
              types: values.types,
              options: {
                webhookUrl: values.webhookUrl,
                jsonPayload: JSON.stringify(values.jsonPayload),
                authHeader: values.authHeader,
                supportPlaceholders: values.supportPlaceholders ?? false,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastWebhookTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastWebhookTestFailed), {
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
            <div className="form-row">
              <label htmlFor="supportPlaceholders" className="checkbox-label">
                <span className="mr-2">
                  {intl.formatMessage(messages.supportPlaceholders)}
                </span>
                <SettingsBadge badgeType="experimental" />
                <span className="label-tip">
                  <FormattedMessage
                    {...messages.supportPlaceholdersTip}
                    values={{
                      placeholders: (
                        <ul className="ml-4 list-disc">
                          {placeholders.map((placeholder, index) => (
                            <li key={index}>
                              <code className="bg-opacity-50">
                                {placeholder}
                              </code>
                            </li>
                          ))}
                        </ul>
                      ),
                    }}
                  />
                </span>
              </label>
              <div className="form-input-area">
                <Field
                  type="checkbox"
                  id="supportPlaceholders"
                  name="supportPlaceholders"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFieldValue('supportPlaceholders', e.target.checked)
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="webhookUrl" className="text-label">
                {intl.formatMessage(messages.webhookUrl)}
                <span className="label-required">*</span>
                {values.supportPlaceholders && (
                  <div className="label-tip">
                    {intl.formatMessage(messages.webhookUrlTip, {
                      testUrl: '/test',
                    })}
                  </div>
                )}
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
            <div className="form-row">
              <label htmlFor="authHeader" className="text-label">
                {intl.formatMessage(messages.authheader)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field id="authHeader" name="authHeader" type="text" />
                </div>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="webhook-json-payload" className="text-label">
                {intl.formatMessage(messages.customJson)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <JSONEditor
                    name="webhook-json-payload"
                    onUpdate={(value) => setFieldValue('jsonPayload', value)}
                    value={values.jsonPayload}
                    onBlur={() => setFieldTouched('jsonPayload')}
                  />
                </div>
                {errors.jsonPayload &&
                  touched.jsonPayload &&
                  typeof errors.jsonPayload === 'string' && (
                    <div className="error">{errors.jsonPayload}</div>
                  )}
                <div className="mt-2">
                  <Button
                    buttonSize="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      resetPayload();
                    }}
                    className="mr-2"
                  >
                    <ArrowPathIcon />
                    <span>{intl.formatMessage(messages.resetPayload)}</span>
                  </Button>
                  <Link
                    href="https://docs.overseerr.dev/using-overseerr/notifications/webhooks#template-variables"
                    passHref
                    legacyBehavior
                  >
                    <Button
                      as="a"
                      buttonSize="sm"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <QuestionMarkCircleIcon />
                      <span>
                        {intl.formatMessage(messages.templatevariablehelp)}
                      </span>
                    </Button>
                  </Link>
                </div>
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

export default NotificationsWebhook;

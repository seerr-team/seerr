import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import useSettings from '@app/hooks/useSettings';
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

const messages = defineMessages('components.Settings.Notifications', {
  agentenabled: 'Enable Agent',
  embedImage: 'Embed Image',
  botUsername: 'Bot Username',
  botAvatarUrl: 'Bot Avatar URL',
  webhookUrl: 'Webhook URL',
  webhookUrlTip:
    'Create a <DiscordWebhookLink>webhook integration</DiscordWebhookLink> in your server',
  webhookRoleId: 'Notification Role ID',
  webhookRoleIdTip:
    'The role ID to mention in the webhook message. Leave empty to disable mentions',
  discordsettingssaved: 'Discord notification settings saved successfully!',
  discordsettingsfailed: 'Discord notification settings failed to save.',
  toastDiscordTestSending: 'Sending Discord test notification…',
  toastDiscordTestSuccess: 'Discord test notification sent!',
  toastDiscordTestFailed: 'Discord test notification failed to send.',
  validationUrl: 'You must provide a valid URL',
  validationWebhookRoleId: 'You must provide a valid Discord Role ID',
  validationTypes: 'You must select at least one notification type',
  enableMentions: 'Enable Mentions',
});

const NotificationsDiscord = () => {
  const intl = useIntl();
  const settings = useSettings();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/discord');

  const NotificationsDiscordSchema = Yup.object().shape({
    botAvatarUrl: Yup.string()
      .nullable()
      .url(intl.formatMessage(messages.validationUrl)),
    webhookUrl: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationUrl)),
        otherwise: Yup.string().nullable(),
      })
      .url(intl.formatMessage(messages.validationUrl)),
    webhookRoleId: Yup.string()
      .nullable()
      .matches(
        /^\d{17,19}$/,
        intl.formatMessage(messages.validationWebhookRoleId)
      ),
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
        botUsername: data?.options.botUsername,
        botAvatarUrl: data?.options.botAvatarUrl,
        webhookUrl: data.options.webhookUrl,
        webhookRoleId: data?.options.webhookRoleId,
        enableMentions: data?.options.enableMentions,
      }}
      validationSchema={NotificationsDiscordSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/discord', {
            enabled: values.enabled,
            embedImage: values.embedImage,
            types: values.types,
            options: {
              botUsername: values.botUsername,
              botAvatarUrl: values.botAvatarUrl,
              webhookUrl: values.webhookUrl,
              webhookRoleId: values.webhookRoleId,
              enableMentions: values.enableMentions,
            },
          });

          addToast(intl.formatMessage(messages.discordsettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.discordsettingsfailed), {
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
              intl.formatMessage(messages.toastDiscordTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/discord/test', {
              enabled: true,
              embedImage: values.embedImage,
              types: values.types,
              options: {
                botUsername: values.botUsername,
                botAvatarUrl: values.botAvatarUrl,
                webhookUrl: values.webhookUrl,
                webhookRoleId: values.webhookRoleId,
                enableMentions: values.enableMentions,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastDiscordTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastDiscordTestFailed), {
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
                    DiscordWebhookLink: (msg: React.ReactNode) => (
                      <a
                        href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
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
            <div className="form-row">
              <label htmlFor="botUsername" className="text-label">
                {intl.formatMessage(messages.botUsername)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="botUsername"
                    name="botUsername"
                    type="text"
                    placeholder={settings.currentSettings.applicationTitle}
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                </div>
                {errors.botUsername &&
                  touched.botUsername &&
                  typeof errors.botUsername === 'string' && (
                    <div className="error">{errors.botUsername}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="botAvatarUrl" className="text-label">
                {intl.formatMessage(messages.botAvatarUrl)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="botAvatarUrl"
                    name="botAvatarUrl"
                    type="text"
                    inputMode="url"
                  />
                </div>
                {errors.botAvatarUrl &&
                  touched.botAvatarUrl &&
                  typeof errors.botAvatarUrl === 'string' && (
                    <div className="error">{errors.botAvatarUrl}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="webhookRoleId" className="text-label">
                {intl.formatMessage(messages.webhookRoleId)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field id="webhookRoleId" name="webhookRoleId" type="text" />
                </div>
                {errors.webhookRoleId &&
                  touched.webhookRoleId &&
                  typeof errors.webhookRoleId === 'string' && (
                    <div className="error">{errors.webhookRoleId}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="enableMentions" className="checkbox-label">
                {intl.formatMessage(messages.enableMentions)}
              </label>
              <div className="form-input-area">
                <Field
                  type="checkbox"
                  id="enableMentions"
                  name="enableMentions"
                />
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

export default NotificationsDiscord;

import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SensitiveInput from '@app/components/Common/SensitiveInput';
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

const messages = defineMessages('components.Settings.Notifications', {
  agentenabled: 'Enable Agent',
  embedImage: 'Embed Image',
  botUsername: 'Bot Username',
  botUsernameTip:
    'Allow users to also start a chat with your bot and configure their own notifications',
  botAPI: 'Bot Authorization Token',
  botApiTip:
    '<CreateBotLink>Create a bot</CreateBotLink> for use with Jellyseerr',
  chatId: 'Chat ID',
  chatIdTip:
    'Start a chat with your bot, add <GetIdBotLink>@get_id_bot</GetIdBotLink>, and issue the <code>/my_id</code> command',
  messageThreadId: 'Thread/Topic ID',
  messageThreadIdTip:
    "If your group-chat has topics enabled, you can specify a thread/topic's ID here",
  validationBotAPIRequired: 'You must provide a bot authorization token',
  validationChatIdRequired: 'You must provide a valid chat ID',
  validationMessageThreadId:
    'The thread/topic ID must be a positive whole number',
  telegramsettingssaved: 'Telegram notification settings saved successfully!',
  telegramsettingsfailed: 'Telegram notification settings failed to save.',
  toastTelegramTestSending: 'Sending Telegram test notification…',
  toastTelegramTestSuccess: 'Telegram test notification sent!',
  toastTelegramTestFailed: 'Telegram test notification failed to send.',
  sendSilently: 'Send Silently',
  sendSilentlyTip: 'Send notifications with no sound',
});

const NotificationsTelegram = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/telegram');

  const NotificationsTelegramSchema = Yup.object().shape({
    botAPI: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.validationBotAPIRequired)),
      otherwise: Yup.string().nullable(),
    }),
    chatId: Yup.string()
      .when(['enabled', 'types'], {
        is: (enabled: boolean, types: number) => enabled && !!types,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationChatIdRequired)),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^-?\d+$/,
        intl.formatMessage(messages.validationChatIdRequired)
      ),
    messageThreadId: Yup.string()
      .when(['types'], {
        is: (enabled: boolean, types: number) => enabled && !!types,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationMessageThreadId)),
        otherwise: Yup.string().nullable(),
      })
      .matches(/^\d+$/, intl.formatMessage(messages.validationMessageThreadId)),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        enabled: data?.enabled,
        embedImage: data?.embedImage,
        types: data?.types,
        botUsername: data?.options.botUsername,
        botAPI: data?.options.botAPI,
        chatId: data?.options.chatId,
        messageThreadId: data?.options.messageThreadId,
        sendSilently: data?.options.sendSilently,
      }}
      validationSchema={NotificationsTelegramSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/telegram', {
            enabled: values.enabled,
            types: values.types,
            options: {
              botAPI: values.botAPI,
              chatId: values.chatId,
              messageThreadId: values.messageThreadId,
              sendSilently: values.sendSilently,
              botUsername: values.botUsername,
            },
          });

          addToast(intl.formatMessage(messages.telegramsettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.telegramsettingsfailed), {
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
              intl.formatMessage(messages.toastTelegramTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/telegram/test', {
              enabled: true,
              types: values.types,
              options: {
                botAPI: values.botAPI,
                chatId: values.chatId,
                messageThreadId: values.messageThreadId,
                sendSilently: values.sendSilently,
                botUsername: values.botUsername,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastTelegramTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastTelegramTestFailed), {
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
              <label htmlFor="botAPI" className="text-label">
                {intl.formatMessage(messages.botAPI)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.botApiTip, {
                    CreateBotLink: (msg: React.ReactNode) => (
                      <a
                        href="https://core.telegram.org/bots#6-botfather"
                        className="text-white transition duration-300 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {msg}
                      </a>
                    ),
                    GetIdBotLink: (msg: React.ReactNode) => (
                      <a
                        href="https://telegram.me/get_id_bot"
                        className="text-white transition duration-300 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {msg}
                      </a>
                    ),
                    code: (msg: React.ReactNode) => (
                      <code className="bg-opacity-50">{msg}</code>
                    ),
                  })}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <SensitiveInput
                    as="field"
                    id="botAPI"
                    name="botAPI"
                    type="text"
                  />
                </div>
                {errors.botAPI &&
                  touched.botAPI &&
                  typeof errors.botAPI === 'string' && (
                    <div className="error">{errors.botAPI}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="botUsername" className="text-label">
                {intl.formatMessage(messages.botUsername)}
                <span className="label-tip">
                  {intl.formatMessage(messages.botUsernameTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="botUsername"
                    name="botUsername"
                    type="text"
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
              <label htmlFor="chatId" className="text-label">
                {intl.formatMessage(messages.chatId)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.chatIdTip, {
                    GetIdBotLink: (msg: React.ReactNode) => (
                      <a
                        href="https://telegram.me/get_id_bot"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {msg}
                      </a>
                    ),
                    code: (msg: React.ReactNode) => <code>{msg}</code>,
                  })}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="chatId"
                    name="chatId"
                    type="text"
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                </div>
                {errors.chatId &&
                  touched.chatId &&
                  typeof errors.chatId === 'string' && (
                    <div className="error">{errors.chatId}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="messageThreadId" className="text-label">
                {intl.formatMessage(messages.messageThreadId)}
                <span className="label-tip">
                  {intl.formatMessage(messages.messageThreadIdTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="messageThreadId"
                    name="messageThreadId"
                    type="text"
                  />
                </div>
                {errors.messageThreadId &&
                  touched.messageThreadId &&
                  typeof errors.messageThreadId === 'string' && (
                    <div className="error">{errors.messageThreadId}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="sendSilently" className="checkbox-label">
                <span>{intl.formatMessage(messages.sendSilently)}</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.sendSilentlyTip)}
                </span>
              </label>
              <div className="form-input-area">
                <Field type="checkbox" id="sendSilently" name="sendSilently" />
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
                errors.types && touched.types
                  ? (errors.types as string)
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
                    disabled={isSubmitting || !isValid || isTesting}
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

export default NotificationsTelegram;

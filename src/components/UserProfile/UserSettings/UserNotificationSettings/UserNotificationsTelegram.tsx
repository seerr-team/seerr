import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { UserSettingsNotificationsResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserNotificationSettings',
  {
    telegramsettingssaved: 'Telegram notification settings saved successfully!',
    telegramsettingsfailed: 'Telegram notification settings failed to save.',
    telegramChatId: 'Chat ID',
    telegramChatIdTipLong:
      '<TelegramBotLink>Start a chat</TelegramBotLink>, add <GetIdBotLink>@get_id_bot</GetIdBotLink>, and issue the <code>/my_id</code> command',
    telegramMessageThreadId: 'Thread/Topic ID',
    telegramMessageThreadIdTip:
      "If your group-chat has topics enabled, you can specify a thread/topic's ID here",
    sendSilently: 'Send Silently',
    sendSilentlyDescription: 'Send notifications with no sound',
    validationTelegramChatId: 'You must provide a valid chat ID',
    validationTelegramMessageThreadId:
      'The thread/topic ID must be a positive whole number',
  }
);

const UserTelegramSettings = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user } = useUser({ id: Number(router.query.userId) });
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<UserSettingsNotificationsResponse>(
    user ? `/api/v1/user/${user?.id}/settings/notifications` : null
  );

  const UserNotificationsTelegramSchema = Yup.object().shape({
    telegramChatId: Yup.string()
      .when('types', {
        is: (types: number) => !!types,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationTelegramChatId)),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^-?\d+$/,
        intl.formatMessage(messages.validationTelegramChatId)
      ),
    telegramMessageThreadId: Yup.string()
      .when(['types'], {
        is: (enabled: boolean, types: number) => enabled && !!types,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.validationTelegramMessageThreadId)
          ),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^\d+$/,
        intl.formatMessage(messages.validationTelegramMessageThreadId)
      ),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        telegramChatId: data?.telegramChatId,
        telegramMessageThreadId: data?.telegramMessageThreadId,
        telegramSendSilently: data?.telegramSendSilently,
        types: data?.notificationTypes.telegram ?? 0,
      }}
      validationSchema={UserNotificationsTelegramSchema}
      enableReinitialize
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/user/${user?.id}/settings/notifications`, {
            pgpKey: data?.pgpKey,
            discordId: data?.discordId,
            pushbulletAccessToken: data?.pushbulletAccessToken,
            pushoverApplicationToken: data?.pushoverApplicationToken,
            pushoverUserKey: data?.pushoverUserKey,
            telegramChatId: values.telegramChatId,
            telegramMessageThreadId: values.telegramMessageThreadId,
            telegramSendSilently: values.telegramSendSilently,
            notificationTypes: {
              telegram: values.types,
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
        isValid,
        values,
        setFieldValue,
        setFieldTouched,
      }) => {
        return (
          <Form className="section">
            <div className="form-row">
              <label htmlFor="telegramChatId" className="text-label">
                {intl.formatMessage(messages.telegramChatId)}
                <span className="label-required">*</span>
                {data?.telegramBotUsername && (
                  <span className="label-tip">
                    {intl.formatMessage(messages.telegramChatIdTipLong, {
                      TelegramBotLink: (msg: React.ReactNode) => (
                        <a
                          href={`https://telegram.me/${data.telegramBotUsername}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {msg}
                        </a>
                      ),
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
                )}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="telegramChatId"
                    name="telegramChatId"
                    type="text"
                  />
                </div>
                {errors.telegramChatId &&
                  touched.telegramChatId &&
                  typeof errors.telegramChatId === 'string' && (
                    <div className="error">{errors.telegramChatId}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="telegramMessageThreadId" className="text-label">
                {intl.formatMessage(messages.telegramMessageThreadId)}
                <span className="label-tip">
                  {intl.formatMessage(messages.telegramMessageThreadIdTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="telegramMessageThreadId"
                    name="telegramMessageThreadId"
                    type="text"
                  />
                </div>
                {errors.telegramMessageThreadId &&
                  touched.telegramMessageThreadId &&
                  typeof errors.telegramMessageThreadId === 'string' && (
                    <div className="error">
                      {errors.telegramMessageThreadId}
                    </div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="telegramSendSilently" className="checkbox-label">
                {intl.formatMessage(messages.sendSilently)}
                <span className="label-tip">
                  {intl.formatMessage(messages.sendSilentlyDescription)}
                </span>
              </label>
              <div className="form-input-area">
                <Field
                  type="checkbox"
                  id="telegramSendSilently"
                  name="telegramSendSilently"
                />
              </div>
            </div>
            <NotificationTypeSelector
              user={user}
              currentTypes={values.types}
              onUpdate={(newTypes) => {
                setFieldValue('types', newTypes);
                setFieldTouched('types');
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
                    buttonType="primary"
                    type="submit"
                    disabled={isSubmitting || !isValid}
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

export default UserTelegramSettings;

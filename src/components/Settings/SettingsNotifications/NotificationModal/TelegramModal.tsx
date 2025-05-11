import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { NotificationAgentTelegram } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    instanceName: 'Name',
    telegramBotUsername: 'Bot Username',
    telegramBotUsernameTip:
      'Allow users to also start a chat with your bot and configure their own notifications',
    telegramBotAPI: 'Bot Authorization Token',
    telegramBotApiTip:
      '<CreateBotLink>Create a bot</CreateBotLink> for use with Jellyseerr',
    telegramChatId: 'Chat ID',
    telegramChatIdTip:
      'Start a chat with your bot, add <GetIdBotLink>@get_id_bot</GetIdBotLink>, and issue the <code>/my_id</code> command',
    telegramMessageThreadId: 'Thread/Topic ID',
    telegramMessageThreadIdTip:
      "If your group-chat has topics enabled, you can specify a thread/topic's ID here",
    telegramValidationBotAPIRequired:
      'You must provide a bot authorization token',
    telegramValidationChatIdRequired: 'You must provide a valid chat ID',
    telegramValidationMessageThreadId:
      'The thread/topic ID must be a positive whole number',
    telegramSendSilently: 'Send Silently',
    telegramSendSilentlyTip: 'Send notifications with no sound',
  }
);

interface TelegramModalProps {
  title: string;
  data: NotificationAgentTelegram;
  onClose: () => void;
  onTest: (testData: NotificationAgentTelegram) => void;
  onSave: (submitData: NotificationAgentTelegram) => void;
}

const TelegramModal = ({
  title,
  data,
  onClose,
  onTest,
  onSave,
}: TelegramModalProps) => {
  const intl = useIntl();

  const NotificationsTelegramSchema = Yup.object().shape({
    botAPI: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .required(
          intl.formatMessage(messages.telegramValidationBotAPIRequired)
        ),
      otherwise: Yup.string().nullable(),
    }),
    chatId: Yup.string()
      .when(['enabled', 'types'], {
        is: (enabled: boolean, types: number) => enabled && !!types,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.telegramValidationChatIdRequired)
          ),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^-?\d+$/,
        intl.formatMessage(messages.telegramValidationChatIdRequired)
      ),
    messageThreadId: Yup.string()
      .when(['types'], {
        is: (enabled: boolean, types: number) => enabled && !!types,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.telegramValidationMessageThreadId)
          ),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^\d+$/,
        intl.formatMessage(messages.telegramValidationMessageThreadId)
      ),
  });

  return (
    <Formik
      initialValues={{
        enabled: data.enabled,
        types: data.types,
        name: data.name,
        id: data.id,
        agent: data.agent,
        default: data.default,
        botUsername: data.options.botUsername,
        botAPI: data.options.botAPI,
        chatId: data.options.chatId,
        messageThreadId: data.options.messageThreadId,
        sendSilently: data.options.sendSilently,
      }}
      validationSchema={NotificationsTelegramSchema}
      onSubmit={async (values) => {
        await onSave({
          enabled: values.enabled,
          types: values.types,
          name: values.name,
          id: values.id,
          agent: values.agent,
          default: values.default,
          options: {
            botUsername: values.botUsername,
            botAPI: values.botAPI,
            chatId: values.chatId,
            messageThreadId: values.messageThreadId,
            sendSilently: values.sendSilently,
          },
        });
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
        handleSubmit,
      }) => {
        return (
          <Modal
            title={title}
            onCancel={() => onClose()}
            secondaryButtonType="warning"
            secondaryText={intl.formatMessage(globalMessages.test)}
            secondaryDisabled={isSubmitting || !isValid}
            onSecondary={() =>
              onTest({
                enabled: values.enabled,
                types: values.types,
                name: values.name,
                id: values.id,
                agent: values.agent,
                default: values.default,
                options: {
                  botUsername: values.botUsername,
                  botAPI: values.botAPI,
                  chatId: values.chatId,
                  messageThreadId: values.messageThreadId,
                  sendSilently: values.sendSilently,
                },
              })
            }
            okButtonType="primary"
            okText={
              isSubmitting
                ? intl.formatMessage(globalMessages.saving)
                : intl.formatMessage(globalMessages.save)
            }
            onOk={() => {
              handleSubmit();
            }}
            okDisabled={isSubmitting || !isValid}
          >
            <Form className="section">
              <div className="form-row">
                <label htmlFor="name" className="text-label">
                  {intl.formatMessage(messages.instanceName)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="name" name="name" type="text" />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="botAPI" className="text-label">
                  {intl.formatMessage(messages.telegramBotAPI)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.telegramBotApiTip, {
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
                  {intl.formatMessage(messages.telegramBotUsername)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.telegramBotUsernameTip)}
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
                  {intl.formatMessage(messages.telegramChatId)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.telegramChatIdTip, {
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
                  {intl.formatMessage(messages.telegramMessageThreadId)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.telegramMessageThreadIdTip)}
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
                  <span>
                    {intl.formatMessage(messages.telegramSendSilently)}
                  </span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.telegramSendSilentlyTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="sendSilently"
                    name="sendSilently"
                  />
                </div>
              </div>
              <NotificationTypeSelector
                currentTypes={values.enabled && values.types ? values.types : 0}
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
            </Form>
          </Modal>
        );
      }}
    </Formik>
  );
};

export default TelegramModal;

import Modal from '@app/components/Common/Modal';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import { NotificationModalType } from '@app/components/Settings/SettingsNotifications/NotificationModal';
import { availableLanguages } from '@app/context/LanguageContext';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { NotificationAgentDiscord } from '@server/interfaces/settings';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.SettingsNotifications.NotificationModal',
  {
    editTitle: 'Edit Notification Instance',
    createTitle: 'Create Notification Instance',
    createInstance: 'Create Instance',
    instanceName: 'Name',
    embedPoster: 'Embed Poster',
    discordBotUsername: 'Bot Username',
    discordBotAvatarUrl: 'Bot Avatar URL',
    discordWebhookUrl: 'Webhook URL',
    discordWebhookUrlTip:
      'Create a <DiscordWebhookLink>webhook integration</DiscordWebhookLink> in your server',
    discordWebhookRoleId: 'Notification Role ID',
    discordWebhookRoleIdTip:
      'The role ID to mention in the webhook message. Leave empty to disable mentions',
    discordWebhookThreadId: 'Thread ID',
    discordWebhookThreadIdTip:
      'The ID of the thread channel to post notifications in. Leave empty to post in the webhook channel',
    discordUseUserLocale: 'Use Notification Recipient Locale',
    discordValidationUrl: 'You must provide a valid URL',
    discordValidationWebhookRoleId: 'You must provide a valid Discord Role ID',
    discordValidationWebhookThreadId:
      'You must provide a valid Discord Thread ID',
    discordValidationTypes: 'You must select at least one notification type',
    discordEnableMentions: 'Enable Mentions',
  }
);

interface DiscordModalProps {
  type: NotificationModalType;
  data: NotificationAgentDiscord;
  onClose: () => void;
  onTest: (testData: NotificationAgentDiscord) => Promise<void>;
  onSave: (submitData: NotificationAgentDiscord) => Promise<void>;
}

const DiscordModal = ({
  type,
  data,
  onClose,
  onTest,
  onSave,
}: DiscordModalProps) => {
  const intl = useIntl();
  const settings = useSettings();

  const NotificationsDiscordSchema = Yup.object().shape({
    botAvatarUrl: Yup.string()
      .nullable()
      .url(intl.formatMessage(messages.discordValidationUrl)),
    webhookUrl: Yup.string()
      .when('enabled', {
        is: true,
        then: (schema) =>
          schema
            .nullable()
            .required(intl.formatMessage(messages.discordValidationUrl)),
        otherwise: (schema) => schema.nullable(),
      })
      .url(intl.formatMessage(messages.discordValidationUrl)),
    webhookRoleId: Yup.string()
      .nullable()
      .matches(
        /^\d{17,19}$/,
        intl.formatMessage(messages.discordValidationWebhookRoleId)
      ),
    webhookThreadId: Yup.string()
      .nullable()
      .transform((value) => (value === '' ? null : value))
      .matches(/^\d{17,19}$/, {
        message: intl.formatMessage(messages.discordValidationWebhookThreadId),
        excludeEmptyString: true,
      }),
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
        embedPoster: data.embedPoster,
        botUsername: data.options.botUsername,
        botAvatarUrl: data.options.botAvatarUrl,
        webhookUrl: data.options.webhookUrl,
        webhookRoleId: data.options.webhookRoleId,
        webhookThreadId: data.options.webhookThreadId,
        enableMentions: data.options.enableMentions,
        locale: data.options.locale || 'en',
        useUserLocale: data.options.useUserLocale ?? false,
      }}
      validationSchema={NotificationsDiscordSchema}
      onSubmit={async (values) => {
        await onSave({
          enabled: values.enabled,
          types: values.types,
          name: values.name,
          id: values.id,
          agent: values.agent,
          default: values.default,
          embedPoster: values.embedPoster,
          options: {
            botUsername: values.botUsername,
            botAvatarUrl: values.botAvatarUrl,
            webhookUrl: values.webhookUrl,
            webhookRoleId: values.webhookRoleId,
            webhookThreadId: values.webhookThreadId,
            enableMentions: values.enableMentions,
            locale: values.locale,
            useUserLocale: values.useUserLocale,
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
        const title =
          type === NotificationModalType.EDIT
            ? `${intl.formatMessage(messages.editTitle)} #${data?.id}`
            : intl.formatMessage(messages.createTitle);

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
                embedPoster: values.embedPoster,
                options: {
                  botUsername: values.botUsername,
                  botAvatarUrl: values.botAvatarUrl,
                  webhookUrl: values.webhookUrl,
                  webhookRoleId: values.webhookRoleId,
                  webhookThreadId: values.webhookThreadId,
                  enableMentions: values.enableMentions,
                  locale: values.locale,
                  useUserLocale: values.useUserLocale,
                },
              })
            }
            okButtonType="primary"
            okText={
              isSubmitting
                ? intl.formatMessage(globalMessages.saving)
                : type === NotificationModalType.EDIT
                  ? intl.formatMessage(globalMessages.save)
                  : intl.formatMessage(messages.createInstance)
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
                <label htmlFor="embedPoster" className="checkbox-label">
                  {intl.formatMessage(messages.embedPoster)}
                </label>
                <div className="form-input-area">
                  <Field type="checkbox" id="embedPoster" name="embedPoster" />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="name" className="text-label">
                  {intl.formatMessage(messages.discordWebhookUrl)}
                  <span className="label-required">*</span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.discordWebhookUrlTip, {
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
                  {intl.formatMessage(messages.discordBotUsername)}
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
                  {intl.formatMessage(messages.discordBotAvatarUrl)}
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
                  {intl.formatMessage(messages.discordWebhookRoleId)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="webhookRoleId"
                      name="webhookRoleId"
                      type="text"
                    />
                  </div>
                  {errors.webhookRoleId &&
                    touched.webhookRoleId &&
                    typeof errors.webhookRoleId === 'string' && (
                      <div className="error">{errors.webhookRoleId}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="webhookThreadId" className="text-label">
                  {intl.formatMessage(messages.discordWebhookThreadId)}
                  <span className="label-tip">
                    {intl.formatMessage(messages.discordWebhookThreadIdTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="webhookThreadId"
                      name="webhookThreadId"
                      type="text"
                    />
                  </div>
                  {errors.webhookThreadId &&
                    touched.webhookThreadId &&
                    typeof errors.webhookThreadId === 'string' && (
                      <div className="error">{errors.webhookThreadId}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="enableMentions" className="checkbox-label">
                  {intl.formatMessage(messages.discordEnableMentions)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="enableMentions"
                    name="enableMentions"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="useUserLocale" className="checkbox-label">
                  {intl.formatMessage(messages.discordUseUserLocale)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="useUserLocale"
                    name="useUserLocale"
                  />
                </div>
              </div>
              {!values.useUserLocale && (
                <div className="form-row">
                  <label htmlFor="locale" className="text-label">
                    {intl.formatMessage(globalMessages.notificationLocale)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field as="select" id="locale" name="locale">
                        {(
                          Object.keys(
                            availableLanguages
                          ) as (keyof typeof availableLanguages)[]
                        ).map((key) => (
                          <option
                            key={key}
                            value={availableLanguages[key].code}
                            lang={availableLanguages[key].code}
                          >
                            {availableLanguages[key].display}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>
                </div>
              )}
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
                  values.enabled && !values.types && touched.types
                    ? intl.formatMessage(messages.discordValidationTypes)
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

export default DiscordModal;

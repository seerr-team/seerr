import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import { NotificationModalType } from '@app/components/Settings/SettingsNotifications/NotificationModal';
import { availableLanguages } from '@app/context/LanguageContext';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import type { NotificationAgentNtfy } from '@server/interfaces/settings';
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
    ntfyUrl: 'Server root URL',
    ntfyTopic: 'Topic',
    ntfyUsernamePasswordAuth: 'Username + Password authentication',
    ntfyUsername: 'Username',
    ntfyPassword: 'Password',
    ntfyTokenAuth: 'Token authentication',
    ntfyToken: 'Token',
    ntfyPriority: 'Priority',
    ntfyValidationUrl: 'You must provide a valid URL',
    ntfyValidationTopic: 'You must provide a topic',
    ntfyValidationPriorityRequired:
      'You must provide a priority between 1 and 5',
    validationTypes: 'You must select at least one notification type',
  }
);

interface NtfyModalProps {
  type: NotificationModalType;
  data: NotificationAgentNtfy;
  onClose: () => void;
  onTest: (testData: NotificationAgentNtfy) => Promise<void>;
  onSave: (submitData: NotificationAgentNtfy) => Promise<void>;
}

const NtfyModal = ({ type, data, onClose, onTest, onSave }: NtfyModalProps) => {
  const intl = useIntl();

  const NotificationsNtfySchema = Yup.object().shape({
    url: Yup.string()
      .when('enabled', {
        is: true,
        then: (schema) =>
          schema
            .nullable()
            .required(intl.formatMessage(messages.ntfyValidationUrl)),
        otherwise: (schema) => schema.nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.ntfyValidationUrl),
        isValidURL
      ),
    topic: Yup.string()
      .when('enabled', {
        is: true,
        then: (schema) =>
          schema
            .nullable()
            .required(intl.formatMessage(messages.ntfyValidationTopic)),
        otherwise: (schema) => schema.nullable(),
      })
      .defined(intl.formatMessage(messages.ntfyValidationUrl)),
    priority: Yup.number().when('enabled', {
      is: true,
      then: (schema) =>
        schema
          .nullable()
          .min(1)
          .max(5)
          .required(
            intl.formatMessage(messages.ntfyValidationPriorityRequired)
          ),
      otherwise: (schema) => schema.nullable(),
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
        url: data.options.url,
        topic: data.options.topic,
        authMethodUsernamePassword: data.options.authMethodUsernamePassword,
        username: data.options.username,
        password: data.options.password,
        authMethodToken: data.options.authMethodToken,
        token: data.options.token,
        priority: data?.options.priority,
        locale: data?.options.locale ?? 'en',
      }}
      validationSchema={NotificationsNtfySchema}
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
            url: values.url,
            topic: values.topic,
            authMethodUsernamePassword: values.authMethodUsernamePassword,
            username: values.username,
            password: values.password,
            authMethodToken: values.authMethodToken,
            token: values.token,
            priority: values.priority,
            locale: values.locale,
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
                  url: values.url,
                  topic: values.topic,
                  authMethodUsernamePassword: values.authMethodUsernamePassword,
                  username: values.username,
                  password: values.password,
                  authMethodToken: values.authMethodToken,
                  token: values.token,
                  priority: values.priority,
                  locale: values.locale,
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
                <label htmlFor="url" className="text-label">
                  {intl.formatMessage(messages.ntfyUrl)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="url" name="url" type="text" inputMode="url" />
                  </div>
                  {errors.url &&
                    touched.url &&
                    typeof errors.url === 'string' && (
                      <div className="error">{errors.url}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="topic" className="text-label">
                  {intl.formatMessage(messages.ntfyTopic)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field id="topic" name="topic" type="text" />
                  </div>
                  {errors.topic &&
                    touched.topic &&
                    typeof errors.topic === 'string' && (
                      <div className="error">{errors.topic}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label
                  htmlFor="authMethodUsernamePassword"
                  className="checkbox-label"
                >
                  <span className="mr-2">
                    {intl.formatMessage(messages.ntfyUsernamePasswordAuth)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="authMethodUsernamePassword"
                    name="authMethodUsernamePassword"
                    disabled={values.authMethodToken}
                    onChange={() => {
                      setFieldValue(
                        'authMethodUsernamePassword',
                        !values.authMethodUsernamePassword
                      );
                    }}
                  />
                </div>
              </div>
              {values.authMethodUsernamePassword && (
                <div className="ml-4 mr-2">
                  <div className="form-row">
                    <label htmlFor="username" className="text-label">
                      {intl.formatMessage(messages.ntfyUsername)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field id="username" name="username" type="text" />
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="password" className="text-label">
                      {intl.formatMessage(messages.ntfyPassword)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <SensitiveInput
                          as="field"
                          id="password"
                          name="password"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="form-row">
                <label htmlFor="authMethodToken" className="checkbox-label">
                  <span className="mr-2">
                    {intl.formatMessage(messages.ntfyTokenAuth)}
                  </span>
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="authMethodToken"
                    name="authMethodToken"
                    disabled={values.authMethodUsernamePassword}
                    onChange={() => {
                      setFieldValue('authMethodToken', !values.authMethodToken);
                    }}
                  />
                </div>
              </div>
              {values.authMethodToken && (
                <div className="form-row ml-4 mr-2">
                  <label htmlFor="token" className="text-label">
                    {intl.formatMessage(messages.ntfyToken)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <SensitiveInput as="field" id="token" name="token" />
                    </div>
                  </div>
                </div>
              )}
              <div className="form-row">
                <label htmlFor="priority" className="text-label">
                  {intl.formatMessage(messages.ntfyPriority)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field as="select" id="priority" name="priority">
                      <option value={1}>Minimum</option>
                      <option value={2}>Low</option>
                      <option value={3}>Default</option>
                      <option value={4}>High</option>
                      <option value={5}>Urgent</option>
                    </Field>
                  </div>
                </div>
              </div>
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
              <NotificationTypeSelector
                currentTypes={
                  values.enabled && values.types ? values.types || 0 : 0
                }
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
            </Form>
          </Modal>
        );
      }}
    </Formik>
  );
};

export default NtfyModal;

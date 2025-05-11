import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
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
    instanceName: 'Name',
    ntfyUrl: 'Server root URL',
    ntfyTopic: 'Topic',
    ntfyUsernamePasswordAuth: 'Username + Password authentication',
    ntfyUsername: 'Username',
    ntfyPassword: 'Password',
    ntfyTokenAuth: 'Token authentication',
    ntfyToken: 'Token',
    ntfyValidationNtfyUrl: 'You must provide a valid URL',
    ntfyValidationNtfyTopic: 'You must provide a topic',
    validationTypes: 'You must select at least one notification type',
  }
);

interface NtfyModalProps {
  title: string;
  data: NotificationAgentNtfy;
  onClose: () => void;
  onTest: (testData: NotificationAgentNtfy) => void;
  onSave: (submitData: NotificationAgentNtfy) => void;
}

const NtfyModal = ({
  title,
  data,
  onClose,
  onTest,
  onSave,
}: NtfyModalProps) => {
  const intl = useIntl();

  const NotificationsNtfySchema = Yup.object().shape({
    url: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.ntfyValidationNtfyUrl)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.ntfyValidationNtfyUrl),
        isValidURL
      ),
    topic: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.ntfyValidationNtfyUrl)),
        otherwise: Yup.string().nullable(),
      })
      .defined(intl.formatMessage(messages.ntfyValidationNtfyTopic)),
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
        url: data.options.url,
        topic: data.options.topic,
        authMethodUsernamePassword: data.options.authMethodUsernamePassword,
        username: data.options.username,
        password: data.options.password,
        authMethodToken: data.options.authMethodToken,
        token: data.options.token,
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
          options: {
            url: values.url,
            topic: values.topic,
            authMethodUsernamePassword: values.authMethodUsernamePassword,
            username: values.username,
            password: values.password,
            authMethodToken: values.authMethodToken,
            token: values.token,
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
                  url: values.url,
                  topic: values.topic,
                  authMethodUsernamePassword: values.authMethodUsernamePassword,
                  username: values.username,
                  password: values.password,
                  authMethodToken: values.authMethodToken,
                  token: values.token,
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
                <div className="mr-2 ml-4">
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
                <div className="form-row mr-2 ml-4">
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

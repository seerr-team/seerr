import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import type { NotificationAgentNtfy } from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsNtfy',
  {
    agentenabled: 'Enable Agent',
    embedImage: 'Embed Image',
    url: 'Server root URL',
    topic: 'Topic',
    usernamePasswordAuth: 'Username + Password authentication',
    username: 'Username',
    password: 'Password',
    tokenAuth: 'Token authentication',
    token: 'Token',
    ntfysettingssaved: 'Ntfy notification settings saved successfully!',
    ntfysettingsfailed: 'Ntfy notification settings failed to save.',
    toastNtfyTestSending: 'Sending ntfy test notification…',
    toastNtfyTestSuccess: 'Ntfy test notification sent!',
    toastNtfyTestFailed: 'Ntfy test notification failed to send.',
    validationNtfyUrl: 'You must provide a valid URL',
    validationNtfyTopic: 'You must provide a topic',
    validationTypes: 'You must select at least one notification type',
  }
);

const NotificationsNtfy = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<NotificationAgentNtfy>('/api/v1/settings/notifications/ntfy');

  const NotificationsNtfySchema = Yup.object().shape({
    url: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationNtfyUrl)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.validationNtfyUrl),
        isValidURL
      ),
    topic: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationNtfyUrl)),
        otherwise: Yup.string().nullable(),
      })
      .defined(intl.formatMessage(messages.validationNtfyTopic)),
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
        url: data?.options.url,
        topic: data?.options.topic,
        authMethodUsernamePassword: data?.options.authMethodUsernamePassword,
        username: data?.options.username,
        password: data?.options.password,
        authMethodToken: data?.options.authMethodToken,
        token: data?.options.token,
      }}
      validationSchema={NotificationsNtfySchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/ntfy', {
            enabled: values.enabled,
            embedImage: values.embedImage,
            types: values.types,
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

          addToast(intl.formatMessage(messages.ntfysettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.ntfysettingsfailed), {
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
              intl.formatMessage(messages.toastNtfyTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/ntfy/test', {
              enabled: true,
              types: values.types,
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

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastNtfyTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastNtfyTestFailed), {
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
              <label htmlFor="url" className="text-label">
                {intl.formatMessage(messages.url)}
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
                {intl.formatMessage(messages.topic)}
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
                  {intl.formatMessage(messages.usernamePasswordAuth)}
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
                    {intl.formatMessage(messages.username)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field id="username" name="username" type="text" />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="password" className="text-label">
                    {intl.formatMessage(messages.password)}
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
                  {intl.formatMessage(messages.tokenAuth)}
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
                  {intl.formatMessage(messages.token)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput as="field" id="token" name="token" />
                  </div>
                </div>
              </div>
            )}
            <NotificationTypeSelector
              currentTypes={values.enabled ? values.types || 0 : 0}
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

export default NotificationsNtfy;

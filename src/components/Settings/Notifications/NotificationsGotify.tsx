import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsGotify',
  {
    agentenabled: 'Enable Agent',
    url: 'Server URL',
    token: 'Application Token',
    priority: 'Priority',
    validationUrlRequired: 'You must provide a valid URL',
    validationUrlTrailingSlash: 'URL must not end in a trailing slash',
    validationTokenRequired: 'You must provide an application token',
    validationPriorityRequired: 'You must set a priority number',
    gotifysettingssaved: 'Gotify notification settings saved successfully!',
    gotifysettingsfailed: 'Gotify notification settings failed to save.',
    toastGotifyTestSending: 'Sending Gotify test notification…',
    toastGotifyTestSuccess: 'Gotify test notification sent!',
    toastGotifyTestFailed: 'Gotify test notification failed to send.',
    validationTypes: 'You must select at least one notification type',
  }
);

const NotificationsGotify = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/gotify');

  const NotificationsGotifySchema = Yup.object().shape({
    url: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationUrlRequired)),
        otherwise: Yup.string().nullable(),
      })
      .test(
        'valid-url',
        intl.formatMessage(messages.validationUrlRequired),
        isValidURL
      )
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
    token: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.validationTokenRequired)),
      otherwise: Yup.string().nullable(),
    }),
    priority: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .min(0)
        .max(9)
        .required(intl.formatMessage(messages.validationPriorityRequired)),
      otherwise: Yup.string().nullable(),
    }),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        enabled: data?.enabled,
        types: data?.types,
        url: data?.options.url,
        token: data?.options.token,
        priority: data?.options.priority,
      }}
      validationSchema={NotificationsGotifySchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/gotify', {
            enabled: values.enabled,
            types: values.types,
            options: {
              url: values.url,
              token: values.token,
              priority: Number(values.priority),
            },
          });
          addToast(intl.formatMessage(messages.gotifysettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.gotifysettingsfailed), {
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
              intl.formatMessage(messages.toastGotifyTestSending),
              {
                autoDsmiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/gotify/test', {
              enabled: true,
              types: values.types,
              options: {
                url: values.url,
                token: values.token,
                priority: Number(values.priority),
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastGotifyTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastGotifyTestFailed), {
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
              <label htmlFor="url" className="text-label">
                {intl.formatMessage(messages.url)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field id="url" name="url" type="text" />
                </div>
                {errors.url &&
                  touched.url &&
                  typeof errors.url === 'string' && (
                    <div className="error">{errors.url}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="token" className="text-label">
                {intl.formatMessage(messages.token)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field id="token" name="token" type="text" />
                </div>
                {errors.token &&
                  touched.token &&
                  typeof errors.token === 'string' && (
                    <div className="error">{errors.token}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="priority" className="text-label">
                {intl.formatMessage(messages.priority)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <Field
                  id="priority"
                  name="priority"
                  type="text"
                  inputMode="numeric"
                  className="short"
                  autoComplete="off"
                  data-1pignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                />
                {errors.priority &&
                  touched.priority &&
                  typeof errors.priority === 'string' && (
                    <div className="error">{errors.priority}</div>
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

export default NotificationsGotify;

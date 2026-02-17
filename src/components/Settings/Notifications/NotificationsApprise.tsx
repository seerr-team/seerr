import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
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
  url: 'Apprise URL',
  appriseURLTip: 'The URL to your Apprise instance',
  apiToken: 'Apprise API Token',
  apprisesettingssaved: 'Apprise notification settings saved successfully!',
  apprisesettingsfailed: 'Apprise notification settings failed to save.',
  toastAppriseTestSending: 'Sending Apprise test notification…',
  toastAppriseTestSuccess: 'Apprise test notification sent!',
  toastAppriseTestFailed: 'Apprise test notification failed to send.',
  validationUrl: 'You must provide a valid URL',
  validationTypes: 'You must select at least one notification type',
});

const NotificationsApprise = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/apprise');

  const NotificationsAppriseSchema = Yup.object().shape({
    url: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationUrl)),
        otherwise: Yup.string().nullable(),
      })
      .url(intl.formatMessage(messages.validationUrl)),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        enabled: data.enabled,
        types: data.types,
        url: data?.options.url,
        apiToken: data?.options.apiToken,
      }}
      validationSchema={NotificationsAppriseSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/apprise', {
            enabled: values.enabled,
            types: values.types,
            options: {
              url: values.url,
              apiToken: values.apiToken,
            },
          });

          addToast(intl.formatMessage(messages.apprisesettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.apprisesettingsfailed), {
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
              intl.formatMessage(messages.toastAppriseTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/apprise/test', {
              enabled: true,
              types: values.types,
              options: {
                url: values.url,
                apiToken: values.apiToken,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastAppriseTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastAppriseTestFailed), {
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
                <span className="label-tip">
                  {intl.formatMessage(messages.appriseURLTip)}
                </span>
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
              <label htmlFor="apiToken" className="text-label">
                {intl.formatMessage(messages.apiToken)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="apiToken"
                    name="apiToken"
                    type="text"
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                  />
                </div>
                {errors.apiToken &&
                  touched.apiToken &&
                  typeof errors.apiToken === 'string' && (
                    <div className="error">{errors.apiToken}</div>
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

export default NotificationsApprise;

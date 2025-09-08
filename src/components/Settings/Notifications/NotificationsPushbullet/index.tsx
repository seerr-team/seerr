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

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsPushbullet',
  {
    agentEnabled: 'Enable Agent',
    accessToken: 'Access Token',
    accessTokenTip:
      'Create a token from your <PushbulletSettingsLink>Account Settings</PushbulletSettingsLink>',
    validationAccessTokenRequired: 'You must provide an access token',
    channelTag: 'Channel Tag',
    pushbulletSettingsSaved:
      'Pushbullet notification settings saved successfully!',
    pushbulletSettingsFailed:
      'Pushbullet notification settings failed to save.',
    toastPushbulletTestSending: 'Sending Pushbullet test notification…',
    toastPushbulletTestSuccess: 'Pushbullet test notification sent!',
    toastPushbulletTestFailed: 'Pushbullet test notification failed to send.',
    validationTypes: 'You must select at least one notification type',
  }
);

const NotificationsPushbullet = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/pushbullet');

  const NotificationsPushbulletSchema = Yup.object().shape({
    accessToken: Yup.string().when('enabled', {
      is: true,
      then: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.validationAccessTokenRequired)),
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
        accessToken: data?.options.accessToken,
        channelTag: data.options.channelTag,
      }}
      validationSchema={NotificationsPushbulletSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/pushbullet', {
            enabled: values.enabled,
            types: values.types,
            options: {
              accessToken: values.accessToken,
              channelTag: values.channelTag,
            },
          });
          addToast(intl.formatMessage(messages.pushbulletSettingsSaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.pushbulletSettingsFailed), {
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
              intl.formatMessage(messages.toastPushbulletTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/pushbullet/test', {
              enabled: true,
              types: values.types,
              options: {
                accessToken: values.accessToken,
                channelTag: values.channelTag,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastPushbulletTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastPushbulletTestFailed), {
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
                {intl.formatMessage(messages.agentEnabled)}
                <span className="label-required">*</span>
              </label>
              <div className="form-input-area">
                <Field type="checkbox" id="enabled" name="enabled" />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="accessToken" className="text-label">
                {intl.formatMessage(messages.accessToken)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.accessTokenTip, {
                    PushbulletSettingsLink: (msg: React.ReactNode) => (
                      <a
                        href="https://www.pushbullet.com/#settings/account"
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
                  <SensitiveInput
                    as="field"
                    id="accessToken"
                    name="accessToken"
                    autoComplete="one-time-code"
                  />
                </div>
                {errors.accessToken &&
                  touched.accessToken &&
                  typeof errors.accessToken === 'string' && (
                    <div className="error">{errors.accessToken}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="channelTag" className="text-label">
                {intl.formatMessage(messages.channelTag)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field id="channelTag" name="channelTag" type="text" />
                </div>
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

export default NotificationsPushbullet;

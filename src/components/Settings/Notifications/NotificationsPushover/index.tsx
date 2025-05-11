import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import type { PushoverSound } from '@server/api/pushover';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.Notifications.NotificationsPushover',
  {
    agentenabled: 'Enable Agent',
    embedImage: 'Embed Image',
    accessToken: 'Application API Token',
    accessTokenTip:
      '<ApplicationRegistrationLink>Register an application</ApplicationRegistrationLink> for use with Jellyseerr',
    userToken: 'User or Group Key',
    userTokenTip:
      'Your 30-character <UsersGroupsLink>user or group identifier</UsersGroupsLink>',
    sound: 'Notification Sound',
    deviceDefault: 'Device Default',
    validationAccessTokenRequired: 'You must provide a valid application token',
    validationUserTokenRequired: 'You must provide a valid user or group key',
    pushoversettingssaved: 'Pushover notification settings saved successfully!',
    pushoversettingsfailed: 'Pushover notification settings failed to save.',
    toastPushoverTestSending: 'Sending Pushover test notification…',
    toastPushoverTestSuccess: 'Pushover test notification sent!',
    toastPushoverTestFailed: 'Pushover test notification failed to send.',
    validationTypes: 'You must select at least one notification type',
  }
);

const NotificationsPushover = () => {
  const intl = useIntl();
  const { addToast, removeToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR('/api/v1/settings/notifications/pushover');
  const { data: soundsData } = useSWR<PushoverSound[]>(
    data?.options.accessToken
      ? `/api/v1/settings/notifications/pushover/sounds?token=${data.options.accessToken}`
      : null
  );

  const NotificationsPushoverSchema = Yup.object().shape({
    accessToken: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationAccessTokenRequired)),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^[a-z\d]{30}$/i,
        intl.formatMessage(messages.validationAccessTokenRequired)
      ),
    userToken: Yup.string()
      .when('enabled', {
        is: true,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationUserTokenRequired)),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^[a-z\d]{30}$/i,
        intl.formatMessage(messages.validationUserTokenRequired)
      ),
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
        accessToken: data?.options.accessToken,
        userToken: data?.options.userToken,
        sound: data?.options.sound,
      }}
      validationSchema={NotificationsPushoverSchema}
      onSubmit={async (values) => {
        try {
          await axios.post('/api/v1/settings/notifications/pushover', {
            enabled: values.enabled,
            embedImage: values.embedImage,
            types: values.types,
            options: {
              accessToken: values.accessToken,
              userToken: values.userToken,
              sound: values.sound,
            },
          });
          addToast(intl.formatMessage(messages.pushoversettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.pushoversettingsfailed), {
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
              intl.formatMessage(messages.toastPushoverTestSending),
              {
                autoDismiss: false,
                appearance: 'info',
              },
              (id) => {
                toastId = id;
              }
            );
            await axios.post('/api/v1/settings/notifications/pushover/test', {
              enabled: true,
              embedImage: values.embedImage,
              types: values.types,
              options: {
                accessToken: values.accessToken,
                userToken: values.userToken,
                sound: values.sound,
              },
            });

            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastPushoverTestSuccess), {
              autoDismiss: true,
              appearance: 'success',
            });
          } catch (e) {
            if (toastId) {
              removeToast(toastId);
            }
            addToast(intl.formatMessage(messages.toastPushoverTestFailed), {
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
              <label htmlFor="accessToken" className="text-label">
                {intl.formatMessage(messages.accessToken)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.accessTokenTip, {
                    ApplicationRegistrationLink: (msg: React.ReactNode) => (
                      <a
                        href="https://pushover.net/api#registration"
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
                  <Field id="accessToken" name="accessToken" type="text" />
                </div>
                {errors.accessToken &&
                  touched.accessToken &&
                  typeof errors.accessToken === 'string' && (
                    <div className="error">{errors.accessToken}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="userToken" className="text-label">
                {intl.formatMessage(messages.userToken)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.userTokenTip, {
                    UsersGroupsLink: (msg: React.ReactNode) => (
                      <a
                        href="https://pushover.net/api#identifiers"
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
                  <Field id="userToken" name="userToken" type="text" />
                </div>
                {errors.userToken &&
                  touched.userToken &&
                  typeof errors.userToken === 'string' && (
                    <div className="error">{errors.userToken}</div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="sound" className="text-label">
                {intl.formatMessage(messages.sound)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    as="select"
                    id="sound"
                    name="sound"
                    disabled={!soundsData?.length}
                  >
                    <option value="">
                      {intl.formatMessage(messages.deviceDefault)}
                    </option>
                    {soundsData?.map((sound, index) => (
                      <option key={`sound-${index}`} value={sound.name}>
                        {sound.description}
                      </option>
                    ))}
                  </Field>
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

export default NotificationsPushover;

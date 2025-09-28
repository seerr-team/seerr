import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { PushoverSound } from '@server/api/pushover';
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
    pushoversettingssaved: 'Pushover notification settings saved successfully!',
    pushoversettingsfailed: 'Pushover notification settings failed to save.',
    pushoverApplicationToken: 'Application API Token',
    pushoverApplicationTokenTip:
      '<ApplicationRegistrationLink>Register an application</ApplicationRegistrationLink> for use with {applicationTitle}',
    pushoverUserKey: 'User or Group Key',
    pushoverUserKeyTip:
      'Your 30-character <UsersGroupsLink>user or group identifier</UsersGroupsLink>',
    sound: 'Notification Sound',
    deviceDefault: 'Device Default',
    validationPushoverApplicationToken:
      'You must provide a valid application token',
    validationPushoverUserKey: 'You must provide a valid user or group key',
  }
);

const UserPushoverSettings = () => {
  const intl = useIntl();
  const settings = useSettings();
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
  const { data: soundsData } = useSWR<PushoverSound[]>(
    data?.pushoverApplicationToken
      ? `/api/v1/settings/notifications/pushover/sounds?token=${data.pushoverApplicationToken}`
      : null
  );

  const UserNotificationsPushoverSchema = Yup.object().shape({
    pushoverApplicationToken: Yup.string()
      .when('types', {
        is: (types: number) => !!types,
        then: Yup.string()
          .nullable()
          .required(
            intl.formatMessage(messages.validationPushoverApplicationToken)
          ),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^[a-z\d]{30}$/i,
        intl.formatMessage(messages.validationPushoverApplicationToken)
      ),
    pushoverUserKey: Yup.string()
      .when('types', {
        is: (types: number) => !!types,
        then: Yup.string()
          .nullable()
          .required(intl.formatMessage(messages.validationPushoverUserKey)),
        otherwise: Yup.string().nullable(),
      })
      .matches(
        /^[a-z\d]{30}$/i,
        intl.formatMessage(messages.validationPushoverUserKey)
      ),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        pushoverApplicationToken: data?.pushoverApplicationToken,
        pushoverUserKey: data?.pushoverUserKey,
        types: data?.notificationTypes.pushover ?? 0,
      }}
      validationSchema={UserNotificationsPushoverSchema}
      enableReinitialize
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/user/${user?.id}/settings/notifications`, {
            pgpKey: data?.pgpKey,
            discordId: data?.discordId,
            pushbulletAccessToken: data?.pushbulletAccessToken,
            pushoverApplicationToken: values.pushoverApplicationToken,
            pushoverUserKey: values.pushoverUserKey,
            telegramChatId: data?.telegramChatId,
            telegramSendSilently: data?.telegramSendSilently,
            notificationTypes: {
              pushover: values.types,
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
        isValid,
        values,
        setFieldValue,
        setFieldTouched,
      }) => {
        return (
          <Form className="section">
            <div className="form-row">
              <label htmlFor="pushoverApplicationToken" className="text-label">
                {intl.formatMessage(messages.pushoverApplicationToken)}
                <span className="label-required">*</span>
                <span className="label-tip">
                  {intl.formatMessage(messages.pushoverApplicationTokenTip, {
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
                    applicationTitle: settings.currentSettings.applicationTitle,
                  })}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field
                    id="pushoverApplicationToken"
                    name="pushoverApplicationToken"
                    type="text"
                  />
                </div>
                {errors.pushoverApplicationToken &&
                  touched.pushoverApplicationToken && (
                    <div className="error">
                      {errors.pushoverApplicationToken}
                    </div>
                  )}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="pushoverUserKey" className="checkbox-label">
                {intl.formatMessage(messages.pushoverUserKey)}
                <span className="label-tip">
                  {intl.formatMessage(messages.pushoverUserKeyTip, {
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
                  <Field
                    id="pushoverUserKey"
                    name="pushoverUserKey"
                    type="text"
                  />
                </div>
                {errors.pushoverUserKey &&
                  touched.pushoverUserKey &&
                  typeof errors.pushoverUserKey === 'string' && (
                    <div className="error">{errors.pushoverUserKey}</div>
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
                    {isSubmitting
                      ? intl.formatMessage(globalMessages.saving)
                      : intl.formatMessage(globalMessages.save)}
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

export default UserPushoverSettings;

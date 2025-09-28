import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { UserSettingsNotificationsResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserNotificationSettings',
  {
    pushbulletsettingssaved:
      'Pushbullet notification settings saved successfully!',
    pushbulletsettingsfailed:
      'Pushbullet notification settings failed to save.',
    pushbulletAccessToken: 'Access Token',
    pushbulletAccessTokenTip:
      'Create a token from your <PushbulletSettingsLink>Account Settings</PushbulletSettingsLink>',
    validationPushbulletAccessToken: 'You must provide an access token',
  }
);

const UserPushbulletSettings = () => {
  const intl = useIntl();
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

  const UserNotificationsPushbulletSchema = Yup.object().shape({
    pushbulletAccessToken: Yup.string().when('types', {
      is: (types: number) => !!types,
      then: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.validationPushbulletAccessToken)),
      otherwise: Yup.string().nullable(),
    }),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        pushbulletAccessToken: data?.pushbulletAccessToken,
        types: data?.notificationTypes.pushbullet ?? 0,
      }}
      validationSchema={UserNotificationsPushbulletSchema}
      enableReinitialize
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/user/${user?.id}/settings/notifications`, {
            pgpKey: data?.pgpKey,
            discordId: data?.discordId,
            pushbulletAccessToken: values.pushbulletAccessToken,
            pushoverApplicationToken: data?.pushoverApplicationToken,
            pushoverUserKey: data?.pushoverUserKey,
            telegramChatId: data?.telegramChatId,
            telegramSendSilently: data?.telegramSendSilently,
            notificationTypes: {
              pushbullet: values.types,
            },
          });
          addToast(intl.formatMessage(messages.pushbulletsettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch (e) {
          addToast(intl.formatMessage(messages.pushbulletsettingsfailed), {
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
              <label htmlFor="pushbulletAccessToken" className="text-label">
                {intl.formatMessage(messages.pushbulletAccessToken)}
                <span className="label-required">*</span>
                {data?.pushbulletAccessToken && (
                  <span className="label-tip">
                    {intl.formatMessage(messages.pushbulletAccessTokenTip, {
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
                )}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <SensitiveInput
                    as="field"
                    id="pushbulletAccessToken"
                    name="pushbulletAccessToken"
                    type="text"
                  />
                </div>
                {errors.pushbulletAccessToken &&
                  touched.pushbulletAccessToken && (
                    <div className="error">{errors.pushbulletAccessToken}</div>
                  )}
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

export default UserPushbulletSettings;

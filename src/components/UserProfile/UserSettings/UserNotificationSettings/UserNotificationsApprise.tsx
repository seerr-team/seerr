import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
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
    apprisesettingssaved: 'Apprise notification settings saved successfully!',
    apprisesettingsfailed: 'Apprise notification settings failed to save.',
    appriseTags: 'Apprise Tags',
    appriseTagsTip:
      'The tag(s) that lines up to what yo have configure in your Apprise instance',
  }
);

const UserNotificationsApprise = () => {
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

  const UserNotificationsAppriseSchema = Yup.object().shape({
    appriseTags: Yup.string().when('types', {
      is: (types: string) => !!types,
      then: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.appriseTags)),
      otherwise: Yup.string().nullable(),
    }),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        appriseTags: data?.appriseTags,
        types:
          (data?.appriseEnabledTypes ?? 0) &
          (data?.notificationTypes.apprise ?? 0),
      }}
      validationSchema={UserNotificationsAppriseSchema}
      enableReinitialize
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/user/${user?.id}/settings/notifications`, {
            pgpKey: data?.pgpKey,
            appriseTags: values.appriseTags,
            discordId: data?.discordId,
            pushbulletAccessToken: data?.pushbulletAccessToken,
            pushoverApplicationToken: data?.pushoverApplicationToken,
            pushoverUserKey: data?.pushoverUserKey,
            telegramChatId: data?.telegramChatId,
            telegramSendSilently: data?.telegramSendSilently,
            notificationTypes: {
              apprise: values.types,
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
        isValid,
        values,
        setFieldValue,
        setFieldTouched,
      }) => {
        return (
          <Form className="section">
            <div className="form-row">
              <label htmlFor="appriseTags" className="text-label">
                <span className="mr-2">
                  {intl.formatMessage(messages.appriseTags)}
                  {!!data?.appriseEnabledTypes && (
                    <span className="label-required">*</span>
                  )}
                </span>
                <span className="label-tip">
                  {intl.formatMessage(messages.appriseTagsTip)}
                </span>
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <Field id="appriseTags" name="appriseTags" type="text" />
                </div>
                {errors.appriseTags &&
                  touched.appriseTags &&
                  typeof errors.appriseTags === 'object' && (
                    <div className="error">{errors.appriseTags}</div>
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

export default UserNotificationsApprise;

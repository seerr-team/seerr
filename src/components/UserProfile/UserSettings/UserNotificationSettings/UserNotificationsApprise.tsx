import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SensitiveInput from '@app/components/Common/SensitiveInput';
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
      'The tags that have been configured to send the desired notifications to Apprise',
    appriseStatelessURL: 'Apprise Stateless URL',
    appriseStatelessURLTip:
      'The stateless URL used to send notifications to Apprise',
    validationAppriseOneRequired: 'Enter Apprise Tag(s) or a stateless URL',
    validationAppriseExclusive:
      'You can only set Apprise Tag(s) OR a stateless URL (not both)',
    validationAppriseTypesRequired: 'Select at least one notification type',
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
    appriseTags: Yup.string()
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .nullable()
      .when('types', {
        is: (types: unknown) => Number(types) > 0,
        then: Yup.string()
          .nullable()
          .test(
            'tags-or-url-required',
            intl.formatMessage(messages.validationAppriseOneRequired),
            function (value) {
              const tags = (value ?? '').toString().trim();
              const url = (this.parent?.appriseStatelessURL ?? '')
                .toString()
                .trim();
              return !!(tags || url);
            }
          )
          .test(
            'tags-xor-url',
            intl.formatMessage(messages.validationAppriseExclusive),
            function (value) {
              const tags = (value ?? '').toString().trim();
              const url = (this.parent?.appriseStatelessURL ?? '')
                .toString()
                .trim();

              return !(tags && url);
            }
          ),
        otherwise: Yup.string().nullable(),
      }),

    appriseStatelessURL: Yup.string()
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .nullable()
      .when('types', {
        is: (types: unknown) => Number(types) > 0,
        then: Yup.string()
          .nullable()
          .test(
            'url-xor-tags',
            intl.formatMessage(messages.validationAppriseExclusive),
            function (value) {
              const url = (value ?? '').toString().trim();
              const tags = (this.parent?.appriseTags ?? '').toString().trim();

              return !(url && tags);
            }
          ),
        otherwise: Yup.string().nullable(),
      }),

    types: Yup.number().test(
      'types-required-if-configured',
      intl.formatMessage(messages.validationAppriseTypesRequired),
      function (value) {
        const tags = (this.parent?.appriseTags ?? '').toString().trim();
        const url = (this.parent?.appriseStatelessURL ?? '').toString().trim();
        if (tags || url) {
          return Number(value) > 0;
        }
        return true;
      }
    ),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        appriseTags: data?.appriseTags,
        appriseStatelessURL: data?.appriseStatelessURL,
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
            appriseStatelessURL: values.appriseStatelessURL,
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
        setFieldError,
        validateForm,
      }) => {
        const hasTags = !!(values.appriseTags ?? '').toString().trim();
        const hasUrl = !!(values.appriseStatelessURL ?? '').toString().trim();

        return (
          <Form className="section" autoComplete="off">
            {(!hasUrl || hasTags) && (
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
                    <Field name="appriseTags">
                      {({
                        field,
                      }: {
                        field: {
                          name: string;
                          value: string | null | undefined;
                        };
                      }) => (
                        <input
                          id="appriseTags"
                          type="text"
                          autoComplete="off"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const next = e.target.value;
                            const newUrl = next.trim()
                              ? ''
                              : (values.appriseStatelessURL ?? '');
                            setFieldValue('appriseTags', next, false);
                            if (next.trim())
                              setFieldValue('appriseStatelessURL', '', false);
                            validateForm({
                              ...values,
                              appriseTags: next,
                              appriseStatelessURL: newUrl,
                            });
                          }}
                          onBlur={() => setFieldTouched('appriseTags', true)}
                        />
                      )}
                    </Field>
                  </div>
                  {errors.appriseTags &&
                    touched.appriseTags &&
                    typeof errors.appriseTags === 'string' && (
                      <div className="error">{errors.appriseTags}</div>
                    )}
                </div>
              </div>
            )}
            {(!hasTags || hasUrl) && (
              <div className="form-row">
                <label htmlFor="appriseStatelessURL" className="text-label">
                  <span className="mr-2">
                    {intl.formatMessage(messages.appriseStatelessURL)}
                    {!!data?.appriseEnabledTypes && (
                      <span className="label-required">*</span>
                    )}
                  </span>
                  <span className="label-tip">
                    {intl.formatMessage(messages.appriseStatelessURLTip)}
                  </span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field name="appriseStatelessURL">
                      {({
                        field,
                      }: {
                        field: {
                          name: string;
                          value: string | null | undefined;
                        };
                      }) => (
                        <SensitiveInput
                          id="appriseStatelessURL"
                          type="text"
                          autoComplete="off"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const next = e.target.value;
                            const newTags = next.trim()
                              ? ''
                              : (values.appriseTags ?? '');
                            setFieldValue('appriseStatelessURL', next, false);
                            if (next.trim())
                              setFieldValue('appriseTags', '', false);
                            validateForm({
                              ...values,
                              appriseStatelessURL: next,
                              appriseTags: newTags,
                            });
                          }}
                          onBlur={() =>
                            setFieldTouched('appriseStatelessURL', true)
                          }
                        />
                      )}
                    </Field>
                  </div>
                  {errors.appriseStatelessURL &&
                    touched.appriseStatelessURL &&
                    typeof errors.appriseStatelessURL === 'string' && (
                      <div className="error">{errors.appriseStatelessURL}</div>
                    )}
                </div>
              </div>
            )}
            {(hasTags || hasUrl) && (
              <div className="form-row">
                <div className="form-input-area">
                  <span className="label-tip">
                    {hasTags
                      ? 'Using Apprise Tags. Clear the Tags field to use a Stateless URL instead.'
                      : 'Using a Stateless URL. Clear the URL field to use Apprise Tags instead.'}
                  </span>
                </div>
              </div>
            )}
            <NotificationTypeSelector
              user={user}
              enabledTypes={data?.appriseEnabledTypes ?? 0}
              currentTypes={values.types}
              onUpdate={async (newTypes) => {
                const normalizedTypes = Number(newTypes) || 0;

                // Update without immediate validation, then validate once with final state
                setFieldValue('types', normalizedTypes, false);
                setFieldTouched('types', true, false);

                if (normalizedTypes === 0) {
                  setFieldError('appriseTags', undefined);
                  setFieldError('appriseStatelessURL', undefined);
                  setFieldTouched('appriseTags', false, false);
                  setFieldTouched('appriseStatelessURL', false, false);
                }

                await validateForm({
                  ...values,
                  types: normalizedTypes,
                });
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

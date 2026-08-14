import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector from '@app/components/NotificationTypeSelector';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowDownOnSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { SLACK_USER_ID_REGEX } from '@server/constants/slack';
import type { UserSettingsNotificationsResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserNotificationSettings',
  {
    slackNotificationsNotEnabled:
      'The server owner has not enabled Slack notifications. This information will only be used if the server owner configures an external service.',
    slacksettingssaved: 'Slack notification settings saved successfully!',
    slacksettingsfailed: 'Slack notification settings failed to save.',
    slackId: 'Member IDs',
    slackIdTip:
      'The <FindSlackIdLink>member ID</FindSlackIdLink> associated with your Slack account. For multiple household accounts you can add more than one Slack member ID.',
    slackIdPlaceholder: 'Slack Member ID',
    slackIdAdd: 'Add Member ID',
    slackIdRemove: 'Remove',
    validationSlackId: 'Each ID must be a valid Slack member ID',
  }
);

const UserNotificationsSlack = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user } = useUser({ id: Number(router.query.userId) });
  const { user: currentUser } = useUser();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<UserSettingsNotificationsResponse>(
    user ? `/api/v1/user/${user?.id}/settings/notifications` : null
  );

  const UserNotificationsSlackSchema = Yup.object().shape({
    slackIds: Yup.array()
      .of(
        Yup.string().matches(SLACK_USER_ID_REGEX, {
          message: intl.formatMessage(messages.validationSlackId),
          excludeEmptyString: true,
        })
      )
      .when('types', {
        is: (types: number) => !!types,
        then: (schema) =>
          schema
            .compact((value) => value === '')
            .min(1, intl.formatMessage(messages.validationSlackId)),
      }),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        slackIds: data?.slackIds ?? [''],
        types:
          (data?.slackEnabledTypes ?? 0) & (data?.notificationTypes.slack ?? 0),
      }}
      validationSchema={UserNotificationsSlackSchema}
      enableReinitialize
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/user/${user?.id}/settings/notifications`, {
            pgpKey: data?.pgpKey,
            discordIds: data?.discordIds,
            slackIds: values.slackIds,
            pushbulletAccessToken: data?.pushbulletAccessToken,
            pushoverApplicationToken: data?.pushoverApplicationToken,
            pushoverUserKey: data?.pushoverUserKey,
            telegramChatId: data?.telegramChatId,
            telegramSendSilently: data?.telegramSendSilently,
            notificationTypes: {
              slack: values.types,
            },
          });
          addToast(intl.formatMessage(messages.slacksettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch {
          addToast(intl.formatMessage(messages.slacksettingsfailed), {
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
            {!(data?.slackEnabledTypes ?? 0) && (
              <Alert
                type="warning"
                title={intl.formatMessage(
                  messages.slackNotificationsNotEnabled
                )}
              />
            )}
            <div className="form-row">
              <label className="text-label">
                {intl.formatMessage(messages.slackId)}
                {!!data?.slackEnabledTypes && (
                  <span className="label-required">*</span>
                )}
                {currentUser?.id === user?.id && (
                  <span className="label-tip">
                    {intl.formatMessage(messages.slackIdTip, {
                      FindSlackIdLink: (msg: React.ReactNode) => (
                        <a
                          href="https://slack.com/help/articles/221769328-Locate-your-Slack-URL-or-ID"
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
                <div className="space-y-2">
                  {values.slackIds.map((_id: string, index: number) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <div className="form-input-field">
                          <Field
                            name={`slackIds.${index}`}
                            type="text"
                            placeholder={intl.formatMessage(
                              messages.slackIdPlaceholder
                            )}
                          />
                        </div>
                        {Array.isArray(errors.slackIds) &&
                          errors.slackIds[index] &&
                          Array.isArray(touched.slackIds) &&
                          touched.slackIds[index] && (
                            <div className="error">
                              {errors.slackIds[index]}
                            </div>
                          )}
                      </div>
                      {values.slackIds.length > 1 && (
                        <div className="flex items-center">
                          <Button
                            buttonType="danger"
                            buttonSize="sm"
                            onClick={(event) => {
                              event.preventDefault();
                              const newIds = values.slackIds.filter(
                                (_: string, idx: number) => idx !== index
                              );
                              setFieldValue('slackIds', newIds);
                            }}
                            title={intl.formatMessage(messages.slackIdRemove)}
                          >
                            <TrashIcon />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    buttonType="default"
                    buttonSize="sm"
                    onClick={(event) => {
                      event.preventDefault();
                      setFieldValue('slackIds', [...values.slackIds, '']);
                    }}
                  >
                    <PlusIcon />
                    <span>{intl.formatMessage(messages.slackIdAdd)}</span>
                  </Button>
                </div>
                {errors.slackIds &&
                  touched.slackIds &&
                  typeof errors.slackIds === 'string' && (
                    <div className="error">{errors.slackIds}</div>
                  )}
              </div>
            </div>
            <NotificationTypeSelector
              user={user}
              enabledTypes={data?.slackEnabledTypes ?? 0}
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

export default UserNotificationsSlack;

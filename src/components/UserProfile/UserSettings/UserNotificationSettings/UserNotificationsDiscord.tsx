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
import { DISCORD_SNOWFLAKE_REGEX } from '@server/constants/discord';
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
    discordNotificationsNotEnabled:
      'The server owner has not enabled Discord notifications. This information will only be used if the server owner configures an external service.',
    discordsettingssaved: 'Discord notification settings saved successfully!',
    discordsettingsfailed: 'Discord notification settings failed to save.',
    discordId: 'User IDs',
    discordIdTip:
      'The <FindDiscordIdLink>multi-digit ID number</FindDiscordIdLink> associated with your user account. For multiple household accounts you can add more than one Discord user ID.',
    discordIdPlaceholder: 'Discord User ID',
    discordIdAdd: 'Add User ID',
    discordIdRemove: 'Remove',
    validationDiscordId: 'Each ID must be a valid Discord user ID',
  }
);

const UserNotificationsDiscord = () => {
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

  const UserNotificationsDiscordSchema = Yup.object().shape({
    discordIds: Yup.array()
      .of(
        Yup.string().matches(DISCORD_SNOWFLAKE_REGEX, {
          message: intl.formatMessage(messages.validationDiscordId),
          excludeEmptyString: true,
        })
      )
      .when('types', {
        is: (types: number) => !!types,
        then: (schema) =>
          schema
            .compact((value) => value === '')
            .min(1, intl.formatMessage(messages.validationDiscordId)),
      }),
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <Formik
      initialValues={{
        discordIds: data?.discordIds ?? [''],
        types:
          (data?.discordEnabledTypes ?? 0) &
          (data?.notificationTypes.discord ?? 0),
      }}
      validationSchema={UserNotificationsDiscordSchema}
      enableReinitialize
      onSubmit={async (values) => {
        try {
          await axios.post(`/api/v1/user/${user?.id}/settings/notifications`, {
            pgpKey: data?.pgpKey,
            discordIds: values.discordIds,
            pushbulletAccessToken: data?.pushbulletAccessToken,
            pushoverApplicationToken: data?.pushoverApplicationToken,
            pushoverUserKey: data?.pushoverUserKey,
            telegramChatId: data?.telegramChatId,
            telegramSendSilently: data?.telegramSendSilently,
            notificationTypes: {
              discord: values.types,
            },
          });
          addToast(intl.formatMessage(messages.discordsettingssaved), {
            appearance: 'success',
            autoDismiss: true,
          });
        } catch {
          addToast(intl.formatMessage(messages.discordsettingsfailed), {
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
            {!(data?.discordEnabledTypes ?? 0) && (
              <Alert
                type="warning"
                title={intl.formatMessage(
                  messages.discordNotificationsNotEnabled
                )}
              />
            )}
            <div className="form-row">
              <label className="text-label">
                {intl.formatMessage(messages.discordId)}
                {!!data?.discordEnabledTypes && (
                  <span className="label-required">*</span>
                )}
                {currentUser?.id === user?.id && (
                  <span className="label-tip">
                    {intl.formatMessage(messages.discordIdTip, {
                      FindDiscordIdLink: (msg: React.ReactNode) => (
                        <a
                          href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-"
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
                  {values.discordIds.map((_id: string, index: number) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <div className="form-input-field">
                          <Field
                            name={`discordIds.${index}`}
                            type="text"
                            placeholder={intl.formatMessage(
                              messages.discordIdPlaceholder
                            )}
                          />
                        </div>
                        {Array.isArray(errors.discordIds) &&
                          errors.discordIds[index] &&
                          Array.isArray(touched.discordIds) &&
                          touched.discordIds[index] && (
                            <div className="error">
                              {errors.discordIds[index]}
                            </div>
                          )}
                      </div>
                      {values.discordIds.length > 1 && (
                        <div className="flex items-center">
                          <Button
                            buttonType="danger"
                            buttonSize="sm"
                            onClick={(event) => {
                              event.preventDefault();
                              const newIds = values.discordIds.filter(
                                (_: string, idx: number) => idx !== index
                              );
                              setFieldValue('discordIds', newIds);
                            }}
                            title={intl.formatMessage(messages.discordIdRemove)}
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
                      setFieldValue('discordIds', [...values.discordIds, '']);
                    }}
                  >
                    <PlusIcon />
                    <span>{intl.formatMessage(messages.discordIdAdd)}</span>
                  </Button>
                </div>
                {errors.discordIds &&
                  touched.discordIds &&
                  typeof errors.discordIds === 'string' && (
                    <div className="error">{errors.discordIds}</div>
                  )}
              </div>
            </div>
            <NotificationTypeSelector
              user={user}
              enabledTypes={data?.discordEnabledTypes ?? 0}
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

export default UserNotificationsDiscord;

import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import NotificationTypeSelector, {
  ALL_NOTIFICATIONS,
} from '@app/components/NotificationTypeSelector';
import DeviceItem from '@app/components/UserProfile/UserSettings/UserNotificationSettings/UserNotificationsWebPush/DeviceItem';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/solid';
import type { UserPushSubscription } from '@server/entity/UserPushSubscription';
import type { UserSettingsNotificationsResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserNotificationSettings.UserNotificationsWebPush',
  {
    webpushsettingssaved: 'Web push notification settings saved successfully!',
    webpushsettingsfailed: 'Web push notification settings failed to save.',
    enablewebpush: 'Enable web push',
    disablewebpush: 'Disable web push',
    managedevices: 'Manage Devices',
    type: 'type',
    created: 'Created',
    device: 'Device',
    subscriptiondeleted: 'Subscription deleted.',
    subscriptiondeleteerror:
      'Something went wrong while deleting the user subscription.',
    nodevicestoshow: 'You have no web push subscriptions to show.',
    webpushhasbeenenabled: 'Web push has been enabled.',
    webpushhasbeendisabled: 'Web push has been disabled.',
    enablingwebpusherror: 'Something went wrong while enabling web push.',
    disablingwebpusherror: 'Something went wrong while disabling web push.',
  }
);

const UserWebPushSettings = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const router = useRouter();
  const { user } = useUser({ id: Number(router.query.userId) });
  const { currentSettings } = useSettings();
  const [webPushEnabled, setWebPushEnabled] = useState(false);
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<UserSettingsNotificationsResponse>(
    user ? `/api/v1/user/${user?.id}/settings/notifications` : null
  );
  const { data: dataDevices, mutate: revalidateDevices } = useSWR<
    {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent: string;
      createdAt: Date;
    }[]
  >(`/api/v1/user/${user?.id}/pushSubscriptions`, { revalidateOnMount: true });

  // Subscribes to the push manager
  // Will only add to the database if subscribing for the first time
  const enablePushNotifications = () => {
    if ('serviceWorker' in navigator && user?.id) {
      navigator.serviceWorker
        .getRegistration('/sw.js')
        .then(async (registration) => {
          if (currentSettings.enablePushRegistration) {
            const sub = await registration?.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: currentSettings.vapidPublic,
            });
            const parsedSub = JSON.parse(JSON.stringify(sub));

            if (parsedSub.keys.p256dh && parsedSub.keys.auth) {
              await axios.post('/api/v1/user/registerPushSubscription', {
                endpoint: parsedSub.endpoint,
                p256dh: parsedSub.keys.p256dh,
                auth: parsedSub.keys.auth,
                userAgent: navigator.userAgent,
              });
              setWebPushEnabled(true);
              addToast(intl.formatMessage(messages.webpushhasbeenenabled), {
                appearance: 'success',
                autoDismiss: true,
              });
            }
          }
        })
        .catch(function () {
          addToast(intl.formatMessage(messages.enablingwebpusherror), {
            autoDismiss: true,
            appearance: 'error',
          });
        })
        .finally(function () {
          revalidateDevices();
        });
    }
  };

  // Unsubscribes from the push manager
  // Deletes/disables corresponding push subscription from database
  const disablePushNotifications = async (endpoint?: string) => {
    if ('serviceWorker' in navigator && user?.id) {
      navigator.serviceWorker.getRegistration('/sw.js').then((registration) => {
        registration?.pushManager
          .getSubscription()
          .then(async (subscription) => {
            const parsedSub = JSON.parse(JSON.stringify(subscription));

            await axios.delete(
              `/api/v1/user/${user.id}/pushSubscription/${encodeURIComponent(
                endpoint ?? parsedSub.endpoint
              )}`
            );

            if (
              subscription &&
              (endpoint === parsedSub.endpoint || !endpoint)
            ) {
              subscription.unsubscribe();
              setWebPushEnabled(false);
            }
            addToast(
              intl.formatMessage(
                endpoint
                  ? messages.subscriptiondeleted
                  : messages.webpushhasbeendisabled
              ),
              {
                autoDismiss: true,
                appearance: 'success',
              }
            );
          })
          .catch(function () {
            addToast(
              intl.formatMessage(
                endpoint
                  ? messages.subscriptiondeleteerror
                  : messages.disablingwebpusherror
              ),
              {
                autoDismiss: true,
                appearance: 'error',
              }
            );
          })
          .finally(function () {
            revalidateDevices();
          });
      });
    }
  };

  // Checks our current subscription on page load
  // Will set the web push state to true if subscribed
  useEffect(() => {
    if ('serviceWorker' in navigator && user?.id) {
      navigator.serviceWorker
        .getRegistration('/sw.js')
        .then(async (registration) => {
          await registration?.pushManager
            .getSubscription()
            .then(async (subscription) => {
              if (subscription) {
                const parsedKey = JSON.parse(JSON.stringify(subscription));
                const currentUserPushSub =
                  await axios.get<UserPushSubscription>(
                    `/api/v1/user/${
                      user.id
                    }/pushSubscription/${encodeURIComponent(
                      parsedKey.endpoint
                    )}`
                  );

                if (currentUserPushSub.data.endpoint !== parsedKey.endpoint) {
                  return;
                }

                setWebPushEnabled(true);
              } else {
                setWebPushEnabled(false);
              }
            });
        })
        .catch(function (error) {
          setWebPushEnabled(false);
          // eslint-disable-next-line no-console
          console.log(
            '[SW] Failure retrieving push manager subscription, error:',
            error
          );
        });
    }
  }, [user?.id]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Formik
        initialValues={{
          types: data?.notificationTypes.webpush ?? ALL_NOTIFICATIONS,
        }}
        enableReinitialize
        onSubmit={async (values) => {
          try {
            await axios.post(
              `/api/v1/user/${user?.id}/settings/notifications`,
              {
                pgpKey: data?.pgpKey,
                discordId: data?.discordId,
                pushbulletAccessToken: data?.pushbulletAccessToken,
                pushoverApplicationToken: data?.pushoverApplicationToken,
                pushoverUserKey: data?.pushoverUserKey,
                telegramChatId: data?.telegramChatId,
                telegramSendSilently: data?.telegramSendSilently,
                notificationTypes: {
                  webpush: values.types,
                },
              }
            );
            mutate('/api/v1/settings/public');
            addToast(intl.formatMessage(messages.webpushsettingssaved), {
              appearance: 'success',
              autoDismiss: true,
            });
          } catch (e) {
            addToast(intl.formatMessage(messages.webpushsettingsfailed), {
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
                      buttonType={`${webPushEnabled ? 'danger' : 'primary'}`}
                      type="button"
                      onClick={() =>
                        webPushEnabled
                          ? disablePushNotifications()
                          : enablePushNotifications()
                      }
                    >
                      {webPushEnabled ? (
                        <CloudArrowDownIcon />
                      ) : (
                        <CloudArrowUpIcon />
                      )}
                      <span>
                        {webPushEnabled
                          ? intl.formatMessage(messages.disablewebpush)
                          : intl.formatMessage(messages.enablewebpush)}
                      </span>
                    </Button>
                  </span>
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
      <div className="mt-10 mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.managedevices)}
        </h3>
        <div className="section">
          {dataDevices?.length ? (
            dataDevices
              ?.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
              })
              .map((device, index) => (
                <div className="py-2" key={`device-list-${index}`}>
                  <DeviceItem
                    key={index}
                    disablePushNotifications={disablePushNotifications}
                    device={device}
                  />
                </div>
              ))
          ) : (
            <>
              <Alert
                title={intl.formatMessage(messages.nodevicestoshow)}
                type="info"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UserWebPushSettings;

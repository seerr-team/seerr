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
import {
  getPushSubscription,
  subscribeToPushNotifications,
  unsubscribeToPushNotifications,
  verifyPushSubscription,
} from '@app/utils/pushSubscriptionHelpers';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/solid';
import type { UserSettingsNotificationsResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { Form, Formik } from 'formik';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
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
  const [subEndpoint, setSubEndpoint] = useState<string | null>(null);
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
  const enablePushNotifications = async () => {
    try {
      const isSubscribed = await subscribeToPushNotifications(
        user?.id,
        currentSettings
      );

      if (isSubscribed) {
        localStorage.setItem('pushNotificationsEnabled', 'true');
        setWebPushEnabled(true);
        addToast(intl.formatMessage(messages.webpushhasbeenenabled), {
          appearance: 'success',
          autoDismiss: true,
        });
      } else {
        throw new Error('Subscription failed');
      }
    } catch (error) {
      addToast(intl.formatMessage(messages.enablingwebpusherror), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      revalidateDevices();
    }
  };

  // Unsubscribes from the push manager
  // Deletes/disables corresponding push subscription from database
  const disablePushNotifications = async (endpoint?: string) => {
    try {
      await unsubscribeToPushNotifications(user?.id, endpoint);

      localStorage.setItem('pushNotificationsEnabled', 'false');
      setWebPushEnabled(false);
      addToast(intl.formatMessage(messages.webpushhasbeendisabled), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch (error) {
      addToast(intl.formatMessage(messages.disablingwebpusherror), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      revalidateDevices();
    }
  };

  const deletePushSubscriptionFromBackend = async (endpoint: string) => {
    try {
      await axios.delete(
        `/api/v1/user/${user?.id}/pushSubscription/${encodeURIComponent(
          endpoint
        )}`
      );

      addToast(intl.formatMessage(messages.subscriptiondeleted), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch (error) {
      addToast(intl.formatMessage(messages.subscriptiondeleteerror), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      revalidateDevices();
    }
  };

  useEffect(() => {
    const verifyWebPush = async () => {
      const enabled = await verifyPushSubscription(user?.id, currentSettings);
      setWebPushEnabled(enabled);
    };

    if (user?.id) {
      verifyWebPush();
    }
  }, [user?.id, currentSettings]);

  useEffect(() => {
    const getSubscriptionEndpoint = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const { subscription } = await getPushSubscription();

        if (subscription) {
          setSubEndpoint(subscription.endpoint);
        } else {
          setSubEndpoint(null);
        }
      }
    };

    getSubscriptionEndpoint();
  }, [webPushEnabled]);

  const sortedDevices = useMemo(() => {
    if (!dataDevices || !subEndpoint) {
      return dataDevices;
    }

    return [...dataDevices].sort((a, b) => {
      if (a.endpoint === subEndpoint) {
        return -1;
      }
      if (b.endpoint === subEndpoint) {
        return 1;
      }

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [dataDevices, subEndpoint]);

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
          {sortedDevices?.length ? (
            sortedDevices.map((device) => (
              <div className="py-2" key={`device-list-${device.endpoint}`}>
                <DeviceItem
                  deletePushSubscriptionFromBackend={
                    deletePushSubscriptionFromBackend
                  }
                  device={device}
                  subEndpoint={subEndpoint}
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

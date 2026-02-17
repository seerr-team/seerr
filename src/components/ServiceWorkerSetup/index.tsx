/* eslint-disable no-console */

import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import { verifyAndResubscribePushSubscription } from '@app/utils/pushSubscriptionHelpers';
import { useEffect } from 'react';

const ServiceWorkerSetup = () => {
  const { user } = useUser();
  const { currentSettings } = useSettings();

  useEffect(() => {
    if ('serviceWorker' in navigator && user?.id) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (registration) => {
          console.log(
            '[SW] Registration successful, scope is:',
            registration.scope
          );

          const pushNotificationsEnabled =
            localStorage.getItem('pushNotificationsEnabled') === 'true';

          // Reset the notifications flag if permissions were revoked
          if (
            Notification.permission !== 'granted' &&
            pushNotificationsEnabled
          ) {
            localStorage.setItem('pushNotificationsEnabled', 'false');
            console.warn(
              '[SW] Push permissions not granted — skipping resubscribe'
            );

            return;
          }

          // Bypass resubscribing if we have manually disabled push notifications
          if (!pushNotificationsEnabled) {
            return;
          }

          const subscription = await registration.pushManager.getSubscription();

          console.log(
            '[SW] Existing push subscription:',
            subscription?.endpoint
          );

          const verified = await verifyAndResubscribePushSubscription(
            user.id,
            currentSettings
          );

          if (verified) {
            console.log('[SW] Push subscription verified or refreshed.');
          } else {
            console.warn(
              '[SW] Push subscription verification failed or not available.'
            );
          }
        })
        .catch(function (error) {
          console.log('[SW] Service worker registration failed, error:', error);
        });
    }
  }, [currentSettings, user]);
  return null;
};

export default ServiceWorkerSetup;

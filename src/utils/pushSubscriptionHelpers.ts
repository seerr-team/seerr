import type { UserPushSubscription } from '@server/entity/UserPushSubscription';
import type { PublicSettingsResponse } from '@server/interfaces/api/settingsInterfaces';
import axios from 'axios';

// Taken from https://www.npmjs.com/package/web-push
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);

  return outputArray;
}

export const getPushSubscription = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return { registration, subscription };
};

export const verifyPushSubscription = async (
  userId: number | undefined,
  currentSettings: PublicSettingsResponse
): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !userId) {
    return false;
  }

  try {
    const { subscription } = await getPushSubscription();

    if (!subscription) {
      return false;
    }

    const appServerKey = subscription.options?.applicationServerKey;
    if (!(appServerKey instanceof ArrayBuffer)) {
      return false;
    }

    const currentServerKey = new Uint8Array(appServerKey).toString();
    const expectedServerKey = urlBase64ToUint8Array(
      currentSettings.vapidPublic
    ).toString();

    const endpoint = subscription.endpoint;

    const { data } = await axios.get<UserPushSubscription>(
      `/api/v1/user/${userId}/pushSubscription/${encodeURIComponent(endpoint)}`
    );

    return expectedServerKey === currentServerKey && data.endpoint === endpoint;
  } catch {
    return false;
  }
};

export const verifyAndResubscribePushSubscription = async (
  userId: number | undefined,
  currentSettings: PublicSettingsResponse
): Promise<boolean> => {
  const isValid = await verifyPushSubscription(userId, currentSettings);

  if (isValid) {
    return true;
  }

  if (currentSettings.enablePushRegistration) {
    try {
      // Unsubscribe from the backend to clear the existing push subscription (keys and endpoint)
      await unsubscribeToPushNotifications(userId);

      // Subscribe again to generate a fresh push subscription with updated keys and endpoint
      await subscribeToPushNotifications(userId, currentSettings);

      return true;
    } catch (error) {
      throw new Error(`[SW] Resubscribe failed: ${error.message}`);
    }
  }

  return false;
};

export const subscribeToPushNotifications = async (
  userId: number | undefined,
  currentSettings: PublicSettingsResponse
) => {
  if (
    !('serviceWorker' in navigator) ||
    !userId ||
    !currentSettings.enablePushRegistration
  ) {
    return false;
  }

  try {
    const { registration } = await getPushSubscription();

    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: currentSettings.vapidPublic,
    });

    const { endpoint, keys } = subscription.toJSON();

    if (keys?.p256dh && keys?.auth) {
      await axios.post('/api/v1/user/registerPushSubscription', {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });

      return true;
    }

    return false;
  } catch (error) {
    throw new Error(
      `Issue subscribing to push notifications: ${error.message}`
    );
  }
};

export const unsubscribeToPushNotifications = async (
  userId: number | undefined,
  endpoint?: string
) => {
  if (!('serviceWorker' in navigator) || !userId) {
    return;
  }

  try {
    const { subscription } = await getPushSubscription();

    if (!subscription) {
      return false;
    }

    const { endpoint: currentEndpoint } = subscription.toJSON();

    if (!endpoint || endpoint === currentEndpoint) {
      await subscription.unsubscribe();
      return true;
    }
  } catch (error) {
    throw new Error(
      `Issue unsubscribing to push notifications: ${error.message}`
    );
  }
};

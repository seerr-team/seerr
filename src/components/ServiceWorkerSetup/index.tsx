/* eslint-disable no-console */

import { useUser } from '@app/hooks/useUser';
import { useEffect } from 'react';

const ServiceWorkerSetup = () => {
  const { user } = useUser();
  useEffect(() => {
    if ('serviceWorker' in navigator && user?.id) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (registration) => {
          console.log(
            '[SW] Registration successful, scope is:',
            registration.scope
          );
        })
        .catch(function (error) {
          console.log('[SW] Service worker registration failed, error:', error);
        });
    }
  }, [user]);
  return null;
};

export default ServiceWorkerSetup;

import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import LoginError from '@app/components/Login/ErrorCallout';
import defineMessages from '@app/utils/defineMessages';
import { processCallback } from '@app/utils/oidc';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Login', {
  loginerror: 'Something went wrong while trying to sign in.',
  backtologin: 'Back to Login',
});

const OidcCallback = () => {
  const router = useRouter();
  const intl = useIntl();

  const { slug } = router.query as { slug: string };

  const login = async () => {
    const params = new URLSearchParams(window.location.search);
    const result = await processCallback(params, slug);

    // is popup window
    if (window.opener && window.opener !== window) {
      // send result to the opening window
      window.opener.postMessage(
        result,
        `${window.location.protocol}//${window.location.host}`
      );
      // close the popup
      window.close();
    } else {
      if (result.type === 'success') {
        // redirect to homepage
        router.push(result.message?.to ?? '/');
      } else {
        // display login error
        setError(result.message);
      }
    }
  };

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto flex h-screen items-center justify-center">
      {error != null ? (
        <div className="flex flex-col items-center">
          <h2 className="mb-4 text-lg text-white">
            {intl.formatMessage(messages.loginerror)}
          </h2>
          <LoginError error={error}></LoginError>
          <Link href="/login" className="text-indigo-500">
            ←{' '}
            <span className="hover:underline">
              {intl.formatMessage(messages.backtologin)}
            </span>
          </Link>
        </div>
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
};

export default OidcCallback;

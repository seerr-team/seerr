import defineMessages from '@app/utils/defineMessages';
import { processCallback } from '@app/utils/oidc';
import type { PublicOidcProvider } from '@server/lib/settings';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import LoginButton from './LoginButton';

const messages = defineMessages('components.Login', {
  oidcLoginError: 'An error occurred while logging in with {provider}.',
});

type OidcLoginButtonProps = {
  provider: PublicOidcProvider;
  onError?: (message: string) => void;
};

export default function OidcLoginButton({
  provider,
  onError,
}: OidcLoginButtonProps) {
  const intl = useIntl();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const redirectToLogin = useCallback(async () => {
    let redirectUrl: string;
    try {
      const res = await fetch(`/api/v1/auth/oidc/login/${provider.slug}`);
      if (res.ok) {
        const data = await res.json();
        redirectUrl = data.redirectUrl;
      } else {
        throw new Error();
      }
    } catch (e) {
      setLoading(false);
      onError?.(
        intl.formatMessage(messages.oidcLoginError, {
          provider: provider.name,
        })
      );
      return;
    }

    window.location.href = redirectUrl;
  }, [provider, intl, onError]);

  const handleCallback = useCallback(async () => {
    const result = await processCallback(searchParams, provider.slug);
    if (result.type === 'success') {
      // redirect to homepage
      router.push(result.message?.to ?? '/');
    } else {
      setLoading(false);
      onError?.(
        intl.formatMessage(messages.oidcLoginError, {
          provider: provider.name,
        })
      );
    }
  }, [provider, searchParams, intl, onError, router]);

  useEffect(() => {
    if (loading) return;
    const isCallback = searchParams.get('callback') === 'true';
    const providerSlug = searchParams.get('provider');

    if (providerSlug === provider.slug) {
      setLoading(true);
      if (isCallback) handleCallback();
      else redirectToLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoginButton loading={loading} onClick={() => redirectToLogin()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={provider.logo || '/images/openid.svg'}
        alt={provider.name}
        className="mr-2 max-h-5 w-5"
      />
      <span>{provider.name}</span>
    </LoginButton>
  );
}

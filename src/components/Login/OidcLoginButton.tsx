import {
  clearOidcProviderSlug,
  getOidcErrorMessage,
  getOidcProviderSlug,
  initiateOidcLogin,
  processOidcCallback,
} from '@app/utils/oidc';
import type { PublicOidcProvider } from '@server/lib/settings';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import LoginButton from './LoginButton';

type OidcLoginButtonProps = {
  provider: PublicOidcProvider;
  onError?: (message: string) => void;
};

export default function OidcLoginButton({
  provider,
  onError,
}: OidcLoginButtonProps) {
  const intl = useIntl();
  const router = useRouter();
  const { query } = router;

  const [loading, setLoading] = useState(false);

  const redirectToLogin = useCallback(async () => {
    setLoading(true);
    try {
      await initiateOidcLogin(provider.slug, window.location.href);
    } catch (e) {
      setLoading(false);
      const errorCode = (e as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      onError?.(getOidcErrorMessage(errorCode, provider.name, intl));
    }
  }, [provider, intl, onError]);

  const handleCallback = useCallback(async () => {
    setLoading(true);
    const result = await processOidcCallback(provider.slug);
    if (result.type === 'success') {
      router.push('/');
    } else {
      router.replace('/login');
      setLoading(false);
      onError?.(getOidcErrorMessage(result.errorCode, provider.name, intl));
    }
  }, [provider, intl, onError, router]);

  useEffect(() => {
    if (loading) return;

    if (query.code != null && getOidcProviderSlug() === provider.slug) {
      clearOidcProviderSlug();
      // OIDC provider has redirected back with an authorization code
      handleCallback();
    } else if (query.code == null && query.provider === provider.slug) {
      // Support direct redirect via ?provider=slug query param
      redirectToLogin();
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
      <span className="min-w-0 truncate">{provider.name}</span>
    </LoginButton>
  );
}

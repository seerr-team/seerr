import defineMessages from '@app/utils/defineMessages';
import type { PublicOidcProvider } from '@server/lib/settings';
import axios, { isAxiosError } from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import LoginButton from './LoginButton';

const messages = defineMessages('components.Login', {
  oidcLoginError: 'An error occurred while logging in with {provider}.',
});

async function processCallback(params: URLSearchParams, provider: string) {
  const url = new URL(
    `/api/v1/auth/oidc/callback/${encodeURIComponent(provider)}`,
    window.location.origin
  );
  url.search = params.toString();

  try {
    const res = await axios.get(url.toString());

    return {
      type: 'success',
      message: res.data,
    };
  } catch (e) {
    if (isAxiosError(e) && e.response?.data?.message) {
      return { type: 'error', message: e.response.data.message };
    }

    return {
      type: 'error',
      message: e.message,
    };
  }
}

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
    try {
      const res = await axios.get<{ redirectUrl: string }>(
        `/api/v1/auth/oidc/login/${provider.slug}`
      );
      window.location.href = res.data.redirectUrl;
    } catch (e) {
      setLoading(false);
      onError?.(
        intl.formatMessage(messages.oidcLoginError, {
          provider: provider.name,
        })
      );
    }
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

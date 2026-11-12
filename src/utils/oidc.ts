import defineMessages from '@app/utils/defineMessages';
import { ApiErrorCode } from '@server/constants/error';
import axios, { isAxiosError } from 'axios';
import type { IntlShape } from 'react-intl';

const messages = defineMessages('utils.oidc', {
  oidcLoginError: 'An error occurred while logging in with {provider}.',
  oidcProviderDiscoveryFailed:
    'Failed to connect to {provider}. Please try again later.',
  oidcAuthorizationFailed:
    'Authorization with {provider} failed. Please try again.',
  oidcMissingEmail:
    'Unable to create account. No email address was provided by {provider}.',
  oidcUnauthorized: 'You do not have permission to sign in with {provider}.',
  oidcAccountAlreadyLinked:
    'This {provider} account is already linked to another user.',
});

const OIDC_PROVIDER_KEY = 'oidc-provider';

export function getOidcErrorMessage(
  errorCode: string | undefined,
  providerName: string,
  intl: IntlShape
): string {
  const values = { provider: providerName };
  switch (errorCode) {
    case ApiErrorCode.OidcProviderDiscoveryFailed:
      return intl.formatMessage(messages.oidcProviderDiscoveryFailed, values);
    case ApiErrorCode.OidcAuthorizationFailed:
      return intl.formatMessage(messages.oidcAuthorizationFailed, values);
    case ApiErrorCode.OidcMissingEmail:
      return intl.formatMessage(messages.oidcMissingEmail, values);
    case ApiErrorCode.OidcAccountAlreadyLinked:
      return intl.formatMessage(messages.oidcAccountAlreadyLinked, values);
    case ApiErrorCode.Unauthorized:
      return intl.formatMessage(messages.oidcUnauthorized, values);
    default:
      return intl.formatMessage(messages.oidcLoginError, values);
  }
}

/**
 * Initiates the OIDC login flow by fetching the authorization URL from the
 * server and redirecting the browser to the OIDC provider. Stores the provider
 * slug in sessionStorage so the callback page can identify which provider is
 * completing the flow.
 */
export async function initiateOidcLogin(
  providerSlug: string,
  returnUrl: string
): Promise<void> {
  const res = await axios.get<{ redirectUrl: string }>(
    `/api/v1/auth/oidc/login/${encodeURIComponent(providerSlug)}`,
    { params: { returnUrl } }
  );
  sessionStorage.setItem(OIDC_PROVIDER_KEY, providerSlug);
  window.location.href = res.data.redirectUrl;
}

/**
 * Returns the provider slug stored by initiateOidcLogin.
 */
export function getOidcProviderSlug(): string | null {
  return sessionStorage.getItem(OIDC_PROVIDER_KEY);
}

/**
 * Clears the provider slug stored by initiateOidcLogin.
 */
export function clearOidcProviderSlug(): void {
  sessionStorage.removeItem(OIDC_PROVIDER_KEY);
}

/**
 * Processes the OIDC authorization code callback by posting the current URL
 * (which contains the code and any state params) to the server.
 */
export async function processOidcCallback(
  providerSlug: string
): Promise<
  { type: 'success' } | { type: 'error'; errorCode: string | undefined }
> {
  const params = new URLSearchParams(window.location.search);
  const errorParam = params.get('error');
  if (errorParam != null) {
    return { type: 'error', errorCode: ApiErrorCode.OidcAuthorizationFailed };
  }

  try {
    await axios.post(
      `/api/v1/auth/oidc/callback/${encodeURIComponent(providerSlug)}`,
      { callbackUrl: window.location.href }
    );
    return { type: 'success' };
  } catch (e) {
    return {
      type: 'error',
      errorCode: isAxiosError(e) ? e.response?.data?.error : undefined,
    };
  }
}

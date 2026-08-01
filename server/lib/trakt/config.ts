import type {
  TraktAllowedOrigin,
  TraktPublicSettings,
} from '@server/interfaces/api/traktInterfaces';
import type { TraktSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';

const TRAKT_CALLBACK_PATH = '/api/v1/auth/trakt/callback';

const toOrigin = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

/**
 * Admits one extra origin for local work. Ignored in production so a deployed allowlist
 * cannot be widened by the environment.
 */
const getDevelopmentOrigin = (): string | null => {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return toOrigin(process.env.TRAKT_DEV_ORIGIN);
};

const getCanonicalTraktOrigin = (): string | null =>
  getDevelopmentOrigin() ?? toOrigin(getSettings().main.applicationUrl);

export const getAllowedTraktOrigins = (): TraktAllowedOrigin[] => {
  const origins = new Set<string>();

  const applicationOrigin = toOrigin(getSettings().main.applicationUrl);
  if (applicationOrigin) {
    origins.add(applicationOrigin);
  }

  const developmentOrigin = getDevelopmentOrigin();
  if (developmentOrigin) {
    origins.add(developmentOrigin);
  }

  return [...origins];
};

export const isAllowedTraktOrigin = (
  origin: string
): origin is TraktAllowedOrigin => getAllowedTraktOrigins().includes(origin);

/**
 * Trakt requires an identical `redirect_uri` on authorize and on every later token call,
 * so this is resolved from configuration rather than from the request in flight.
 */
export const getTraktCallbackUrl = (): string | null => {
  const origin = getCanonicalTraktOrigin();

  return origin ? `${origin}${TRAKT_CALLBACK_PATH}` : null;
};

export const requireTraktCallbackUrl = (): string => {
  const callbackUrl = getTraktCallbackUrl();

  if (!callbackUrl) {
    throw new Error(
      'Trakt requires a valid Application URL to be configured in Seerr settings'
    );
  }

  return callbackUrl;
};

export const isTraktConfigured = (settings: TraktSettings): boolean =>
  settings.clientId.trim().length > 0 && settings.clientSecret.length > 0;

export const getSafeTraktSettings = (
  settings: TraktSettings
): TraktPublicSettings => ({
  clientId: settings.clientId,
  clientSecretConfigured: settings.clientSecret.length > 0,
  callbackUrl: getTraktCallbackUrl(),
});

import type {
  IdTokenClaims,
  OidcProviderMetadata,
  OidcStandardClaims,
  OidcTokenResponse,
} from '@server/interfaces/api/oidcInterfaces';
import type { OidcProvider } from '@server/lib/settings';
import type { Request } from 'express';
import * as yup from 'yup';

/** Fetch the issuer configuration from the OpenID Connect Discovery endpoint */
export async function getOpenIdConfiguration(domain: string) {
  // remove trailing slash from url if it exists and add /.well-known/openid-configuration path
  const wellKnownUrl = new URL(
    domain.replace(/\/$/, '') + '/.well-known/openid-configuration'
  ).toString();

  const wellKnownInfo: OidcProviderMetadata = await fetch(wellKnownUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((r) => r.json());

  return wellKnownInfo;
}

function getOpenIdCallbackUrl(req: Request, provider: OidcProvider) {
  const callbackUrl = new URL(
    `/login`,
    `${req.protocol}://${req.headers.host}`
  );
  callbackUrl.searchParams.set('provider', provider.slug);
  callbackUrl.searchParams.set('callback', 'true');
  return callbackUrl.toString();
}

/** Generate authentication request url */
export async function getOpenIdRedirectUrl(
  req: Request,
  provider: OidcProvider,
  state: string
) {
  const wellKnownInfo = await getOpenIdConfiguration(provider.issuerUrl);
  const url = new URL(wellKnownInfo.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);

  url.searchParams.set('redirect_uri', getOpenIdCallbackUrl(req, provider));
  url.searchParams.set('scope', provider.scopes ?? 'openid profile email');
  url.searchParams.set('state', state);
  return url.toString();
}

/** Exchange authorization code for token data */
export async function fetchOpenIdTokenData(
  req: Request,
  provider: OidcProvider,
  wellKnownInfo: OidcProviderMetadata,
  code: string
): Promise<OidcTokenResponse> {
  const formData = new URLSearchParams();
  formData.append('client_secret', provider.clientSecret);
  formData.append('grant_type', 'authorization_code');
  formData.append('redirect_uri', getOpenIdCallbackUrl(req, provider));
  formData.append('client_id', provider.clientId);
  formData.append('code', code);

  return await fetch(wellKnownInfo.token_endpoint, {
    method: 'POST',
    body: formData,
  }).then((r) => r.json());
}

export async function getOpenIdUserInfo(
  wellKnownInfo: OidcProviderMetadata,
  authToken: string
) {
  return fetch(wellKnownInfo.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/json',
    },
  }).then((r) => r.json());
}

class OidcAuthorizationError extends Error {}

class OidcMissingKeyError extends OidcAuthorizationError {
  constructor(public userInfo: FullUserInfo, public key: string) {
    super(`Key ${key} was missing on OIDC userinfo but was expected.`);
  }
}

type PrimitiveString = 'string' | 'boolean';
type TypeFromName<T extends PrimitiveString> = T extends 'string'
  ? string
  : T extends 'boolean'
  ? boolean
  : unknown;

export function tryGetUserInfoKey<T extends PrimitiveString>(
  userInfo: FullUserInfo,
  key: string,
  expectedType: T
): TypeFromName<T> {
  if (!Object.hasOwn(userInfo, key) || typeof userInfo[key] !== expectedType) {
    throw new OidcMissingKeyError(userInfo, key);
  }

  return userInfo[key] as TypeFromName<T>;
}

export function validateUserClaims(
  userInfo: FullUserInfo,
  requiredClaims: string[]
) {
  requiredClaims.some((claim) => {
    const value = tryGetUserInfoKey(userInfo, claim, 'boolean');
    if (!value)
      throw new OidcAuthorizationError('User was missing a required claim.');
  });
}

/** Generates a schema to validate ID token JWT and userinfo claims */
export const createIdTokenSchema = ({
  oidcDomain,
  oidcClientId,
  requiredClaims,
}: {
  oidcDomain: string;
  oidcClientId: string;
  requiredClaims: string[];
}) => {
  return yup.object().shape({
    iss: yup
      .string()
      .oneOf(
        [oidcDomain, `${oidcDomain}/`],
        `The token iss value doesn't match the oidc_DOMAIN (${oidcDomain})`
      )
      .required("The token didn't come with an iss value."),
    aud: yup.lazy((val) => {
      // single audience
      if (typeof val === 'string')
        return yup
          .string()
          .oneOf(
            [oidcClientId],
            `The token aud value doesn't match the oidc_CLIENT_ID (${oidcClientId})`
          )
          .required("The token didn't come with an aud value.");
      // several audiences
      if (typeof val === 'object' && Array.isArray(val))
        return yup
          .array()
          .of(yup.string())
          .test(
            'contains-client-id',
            `The token aud value doesn't contain the oidc_CLIENT_ID (${oidcClientId})`,
            (value) => !!(value && value.includes(oidcClientId))
          );
      // invalid type
      return yup
        .mixed()
        .typeError('The token aud value is not a string or array.');
    }),
    exp: yup
      .number()
      .required()
      .test(
        'is_before_date',
        'Token exp value is before current time.',
        (value) => {
          if (!value) return false;
          if (value < Math.ceil(Date.now() / 1000)) return false;
          return true;
        }
      ),
    iat: yup
      .number()
      .required()
      .test(
        'is_before_one_day',
        'Token was issued before one day ago and is now invalid.',
        (value) => {
          if (!value) return false;
          const date = new Date();
          date.setDate(date.getDate() - 1);
          if (value < Math.ceil(Number(date) / 1000)) return false;
          return true;
        }
      ),
    // TODO: only require this for new user login
    email: yup.string().required(),
    // ensure all required claims are present and are booleans
    ...requiredClaims.reduce(
      (a, v) => ({ ...a, [v]: yup.boolean().required() }),
      {}
    ),
  });
};

export type FullUserInfo = IdTokenClaims & OidcStandardClaims;

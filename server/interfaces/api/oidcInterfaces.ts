/**
 * @internal
 */
type Mandatory<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

/**
 * Standard OpenID Connect discovery document.
 *
 * @public
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export interface OidcProviderMetadata {
  issuer: string; // REQUIRED

  authorization_endpoint: string; // REQUIRED

  token_endpoint: string; // REQUIRED

  token_endpoint_auth_methods_supported?: string[]; // OPTIONAL

  token_endpoint_auth_signing_alg_values_supported?: string[]; // OPTIONAL

  userinfo_endpoint: string; // RECOMMENDED

  check_session_iframe: string; // REQUIRED

  end_session_endpoint: string; // REQUIRED

  jwks_uri: string; // REQUIRED

  registration_endpoint: string; // RECOMMENDED

  scopes_supported: string[]; // RECOMMENDED

  response_types_supported: string[]; // REQUIRED

  acr_values_supported?: string[]; // OPTIONAL

  subject_types_supported: string[]; // REQUIRED

  request_object_signing_alg_values_supported?: string[]; // OPTIONAL

  display_values_supported?: string[]; // OPTIONAL

  claim_types_supported?: string[]; // OPTIONAL

  claims_supported: string[]; // RECOMMENDED

  claims_parameter_supported?: boolean; // OPTIONAL

  service_documentation?: string; // OPTIONAL

  ui_locales_supported?: string[]; // OPTIONAL

  revocation_endpoint: string; // REQUIRED

  introspection_endpoint: string; // REQUIRED

  frontchannel_logout_supported?: boolean; // OPTIONAL

  frontchannel_logout_session_supported?: boolean; // OPTIONAL

  backchannel_logout_supported?: boolean; // OPTIONAL

  backchannel_logout_session_supported?: boolean; // OPTIONAL

  grant_types_supported?: string[]; // OPTIONAL

  response_modes_supported?: string[]; // OPTIONAL

  code_challenge_methods_supported?: string[]; // OPTIONAL
}

/**
 * Standard OpenID Connect address claim.
 * The Address Claim represents a physical mailing address.
 *
 * @public
 * @see https://openid.net/specs/openid-connect-core-1_0.html#AddressClaim
 */
export interface OidcAddressClaim {
  /** Full mailing address, formatted for display or use on a mailing label. This field MAY contain multiple lines, separated by newlines. Newlines can be represented either as a carriage return/line feed pair ("\\r\\n") or as a single line feed character ("\\n"). */
  formatted?: string;
  /** Full street address component, which MAY include house number, street name, Post Office Box, and multi-line extended street address information. This field MAY contain multiple lines, separated by newlines. Newlines can be represented either as a carriage return/line feed pair ("\\r\\n") or as a single line feed character ("\\n"). */
  street_address?: string;
  /** City or locality component. */
  locality?: string;
  /** State, province, prefecture, or region component. */
  region?: string;
  /** Zip code or postal code component. */
  postal_code?: string;
  /** Country name component. */
  country?: string;
}

/**
 * Standard OpenID Connect claims.
 * They can be requested to be returned either in the UserInfo Response or in the ID Token.
 *
 * @public
 * @see https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
 */
export interface OidcStandardClaims {
  /** Subject - Identifier for the End-User at the Issuer. */
  sub?: string;
  /** End-User's full name in displayable form including all name parts, possibly including titles and suffixes, ordered according to the End-User's locale and preferences. */
  name?: string;
  /** Given name(s) or first name(s) of the End-User. Note that in some cultures, people can have multiple given names; all can be present, with the names being separated by space characters. */
  given_name?: string;
  /** Surname(s) or last name(s) of the End-User. Note that in some cultures, people can have multiple family names or no family name; all can be present, with the names being separated by space characters. */
  family_name?: string;
  /** Middle name(s) of the End-User. Note that in some cultures, people can have multiple middle names; all can be present, with the names being separated by space characters. Also note that in some cultures, middle names are not used. */
  middle_name?: string;
  /** Casual name of the End-User that may or may not be the same as the given_name. For instance, a nickname value of Mike might be returned alongside a given_name value of Michael. */
  nickname?: string;
  /** Shorthand name by which the End-User wishes to be referred to at the RP, such as janedoe or j.doe. This value MAY be any valid JSON string including special characters such as \@, /, or whitespace. */
  preferred_username?: string;
  /** URL of the End-User's profile page. The contents of this Web page SHOULD be about the End-User. */
  profile?: string;
  /** URL of the End-User's profile picture. This URL MUST refer to an image file (for example, a PNG, JPEG, or GIF image file), rather than to a Web page containing an image. Note that this URL SHOULD specifically reference a profile photo of the End-User suitable for displaying when describing the End-User, rather than an arbitrary photo taken by the End-User. */
  picture?: string;
  /** URL of the End-User's Web page or blog. This Web page SHOULD contain information published by the End-User or an organization that the End-User is affiliated with. */
  website?: string;
  /** End-User's preferred e-mail address. Its value MUST conform to the RFC 5322 addr-spec syntax. */
  email?: string;
  /** True if the End-User's e-mail address has been verified; otherwise false. When this Claim Value is true, this means that the OP took affirmative steps to ensure that this e-mail address was controlled by the End-User at the time the verification was performed. The means by which an e-mail address is verified is context-specific, and dependent upon the trust framework or contractual agreements within which the parties are operating. */
  email_verified?: boolean;
  /** End-User's gender. Values defined by this specification are female and male. Other values MAY be used when neither of the defined values are applicable. */
  gender?: string;
  /** End-User's birthday, represented as an ISO 8601:2004 [ISO8601‑2004] YYYY-MM-DD format. The year MAY be 0000, indicating that it is omitted. To represent only the year, YYYY format is allowed. Note that depending on the underlying platform's date related function, providing just year can result in varying month and day, so the implementers need to take this factor into account to correctly process the dates. */
  birthdate?: string;
  /** String from zoneinfo [zoneinfo] time zone database representing the End-User's time zone. For example, Europe/Paris or America/Los_Angeles. */
  zoneinfo?: string;
  /** End-User's locale, represented as a BCP47 [RFC5646] language tag. This is typically an ISO 639-1 Alpha-2 [ISO639‑1] language code in lowercase and an ISO 3166-1 Alpha-2 [ISO3166‑1] country code in uppercase, separated by a dash. For example, en-US or fr-CA. As a compatibility note, some implementations have used an underscore as the separator rather than a dash, for example, en_US; */
  locale?: string;
  /** End-User's preferred telephone number. E.164 [E.164] is RECOMMENDED as the format of this Claim, for example, +1 (425) 555-1212 or +56 (2) 687 2400. If the phone number contains an extension, it is RECOMMENDED that the extension be represented using the RFC 3966 [RFC3966] extension syntax, for example, +1 (604) 555-1234;ext=5678. */
  phone_number?: string;
  /** True if the End-User's phone number has been verified; otherwise false. When this Claim Value is true, this means that the OP took affirmative steps to ensure that this phone number was controlled by the End-User at the time the verification was performed. The means by which a phone number is verified is context-specific, and dependent upon the trust framework or contractual agreements within which the parties are operating. When true, the phone_number Claim MUST be in E.164 format and any extensions MUST be represented in RFC 3966 format. */
  phone_number_verified?: boolean;
  /** End-User's preferred postal address. The value of the address member is a JSON [RFC4627] structure containing some or all of the members defined in Section 5.1.1. */
  address?: OidcAddressClaim;
  /** Time the End-User's information was last updated. Its value is a JSON number representing the number of seconds from 1970-01-01T0:0:0Z as measured in UTC until the date/time. */
  updated_at?: number;
}

/**
 * Standard JWT claims.
 *
 * @public
 * @see https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
 */
export interface JwtClaims {
  [claim: string]: unknown;

  /** The "iss" (issuer) claim identifies the principal that issued the JWT. The processing of this claim is generally application specific. The "iss" value is a case-sensitive string containing a StringOrURI value. */
  iss?: string;
  /** The "sub" (subject) claim identifies the principal that is the subject of the JWT. The claims in a JWT are normally statements about the subject. The subject value MUST either be scoped to be locally unique in the context of the issuer or be globally unique. The processing of this claim is generally application specific. The "sub" value is a case-sensitive string containing a StringOrURI value. */
  sub?: string;
  /** The "aud" (audience) claim identifies the recipients that the JWT is intended for. Each principal intended to process the JWT MUST identify itself with a value in the audience claim. If the principal processing the claim does not identify itself with a value in the "aud" claim when this claim is present, then the JWT MUST be rejected. In the general case, the "aud" value is an array of case-sensitive strings, each containing a StringOrURI value. In the special case when the JWT has one audience, the "aud" value MAY be a single case-sensitive string containing a StringOrURI value. The interpretation of audience values is generally application specific. */
  aud?: string | string[];
  /** The "exp" (expiration time) claim identifies the expiration time on or after which the JWT MUST NOT be accepted for processing. The processing of the "exp" claim requires that the current date/time MUST be before the expiration date/time listed in the "exp" claim. Implementers MAY provide for some small leeway, usually no more than a few minutes, to account for clock skew. Its value MUST be a number containing a NumericDate value. */
  exp?: number;
  /** The "nbf" (not before) claim identifies the time before which the JWT MUST NOT be accepted for processing. The processing of the "nbf" claim requires that the current date/time MUST be after or equal to the not-before date/time listed in the "nbf" claim. Implementers MAY provide for some small leeway, usually no more than a few minutes, to account for clock skew. Its value MUST be a number containing a NumericDate value. */
  nbf?: number;
  /** The "iat" (issued at) claim identifies the time at which the JWT was issued. This claim can be used to determine the age of the JWT. Its value MUST be a number containing a NumericDate value. */
  iat?: number;
  /** The "jti" (JWT ID) claim provides a unique identifier for the JWT. The identifier value MUST be assigned in a manner that ensures that there is a negligible probability that the same value will be accidentally assigned to a different data object; if the application uses multiple issuers, collisions MUST be prevented among values produced by different issuers as well. The "jti" claim can be used to prevent the JWT from being replayed. The "jti" value is a case-sensitive string. */
  jti?: string;
}

/**
 * Standard ID Token claims.
 *
 * @public
 * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
 */
export interface IdTokenClaims
  extends Mandatory<OidcStandardClaims, 'sub'>,
    Mandatory<JwtClaims, 'iss' | 'sub' | 'aud' | 'exp' | 'iat'> {
  [claim: string]: unknown;

  /** Time when the End-User authentication occurred. Its value is a JSON number representing the number of seconds from 1970-01-01T0:0:0Z as measured in UTC until the date/time. When a max_age request is made or when auth_time is requested as an Essential Claim, then this Claim is REQUIRED; otherwise, its inclusion is OPTIONAL. (The auth_time Claim semantically corresponds to the OpenID 2.0 PAPE [OpenID.PAPE] auth_time response parameter.) */
  auth_time?: number;
  /** String value used to associate a Client session with an ID Token, and to mitigate replay attacks. The value is passed through unmodified from the Authentication Request to the ID Token. If present in the ID Token, Clients MUST verify that the nonce Claim Value is equal to the value of the nonce parameter sent in the Authentication Request. If present in the Authentication Request, Authorization Servers MUST include a nonce Claim in the ID Token with the Claim Value being the nonce value sent in the Authentication Request. Authorization Servers SHOULD perform no other processing on nonce values used. The nonce value is a case sensitive string. */
  nonce?: string;
  /** Authentication Context Class Reference. String specifying an Authentication Context Class Reference value that identifies the Authentication Context Class that the authentication performed satisfied. The value "0" indicates the End-User authentication did not meet the requirements of ISO/IEC 29115 [ISO29115] level 1. Authentication using a long-lived browser cookie, for instance, is one example where the use of "level 0" is appropriate. Authentications with level 0 SHOULD NOT be used to authorize access to any resource of any monetary value. (This corresponds to the OpenID 2.0 PAPE [OpenID.PAPE] nist_auth_level 0.) An absolute URI or an RFC 6711 [RFC6711] registered name SHOULD be used as the acr value; registered names MUST NOT be used with a different meaning than that which is registered. Parties using this claim will need to agree upon the meanings of the values used, which may be context-specific. The acr value is a case sensitive string. */
  acr?: string;
  /** Authentication Methods References. JSON array of strings that are identifiers for authentication methods used in the authentication. For instance, values might indicate that both password and OTP authentication methods were used. The definition of particular values to be used in the amr Claim is beyond the scope of this specification. Parties using this claim will need to agree upon the meanings of the values used, which may be context-specific. The amr value is an array of case sensitive strings. */
  amr?: unknown;
  /** Authorized party - the party to which the ID Token was issued. If present, it MUST contain the OAuth 2.0 Client ID of this party. This Claim is only needed when the ID Token has a single audience value and that audience is different than the authorized party. It MAY be included even when the authorized party is the same as the sole audience. The azp value is a case sensitive string containing a StringOrURI value. */
  azp?: string;
  /**
   * Session ID - String identifier for a Session. This represents a Session of a User Agent or device for a logged-in End-User at an RP. Different sid values are used to identify distinct sessions at an OP. The sid value need only be unique in the context of a particular issuer. Its contents are opaque to the RP. Its syntax is the same as an OAuth 2.0 Client Identifier.
   * @see https://openid.net/specs/openid-connect-frontchannel-1_0.html#OPLogout
   * */
  sid?: string;
}

type OidcTokenSuccessResponse = {
  /**
   * REQUIRED. ID Token value associated with the authenticated session.
   *
   * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
   */
  id_token: string;
  /**
   * REQUIRED. The access token issued by the authorization server.
   */
  access_token: string;
  /**
   * REQUIRED.  The type of the token issued as described in
   * Section 7.1.  Value is case insensitive.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc6749#section-7.1
   */
  token_type: string;
  /**
   * RECOMMENDED.  The lifetime in seconds of the access token.  For
   * example, the value "3600" denotes that the access token will
   * expire in one hour from the time the response was generated.
   * If omitted, the authorization server SHOULD provide the
   * expiration time via other means or document the default value.
   */
  expires_in?: number;
};

type OidcTokenErrorResponse = {
  error: string;
};

/**
 * Standard response from the OpenID Connect token request endpoint.
 *
 * @public
 * @see https://openid.net/specs/openid-connect-core-1_0.html#TokenResponse
 */
export type OidcTokenResponse =
  | OidcTokenSuccessResponse
  | OidcTokenErrorResponse;

import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tooltip from '@app/components/Common/Tooltip';
import SettingsBadge from '@app/components/Settings/SettingsBadge';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ForwardAuthAllowlist } from '@app/utils/forwardAuthList';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import type { NetworkSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { Address4, Address6 } from 'ip-address';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings.SettingsNetwork', {
  toastSettingsSuccess: 'Settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
  network: 'Network',
  networksettings: 'Network Settings',
  networksettingsDescription:
    'Configure network settings for your Seerr instance.',
  csrfProtection: 'Enable CSRF Protection',
  csrfProtectionTip: 'Set external API access to read-only (requires HTTPS)',
  csrfProtectionHoverTip:
    'Do NOT enable this setting unless you understand what you are doing!',
  trustProxy: 'Enable Proxy Support',
  trustProxyTip:
    'Allow Seerr to correctly register client IP addresses behind a proxy',
  trustedProxies: 'Trusted Proxies',
  forwardAuthEnabled: 'Enable Proxy Forward Authentication',
  forwardAuthEnabledTip:
    'Authenticate as the user specified by the header. Only enable when secured behind a trusted proxy.',
  userHeaderName: 'User Header Name',
  userHeaderNameTip: 'Matched against Jellyfin or Plex Username',
  emailHeaderName: 'Email Header Name',
  emailHeaderNameTip: 'Matched against email',
  proxyEnabled: 'HTTP(S) Proxy',
  proxyEnabledTip:
    'Send ALL outgoing HTTP/HTTPS requests through a proxy server (host/port). Does NOT enable HTTPS, SSL, or certificate configuration.',
  proxyHostname: 'Proxy Hostname',
  proxyPort: 'Proxy Port',
  proxySsl: 'Use SSL For Proxy',
  proxyUser: 'Proxy Username',
  proxyPassword: 'Proxy Password',
  proxyBypassFilter: 'Proxy Ignored Addresses',
  proxyBypassFilterTip:
    "Use ',' as a separator, and '*.' as a wildcard for subdomains",
  proxyBypassLocalAddresses: 'Bypass Proxy for Local Addresses',
  validationDnsCacheMinTtl: 'You must provide a valid minimum TTL',
  validationDnsCacheMaxTtl: 'You must provide a valid maximum TTL',
  validationProxyPort: 'You must provide a valid port',
  validationForwardAuthUserHeader: 'You must provide a user header name',
  advancedNetworkSettings: 'Advanced Network Settings',
  networkDisclaimer:
    'Network parameters from your container/system should be used instead of these settings. See the {docs} for more information.',
  docs: 'documentation',
  forceIpv4First: 'Force IPv4 Resolution First',
  forceIpv4FirstTip:
    'Force Seerr to resolve IPv4 addresses first instead of IPv6',
  dnsCache: 'DNS Cache',
  dnsCacheTip:
    'Enable caching of DNS lookups to optimize performance and avoid making unnecessary API calls',
  dnsCacheHoverTip:
    'Do NOT enable this if you are experiencing issues with DNS lookups',
  dnsCacheForceMinTtl: 'DNS Cache Minimum TTL',
  dnsCacheForceMaxTtl: 'DNS Cache Maximum TTL',
  apiRequestTimeout: 'API Request Timeout',
  apiRequestTimeoutTip:
    'Maximum time (in seconds) to wait for responses from external services like Radarr/Sonarr. Set to 0 for no timeout.',
  validationApiRequestTimeout: 'You must provide a valid timeout value',
  invalidIpv4: 'Invalid IPv4 address: {address}',
  invalidIpv6: 'Invalid IPv6 address: {address}',
  invalidAddress: 'Invalid address: {address}',
});

const SettingsNetwork = () => {
  const { addToast } = useToasts();
  const intl = useIntl();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<NetworkSettings>('/api/v1/settings/network');

  const NetworkSettingsSchema = Yup.object().shape({
    dnsCacheForceMinTtl: Yup.number().when('dnsCacheEnabled', {
      is: true,
      then: (schema) =>
        schema
          .typeError(intl.formatMessage(messages.validationDnsCacheMinTtl))
          .required(intl.formatMessage(messages.validationDnsCacheMinTtl))
          .min(0),
      otherwise: (schema) => schema.nullable(),
    }),
    dnsCacheForceMaxTtl: Yup.number().when('dnsCacheEnabled', {
      is: true,
      then: (schema) =>
        schema
          .typeError(intl.formatMessage(messages.validationDnsCacheMaxTtl))
          .required(intl.formatMessage(messages.validationDnsCacheMaxTtl))
          .min(-1),
      otherwise: (schema) => schema.nullable(),
    }),
    proxyPort: Yup.number().when('proxyEnabled', {
      is: (proxyEnabled: boolean) => proxyEnabled,
      then: (schema) =>
        schema
          .typeError(intl.formatMessage(messages.validationProxyPort))
          .integer(intl.formatMessage(messages.validationProxyPort))
          .min(1, intl.formatMessage(messages.validationProxyPort))
          .max(65535, intl.formatMessage(messages.validationProxyPort))
          .required(intl.formatMessage(messages.validationProxyPort)),
      otherwise: (schema) => schema.nullable(),
    }),
    apiRequestTimeout: Yup.number()
      .typeError(intl.formatMessage(messages.validationApiRequestTimeout))
      .required(intl.formatMessage(messages.validationApiRequestTimeout))
      .min(0, intl.formatMessage(messages.validationApiRequestTimeout)),
    trustedProxies: Yup.string().when('trustProxy', {
      is: true,
      then: (schema) => schema.test(
        'validate-address',
        'invalid address found',
        (value, ctx) => {
          if (!value) {
            return true;
          }
          const addresses = value.split(',').map((value) => value.trim());
          for (const address of addresses) {
            if (address.indexOf('.') != -1) {
              if (!Address4.isValid(address)) {
                return ctx.createError({
                  message: intl.formatMessage(messages.invalidIpv4, {
                    address,
                  }),
                });
              }
            } else if (address.indexOf(':') != -1) {
              if (!Address6.isValid(address)) {
                return ctx.createError({
                  message: intl.formatMessage(messages.invalidIpv6, {
                    address,
                  }),
                });
              }
            } else {
              return ctx.createError({
                message: intl.formatMessage(messages.invalidAddress, {
                  address,
                }),
              });
            }
          }
          return true;
        }
      ),
      otherwise: Yup.string(),
    }),
    forwardAuthUserHeader: Yup.string(),
    forwardAuthEmailHeader: Yup.string(),
  })
    .test('email-or-user', 'Either email OR user required', (values, ctx) => {
      const {
        trustProxy,
        forwardAuthEnabled,
        forwardAuthUserHeader,
        forwardAuthEmailHeader,
      } = values;

      const userSet = forwardAuthUserHeader && forwardAuthUserHeader !== '';
      const emailSet = forwardAuthEmailHeader && forwardAuthEmailHeader !== '';
      const invalid =
        trustProxy && forwardAuthEnabled && !(userSet || emailSet);

      if (invalid) {
        return ctx.createError({
          path: 'forwardAuthHeaders',
          message: 'Either user or email header must be set',
        });
      }

      return true;
    });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  let trustedProxies = '';
  const ipv4 = data?.trustedProxies.v4.join(', ') ?? '';
  const ipv6 = data?.trustedProxies.v6.join(', ') ?? '';
  if (ipv4.length > 0 && ipv6.length > 0) {
    trustedProxies = `${ipv4}, ${ipv6}`;
  } else if (ipv4.length > 0) {
    trustedProxies = ipv4;
  } else if (ipv6.length > 0) {
    trustedProxies = ipv6;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.network),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.networksettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.networksettingsDescription)}
        </p>
      </div>
      <div className="section">
        <Formik
          initialValues={{
            forwardAuthHeaders: '',
            csrfProtection: data?.csrfProtection,
            forceIpv4First: data?.forceIpv4First,
            dnsCacheEnabled: data?.dnsCache.enabled,
            dnsCacheForceMinTtl: data?.dnsCache.forceMinTtl,
            dnsCacheForceMaxTtl: data?.dnsCache.forceMaxTtl,
            trustedProxies: trustedProxies,
            trustProxy: data?.trustProxy,
            forwardAuthEnabled: data?.forwardAuth.enabled,
            forwardAuthUserHeader: data?.forwardAuth.userHeader,
            forwardAuthEmailHeader: data?.forwardAuth.emailHeader,
            proxyEnabled: data?.proxy?.enabled,
            proxyHostname: data?.proxy?.hostname,
            proxyPort: data?.proxy?.port,
            proxySsl: data?.proxy?.useSsl,
            proxyUser: data?.proxy?.user,
            proxyPassword: data?.proxy?.password,
            proxyBypassFilter: data?.proxy?.bypassFilter,
            proxyBypassLocalAddresses: data?.proxy?.bypassLocalAddresses,
            apiRequestTimeout:
              data?.apiRequestTimeout !== undefined
                ? data.apiRequestTimeout / 1000
                : 10,
          }}
          enableReinitialize
          validationSchema={NetworkSettingsSchema}
          onSubmit={async (values) => {
            try {
              const trustedProxies: { v4: string[]; v6: string[] } = {
                v4: [],
                v6: [],
              };
              for (let value of values.trustedProxies.split(',')) {
                value = value.trim();
                if (value.indexOf('.') != -1) {
                  trustedProxies.v4.push(value);
                } else if (value.indexOf(':') != -1) {
                  trustedProxies.v6.push(value);
                }
              }

              await axios.post('/api/v1/settings/network', {
                csrfProtection: values.csrfProtection,
                forceIpv4First: values.forceIpv4First,
                trustProxy: values.trustProxy,
                dnsCache: {
                  enabled: values.dnsCacheEnabled,
                  forceMinTtl: Number(values.dnsCacheForceMinTtl),
                  forceMaxTtl: Number(values.dnsCacheForceMaxTtl),
                },
                forwardAuth: {
                  enabled: values.forwardAuthEnabled,
                  userHeader: values.forwardAuthUserHeader,
                  emailHeader: values.forwardAuthEmailHeader,
                },
                trustedProxies: trustedProxies,
                proxy: {
                  enabled: values.proxyEnabled,
                  hostname: values.proxyHostname,
                  port: Number(values.proxyPort),
                  useSsl: values.proxySsl,
                  user: values.proxyUser,
                  password: values.proxyPassword,
                  bypassFilter: values.proxyBypassFilter,
                  bypassLocalAddresses: values.proxyBypassLocalAddresses,
                },
                apiRequestTimeout: Number(values.apiRequestTimeout) * 1000,
              });
              mutate('/api/v1/settings/public');
              mutate('/api/v1/status');

              addToast(intl.formatMessage(messages.toastSettingsSuccess), {
                autoDismiss: true,
                appearance: 'success',
              });
            } catch {
              addToast(intl.formatMessage(messages.toastSettingsFailure), {
                autoDismiss: true,
                appearance: 'error',
              });
            } finally {
              revalidate();
            }
          }}
        >
          {({
            errors,
            touched,
            isSubmitting,
            isValid,
            values,
            setFieldValue,
          }) => {
            return (
              <Form className="section" data-testid="settings-network-form">
                <div className="form-row">
                  <label htmlFor="trustProxy" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.trustProxy)}
                    </span>
                    <SettingsBadge badgeType="restartRequired" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.trustProxyTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="trustProxy"
                      name="trustProxy"
                      onChange={() => {
                        setFieldValue('trustProxy', !values.trustProxy);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="csrfProtection" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.csrfProtection)}
                    </span>
                    <SettingsBadge badgeType="advanced" className="mr-2" />
                    <SettingsBadge badgeType="restartRequired" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.csrfProtectionTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Tooltip
                      content={intl.formatMessage(
                        messages.csrfProtectionHoverTip
                      )}
                    >
                      <Field
                        type="checkbox"
                        id="csrfProtection"
                        name="csrfProtection"
                        onChange={() => {
                          setFieldValue(
                            'csrfProtection',
                            !values.csrfProtection
                          );
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="forceIpv4First" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.forceIpv4First)}
                    </span>
                    <SettingsBadge badgeType="advanced" className="mr-2" />
                    <SettingsBadge badgeType="restartRequired" />
                    <SettingsBadge badgeType="experimental" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.forceIpv4FirstTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="forceIpv4First"
                      name="forceIpv4First"
                      onChange={() => {
                        setFieldValue('forceIpv4First', !values.forceIpv4First);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="dnsCacheEnabled" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.dnsCache)}
                    </span>
                    <SettingsBadge badgeType="advanced" className="mr-2" />
                    <SettingsBadge badgeType="restartRequired" />
                    <SettingsBadge badgeType="experimental" className="mr-2" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.dnsCacheTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Tooltip
                      content={intl.formatMessage(messages.dnsCacheHoverTip)}
                    >
                      <Field
                        type="checkbox"
                        id="dnsCacheEnabled"
                        name="dnsCacheEnabled"
                        onChange={() => {
                          setFieldValue(
                            'dnsCacheEnabled',
                            !values.dnsCacheEnabled
                          );
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
                {values.dnsCacheEnabled && (
                  <>
                    <div className="ml-4 mr-2">
                      <div className="form-row">
                        <label
                          htmlFor="dnsCacheForceMinTtl"
                          className="text-label"
                        >
                          {intl.formatMessage(messages.dnsCacheForceMinTtl)}
                        </label>
                        <div className="form-input-area">
                          <Field
                            id="dnsCacheForceMinTtl"
                            name="dnsCacheForceMinTtl"
                            type="text"
                            inputMode="numeric"
                            className="short"
                          />
                        </div>
                        {errors.dnsCacheForceMinTtl &&
                          touched.dnsCacheForceMinTtl &&
                          typeof errors.dnsCacheForceMinTtl === 'string' && (
                            <div className="error">
                              {errors.dnsCacheForceMinTtl}
                            </div>
                          )}
                      </div>
                      <div className="form-row">
                        <label
                          htmlFor="dnsCacheForceMaxTtl"
                          className="text-label"
                        >
                          {intl.formatMessage(messages.dnsCacheForceMaxTtl)}
                        </label>
                        <div className="form-input-area">
                          <Field
                            id="dnsCacheForceMaxTtl"
                            name="dnsCacheForceMaxTtl"
                            type="text"
                            inputMode="text"
                            className="short"
                          />
                        </div>
                        {errors.dnsCacheForceMaxTtl &&
                          touched.dnsCacheForceMaxTtl &&
                          typeof errors.dnsCacheForceMaxTtl === 'string' && (
                            <div className="error">
                              {errors.dnsCacheForceMaxTtl}
                            </div>
                          )}
                      </div>
                    </div>
                  </>
                )}
                <div className="form-row">
                  <label htmlFor="apiRequestTimeout" className="text-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.apiRequestTimeout)}
                    </span>
                    <SettingsBadge badgeType="restartRequired" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.apiRequestTimeoutTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      id="apiRequestTimeout"
                      name="apiRequestTimeout"
                      type="text"
                      inputMode="numeric"
                      className="short"
                    />
                  </div>
                  {errors.apiRequestTimeout &&
                    touched.apiRequestTimeout &&
                    typeof errors.apiRequestTimeout === 'string' && (
                      <div className="error">{errors.apiRequestTimeout}</div>
                    )}
                </div>
                <div className="form-row">
                  <label htmlFor="proxyEnabled" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.proxyEnabled)}
                    </span>
                    <SettingsBadge badgeType="advanced" className="mr-2" />
                    <SettingsBadge badgeType="restartRequired" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.proxyEnabledTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="proxyEnabled"
                      name="proxyEnabled"
                      onChange={() => {
                        setFieldValue('proxyEnabled', !values.proxyEnabled);
                      }}
                    />
                  </div>
                </div>
                {values.proxyEnabled && (
                  <>
                    <div className="ml-4 mr-2">
                      <div className="form-row">
                        <label
                          htmlFor="proxyHostname"
                          className="checkbox-label"
                        >
                          {intl.formatMessage(messages.proxyHostname)}
                        </label>
                        <div className="form-input-area">
                          <div className="form-input-field">
                            <Field
                              id="proxyHostname"
                              name="proxyHostname"
                              type="text"
                            />
                          </div>
                          {errors.proxyHostname &&
                            touched.proxyHostname &&
                            typeof errors.proxyHostname === 'string' && (
                              <div className="error">
                                {errors.proxyHostname}
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="form-row">
                        <label htmlFor="proxyPort" className="checkbox-label">
                          {intl.formatMessage(messages.proxyPort)}
                        </label>
                        <div className="form-input-area">
                          <Field
                            id="proxyPort"
                            name="proxyPort"
                            type="text"
                            inputMode="numeric"
                            className="short"
                          />
                          {errors.proxyPort &&
                            touched.proxyPort &&
                            typeof errors.proxyPort === 'string' && (
                              <div className="error">{errors.proxyPort}</div>
                            )}
                        </div>
                      </div>
                      <div className="form-row">
                        <label htmlFor="proxySsl" className="checkbox-label">
                          {intl.formatMessage(messages.proxySsl)}
                        </label>
                        <div className="form-input-area">
                          <Field
                            type="checkbox"
                            id="proxySsl"
                            name="proxySsl"
                            onChange={() => {
                              setFieldValue('proxySsl', !values.proxySsl);
                            }}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <label htmlFor="proxyUser" className="checkbox-label">
                          {intl.formatMessage(messages.proxyUser)}
                        </label>
                        <div className="form-input-area">
                          <div className="form-input-field">
                            <Field
                              id="proxyUser"
                              name="proxyUser"
                              type="text"
                            />
                          </div>
                          {errors.proxyUser &&
                            touched.proxyUser &&
                            typeof errors.proxyUser === 'string' && (
                              <div className="error">{errors.proxyUser}</div>
                            )}
                        </div>
                      </div>
                      <div className="form-row">
                        <label
                          htmlFor="proxyPassword"
                          className="checkbox-label"
                        >
                          {intl.formatMessage(messages.proxyPassword)}
                        </label>
                        <div className="form-input-area">
                          <div className="form-input-field">
                            <Field
                              id="proxyPassword"
                              name="proxyPassword"
                              type="password"
                            />
                          </div>
                          {errors.proxyPassword &&
                            touched.proxyPassword &&
                            typeof errors.proxyPassword === 'string' && (
                              <div className="error">
                                {errors.proxyPassword}
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="form-row">
                        <label
                          htmlFor="proxyBypassFilter"
                          className="checkbox-label"
                        >
                          {intl.formatMessage(messages.proxyBypassFilter)}
                          <span className="label-tip">
                            {intl.formatMessage(messages.proxyBypassFilterTip)}
                          </span>
                        </label>
                        <div className="form-input-area">
                          <div className="form-input-field">
                            <Field
                              id="proxyBypassFilter"
                              name="proxyBypassFilter"
                              type="text"
                            />
                          </div>
                          {errors.proxyBypassFilter &&
                            touched.proxyBypassFilter &&
                            typeof errors.proxyBypassFilter === 'string' && (
                              <div className="error">
                                {errors.proxyBypassFilter}
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="form-row">
                        <label
                          htmlFor="proxyBypassLocalAddresses"
                          className="checkbox-label"
                        >
                          {intl.formatMessage(
                            messages.proxyBypassLocalAddresses
                          )}
                        </label>
                        <div className="form-input-area">
                          <Field
                            type="checkbox"
                            id="proxyBypassLocalAddresses"
                            name="proxyBypassLocalAddresses"
                            onChange={() => {
                              setFieldValue(
                                'proxyBypassLocalAddresses',
                                !values.proxyBypassLocalAddresses
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <h3 className="heading mt-10">
                  {intl.formatMessage(messages.advancedNetworkSettings)}
                </h3>
                <p className="description">
                  {intl.formatMessage(messages.networkDisclaimer, {
                    docs: (
                      <a
                        href="https://docs.jellyseerr.dev/troubleshooting"
                        target="_blank"
                        rel="noreferrer"
                        className="text-white"
                      >
                        {intl.formatMessage(messages.docs)}
                      </a>
                    ),
                  })}
                </p>
                {values.trustProxy && (
                  <>
                    <div className="form-row">
                      <label
                        htmlFor="trustedProxies"
                        className="checkbox-label"
                      >
                        <span className="mr-2">
                          {intl.formatMessage(messages.trustedProxies)}
                        </span>
                        <SettingsBadge badgeType="advanced" className="mr-2" />
                      </label>
                      <div className="form-input-area">
                        <Field
                          type="text"
                          id="trustedProxies"
                          name="trustedProxies"
                        />
                      </div>
                      {errors.trustedProxies &&
                        touched.trustedProxies &&
                        typeof errors.trustedProxies === 'string' && (
                          <div className="error">{errors.trustedProxies}</div>
                        )}
                    </div>
                    <div className="form-row">
                      <label
                        htmlFor="forwardAuthEnabled"
                        className="checkbox-label"
                      >
                        <span className="mr-2">
                          {intl.formatMessage(messages.forwardAuthEnabled)}
                        </span>
                        <SettingsBadge badgeType="advanced" className="mr-2" />
                        <span className="label-tip">
                          {intl.formatMessage(messages.forwardAuthEnabledTip)}
                        </span>
                      </label>
                      <div className="form-input-area">
                        <Field
                          type="checkbox"
                          id="forwardAuthEnabled"
                          name="forwardAuthEnabled"
                          onChange={() => {
                            setFieldValue(
                              'forwardAuthEnabled',
                              !values.forwardAuthEnabled
                            );
                          }}
                        />
                      </div>
                    </div>
                    {values.forwardAuthEnabled && (
                      <>
                        <div className="ml-4 mr-2">
                          <div className="form-row">
                            <label
                              htmlFor="forwardAuthUserHeader"
                              className="text-label"
                            >
                              <span className="mr-2">
                                {intl.formatMessage(messages.userHeaderName)}
                              </span>
                              <SettingsBadge badgeType="advanced" />
                              <span className="label-tip">
                                {intl.formatMessage(messages.userHeaderNameTip)}
                              </span>
                            </label>
                            <div className="form-input-area">
                              <div className="form-input-field">
                                <select
                                  className="inline"
                                  id="forwardAuthUserHeader"
                                  name="forwardAuthUserHeader"
                                  value={values.forwardAuthUserHeader ?? ''}
                                  onChange={(e) => {
                                    setFieldValue(
                                      'forwardAuthUserHeader',
                                      e.target.value
                                    );
                                  }}
                                >
                                  <option value="">--Do not use--</option>
                                  {ForwardAuthAllowlist.map((item) => (
                                    <option value={item} key={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                          <div className="form-row">
                            <label
                              htmlFor="forwardAuthEmailHeader"
                              className="text-label"
                            >
                              <span className="mr-2">
                                {intl.formatMessage(messages.emailHeaderName)}
                              </span>
                              <SettingsBadge badgeType="advanced" />
                              <span className="label-tip">
                                {intl.formatMessage(
                                  messages.emailHeaderNameTip
                                )}
                              </span>
                            </label>
                            <div className="form-input-area">
                              <div className="form-input-field">
                                <select
                                  className="inline"
                                  id="forwardAuthEmailHeader"
                                  name="forwardAuthEmailHeader"
                                  value={values.forwardAuthEmailHeader ?? ''}
                                  onChange={(e) => {
                                    setFieldValue(
                                      'forwardAuthEmailHeader',
                                      e.target.value
                                    );
                                  }}
                                >
                                  <option value="">--Do not use--</option>
                                  {ForwardAuthAllowlist.map((item) => (
                                    <option value={item} key={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                          {errors['forwardAuthHeaders'] &&
                            typeof errors.forwardAuthHeaders === 'string' && (
                              <div className="error">
                                {errors.forwardAuthHeaders}
                              </div>
                            )}
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="actions">
                  <div className="flex justify-end">
                    <span className="ml-3 inline-flex rounded-md shadow-sm">
                      <Button
                        buttonType="primary"
                        type="submit"
                        disabled={isSubmitting || !isValid}
                      >
                        <ArrowDownOnSquareIcon />
                        <span>
                          {isSubmitting
                            ? intl.formatMessage(globalMessages.saving)
                            : intl.formatMessage(globalMessages.save)}
                        </span>
                      </Button>
                    </span>
                  </div>
                </div>
              </Form>
            );
          }}
        </Formik>
      </div>
    </>
  );
};

export default SettingsNetwork;

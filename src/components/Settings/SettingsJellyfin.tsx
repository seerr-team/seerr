import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import LibraryItem from '@app/components/Settings/LibraryItem';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { getMediaServerTypeName } from '@app/utils/mediaServers';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import { ApiErrorCode } from '@server/constants/error';
import { MediaServerType } from '@server/constants/server';
import type { JellyfinSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings', {
  jellyfinsettings: '{mediaServerName} Settings',
  jellyfinsettingsDescription:
    'Configure the settings for your {mediaServerName} server. {mediaServerName} scans your {mediaServerName} libraries to see what content is available.',
  timeout: 'Timeout',
  save: 'Save Changes',
  saving: 'Saving…',
  jellyfinlibraries: '{mediaServerName} Libraries',
  jellyfinlibrariesDescription:
    'The libraries {mediaServerName} scans for titles. Click the button below if no libraries are listed.',
  jellyfinSettingsFailure:
    'Something went wrong while saving {mediaServerName} settings.',
  jellyfinSettingsSuccess: '{mediaServerName} settings saved successfully!',
  jellyfinSettings: '{mediaServerName} Settings',
  jellyfinSettingsDescription:
    'Optionally configure the internal and external endpoints for your {mediaServerName} server. In most cases, the external URL is different to the internal URL. A custom password reset URL can also be set for {mediaServerName} login, in case you would like to redirect to a different password reset page. You can also change the Jellyfin API key, which was automatically generated previously.',
  externalUrl: 'External URL',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  enablessl: 'Use SSL',
  urlBase: 'URL Base',
  jellyfinForgotPasswordUrl: 'Forgot Password URL',
  apiKey: 'API key',
  jellyfinSyncFailedNoLibrariesFound: 'No libraries were found',
  jellyfinSyncFailedAutomaticGroupedFolders:
    'Custom authentication with Automatic Library Grouping not supported',
  jellyfinSyncFailedGenericError:
    'Something went wrong while syncing libraries',
  invalidurlerror: 'Unable to connect to {mediaServerName} server.',
  invalidautherror:
    'Unable to authenticate with {mediaServerName}. Check the API key or admin credentials.',
  adminerror: 'You must use an admin account to sign in.',
  adminUsername: 'Admin Username',
  adminPassword: 'Admin Password',
  adminCredentialsDescription:
    'Optionally sign in with an admin account to generate an API key automatically.',
  validationApiKeyOrCredentials:
    'Provide an API key or an admin username and password.',
  syncing: 'Syncing',
  syncJellyfin: 'Sync Libraries',
  manualscanJellyfin: 'Manual Library Scan',
  manualscanDescriptionJellyfin:
    "Normally, this will only be run once every 24 hours. Seerr will check your {mediaServerName} server's recently added more aggressively. If this is your first time configuring Seerr, a one-time full manual library scan is recommended!",
  notrunning: 'Not Running',
  currentlibrary: 'Current Library: {name}',
  librariesRemaining: 'Libraries Remaining: {count}',
  startscan: 'Start Scan',
  cancelscan: 'Cancel Scan',
  validationUrl: 'You must provide a valid URL',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  validationUrlTrailingSlash: 'URL must not end in a trailing slash',
  validationUrlBaseLeadingSlash: 'URL base must have a leading slash',
  validationUrlBaseTrailingSlash: 'URL base must not end in a trailing slash',
  tip: 'Tip',
  scanbackground:
    'Scanning will run in the background. You can continue the setup process in the meantime.',
  servers: 'Servers',
  addServer: 'Add New Server',
  serverType: 'Server Type',
});

interface Library {
  id: string;
  name: string;
  enabled: boolean;
}

interface SyncStatus {
  running: boolean;
  progress: number;
  total: number;
  currentLibrary?: Library;
  libraries: Library[];
}

interface SettingsJellyfinProps {
  isSetupSettings?: boolean;
  onComplete?: () => void;
  setupServerType?: MediaServerType.JELLYFIN | MediaServerType.EMBY;
}

type JellyfinServerInstance = JellyfinSettings & {
  id: string;
  mediaServerType: MediaServerType.JELLYFIN | MediaServerType.EMBY;
};

type JellyfinServerPayload = Partial<JellyfinSettings> & {
  id?: string;
  mediaServerType: MediaServerType.JELLYFIN | MediaServerType.EMBY;
  username?: string;
  password?: string;
};

const SettingsJellyfin: React.FC<SettingsJellyfinProps> = ({
  onComplete,
  isSetupSettings,
  setupServerType,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('new');
  const [hasInitializedServerSelection, setHasInitializedServerSelection] =
    useState(false);
  const [newServerType, setNewServerType] = useState<
    MediaServerType.JELLYFIN | MediaServerType.EMBY
  >(MediaServerType.JELLYFIN);
  const toasts = useToasts();
  const { data: jellyfinServers, mutate: revalidateJellyfinServers } = useSWR<
    JellyfinServerInstance[]
  >('/api/v1/settings/jellyfin/servers');

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<JellyfinServerInstance>(
    selectedServerId === 'new'
      ? null
      : `/api/v1/settings/jellyfin?serverId=${selectedServerId}`
  );
  const { data: dataSync, mutate: revalidateSync } = useSWR<SyncStatus>(
    '/api/v1/settings/jellyfin/sync',
    {
      refreshInterval: 1000,
    }
  );
  const intl = useIntl();
  const { addToast } = useToasts();
  const JellyfinSettingsSchema = Yup.object()
    .shape({
      hostname: Yup.string()
        .nullable()
        .required(intl.formatMessage(messages.validationHostnameRequired)),
      port: Yup.number().when(['hostname'], {
        is: (value: unknown) => !!value,
        then: Yup.number()
          .typeError(intl.formatMessage(messages.validationPortRequired))
          .nullable()
          .required(intl.formatMessage(messages.validationPortRequired)),
        otherwise: Yup.number()
          .typeError(intl.formatMessage(messages.validationPortRequired))
          .nullable(),
      }),
      urlBase: Yup.string()
        .test(
          'leading-slash',
          intl.formatMessage(messages.validationUrlBaseLeadingSlash),
          (value) => !value || value.startsWith('/')
        )
        .test(
          'trailing-slash',
          intl.formatMessage(messages.validationUrlBaseTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
      jellyfinExternalUrl: Yup.string()
        .nullable()
        .test(
          'valid-url',
          intl.formatMessage(messages.validationUrl),
          isValidURL
        )
        .test(
          'no-trailing-slash',
          intl.formatMessage(messages.validationUrlTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
      jellyfinForgotPasswordUrl: Yup.string()
        .nullable()
        .test(
          'valid-url',
          intl.formatMessage(messages.validationUrl),
          isValidURL
        )
        .test(
          'no-trailing-slash',
          intl.formatMessage(messages.validationUrlTrailingSlash),
          (value) => !value || !value.endsWith('/')
        ),
      apiKey: Yup.string().nullable(),
      username: Yup.string().nullable(),
      password: Yup.string().nullable(),
    })
    .test({
      name: 'api-key-or-credentials',
      test: function (values) {
        if (selectedServerId !== 'new') {
          return true;
        }

        const hasApiKey = !!values.apiKey?.trim();
        const hasUsername = !!values.username?.trim();
        const hasPassword = !!values.password?.trim();

        if (hasApiKey || (hasUsername && hasPassword)) {
          return true;
        }

        return this.createError({
          path: 'apiKey | username | password',
          message: intl.formatMessage(messages.validationApiKeyOrCredentials),
        });
      },
    });

  const activeLibraries =
    data?.libraries
      ?.filter((library) => library.enabled)
      .map((library) => library.id) ?? [];

  useEffect(() => {
    if (isSetupSettings && setupServerType) {
      setNewServerType(setupServerType);
    }
  }, [isSetupSettings, setupServerType]);

  useEffect(() => {
    if (
      !isSetupSettings &&
      !hasInitializedServerSelection &&
      selectedServerId === 'new' &&
      jellyfinServers?.length === 1 &&
      jellyfinServers?.[0]
    ) {
      setSelectedServerId(jellyfinServers[0].id);
      setNewServerType(jellyfinServers[0].mediaServerType);
      setHasInitializedServerSelection(true);
    }
  }, [
    hasInitializedServerSelection,
    isSetupSettings,
    jellyfinServers,
    selectedServerId,
  ]);

  const syncLibraries = async () => {
    if (selectedServerId === 'new') {
      return;
    }

    setIsSyncing(true);

    const params: { sync: boolean; enable?: string; serverId?: string } = {
      sync: true,
      serverId: selectedServerId,
    };

    if (activeLibraries.length > 0) {
      params.enable = activeLibraries.join(',');
    }

    try {
      await axios.get('/api/v1/settings/jellyfin/library', {
        params,
      });
      setIsSyncing(false);
      revalidate();
    } catch (e) {
      if (e?.response?.data?.message === 'SYNC_ERROR_GROUPED_FOLDERS') {
        toasts.addToast(
          intl.formatMessage(
            messages.jellyfinSyncFailedAutomaticGroupedFolders
          ),
          {
            autoDismiss: true,
            appearance: 'warning',
          }
        );
      } else if (e?.response?.data?.message === 'SYNC_ERROR_NO_LIBRARIES') {
        toasts.addToast(
          intl.formatMessage(messages.jellyfinSyncFailedNoLibrariesFound),
          {
            autoDismiss: true,
            appearance: 'error',
          }
        );
      } else {
        toasts.addToast(
          intl.formatMessage(messages.jellyfinSyncFailedGenericError),
          {
            autoDismiss: true,
            appearance: 'error',
          }
        );
      }
      setIsSyncing(false);
      revalidate();
    }
  };

  const startScan = async () => {
    await axios.post('/api/v1/settings/jellyfin/sync', {
      start: true,
    });
    revalidateSync();
  };

  const cancelScan = async () => {
    await axios.post('/api/v1/settings/jellyfin/sync', {
      cancel: true,
    });
    revalidateSync();
  };

  const toggleLibrary = async (libraryId: string) => {
    if (selectedServerId === 'new') {
      return;
    }

    setIsSyncing(true);
    if (activeLibraries.includes(libraryId)) {
      const params: { enable?: string; serverId?: string } = {
        serverId: selectedServerId,
      };

      if (activeLibraries.length > 1) {
        params.enable = activeLibraries
          .filter((id) => id !== libraryId)
          .join(',');
      }

      await axios.get('/api/v1/settings/jellyfin/library', {
        params,
      });
    } else {
      await axios.get('/api/v1/settings/jellyfin/library', {
        params: {
          enable: [...activeLibraries, libraryId].join(','),
          serverId: selectedServerId,
        },
      });
    }
    if (onComplete) {
      onComplete();
    }
    setIsSyncing(false);
    revalidate();
  };

  if (selectedServerId !== 'new' && !data && !error) {
    return <LoadingSpinner />;
  }

  const selectedServer =
    jellyfinServers?.find((server) => server.id === selectedServerId) ?? data;
  const activeServerType =
    selectedServer?.mediaServerType ??
    (isSetupSettings && setupServerType ? setupServerType : newServerType);
  const mediaServerFormatValues = {
    mediaServerName:
      activeServerType === MediaServerType.JELLYFIN
        ? 'Jellyfin'
        : activeServerType === MediaServerType.EMBY
          ? 'Emby'
          : undefined,
  };

  return (
    <>
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(
            messages.jellyfinsettings,
            mediaServerFormatValues
          )}
        </h3>
        <p className="description">
          {intl.formatMessage(
            messages.jellyfinsettingsDescription,
            mediaServerFormatValues
          )}
        </p>
      </div>
      {!isSetupSettings && (
        <div className="section mb-6">
          <div className="form-row">
            <label htmlFor="serverSelector" className="text-label">
              {intl.formatMessage(messages.servers)}
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <select
                  id="serverSelector"
                  name="serverSelector"
                  value={selectedServerId}
                  onChange={(event) => setSelectedServerId(event.target.value)}
                >
                  <option value="new">
                    {intl.formatMessage(messages.addServer)}
                  </option>
                  {jellyfinServers?.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name || server.ip}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {selectedServerId === 'new' && (
            <div className="form-row">
              <label htmlFor="serverType" className="text-label">
                {intl.formatMessage(messages.serverType)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <select
                    id="serverType"
                    name="serverType"
                    value={newServerType}
                    onChange={(event) =>
                      setNewServerType(
                        Number(event.target.value) as
                          | MediaServerType.JELLYFIN
                          | MediaServerType.EMBY
                      )
                    }
                  >
                    <option value={MediaServerType.JELLYFIN}>Jellyfin</option>
                    <option value={MediaServerType.EMBY}>Emby</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="section">
        <Button
          onClick={() => syncLibraries()}
          disabled={isSyncing || selectedServerId === 'new'}
        >
          <svg
            className={`${isSyncing ? 'animate-spin' : ''} mr-1 h-5 w-5`}
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
          {isSyncing
            ? intl.formatMessage(messages.syncing)
            : intl.formatMessage(messages.syncJellyfin)}
        </Button>
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {(data?.libraries ?? []).map((library) => (
            <LibraryItem
              name={library.name}
              isEnabled={library.enabled}
              key={`setting-library-${library.id}`}
              onToggle={() => toggleLibrary(library.id)}
            />
          ))}
        </ul>
      </div>
      <div className="mb-6 mt-10">
        <h3 className="heading">
          <FormattedMessage {...messages.manualscanJellyfin} />
        </h3>
        <p className="description">
          {intl.formatMessage(
            messages.manualscanDescriptionJellyfin,
            mediaServerFormatValues
          )}
        </p>
      </div>
      <div className="section">
        <div className="rounded-md bg-gray-800 p-4">
          <div className="relative mb-6 h-8 w-full overflow-hidden rounded-full bg-gray-600">
            {dataSync?.running && (
              <div
                className="h-8 bg-indigo-600 transition-all duration-200 ease-in-out"
                style={{
                  width: `${Math.round(
                    (dataSync.progress / dataSync.total) * 100
                  )}%`,
                }}
              />
            )}
            <div className="absolute inset-0 flex h-8 w-full items-center justify-center text-sm">
              <span>
                {dataSync?.running
                  ? `${dataSync.progress} of ${dataSync.total}`
                  : 'Not running'}
              </span>
            </div>
          </div>
          <div className="flex w-full flex-col sm:flex-row">
            {dataSync?.running && (
              <>
                {dataSync.currentLibrary && (
                  <div className="mb-2 mr-0 flex items-center sm:mb-0 sm:mr-2">
                    <Badge>
                      <FormattedMessage
                        {...messages.currentlibrary}
                        values={{ name: dataSync.currentLibrary.name }}
                      />
                    </Badge>
                  </div>
                )}
                <div className="flex items-center">
                  <Badge badgeType="warning">
                    <FormattedMessage
                      {...messages.librariesRemaining}
                      values={{
                        count: dataSync.currentLibrary
                          ? dataSync.libraries.slice(
                              dataSync.libraries.findIndex(
                                (library) =>
                                  library.id === dataSync.currentLibrary?.id
                              ) + 1
                            ).length
                          : 0,
                      }}
                    />
                  </Badge>
                </div>
              </>
            )}
            <div className="flex-1 text-right">
              {!dataSync?.running && (
                <Button buttonType="warning" onClick={() => startScan()}>
                  <svg
                    className="mr-1 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <FormattedMessage {...messages.startscan} />
                </Button>
              )}

              {dataSync?.running && (
                <Button buttonType="danger" onClick={() => cancelScan()}>
                  <svg
                    className="mr-1 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <FormattedMessage {...messages.cancelscan} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {isSetupSettings && (
        <div className="text-sm text-gray-500">
          <span className="mr-2">
            <Badge>{intl.formatMessage(messages.tip)}</Badge>
          </span>
          {intl.formatMessage(messages.scanbackground)}
        </div>
      )}
      <div className="mb-6 mt-10">
        <h3 className="heading">
          {intl.formatMessage(
            messages.jellyfinSettings,
            mediaServerFormatValues
          )}
        </h3>
        <p className="description">
          {intl.formatMessage(
            messages.jellyfinSettingsDescription,
            mediaServerFormatValues
          )}
        </p>
      </div>
      <Formik
        key={selectedServerId}
        initialValues={{
          hostname: data?.ip,
          port: data?.port ?? 8096,
          useSsl: data?.useSsl,
          urlBase: data?.urlBase || '',
          jellyfinExternalUrl: data?.externalHostname || '',
          jellyfinForgotPasswordUrl: data?.jellyfinForgotPasswordUrl || '',
          apiKey: data?.apiKey,
          username: '',
          password: '',
        }}
        validationSchema={JellyfinSettingsSchema}
        onSubmit={async (values) => {
          try {
            const payload: JellyfinServerPayload = {
              id: selectedServerId !== 'new' ? selectedServerId : undefined,
              ip: values.hostname,
              port: Number(values.port),
              useSsl: values.useSsl,
              urlBase: values.urlBase,
              externalHostname: values.jellyfinExternalUrl,
              jellyfinForgotPasswordUrl: values.jellyfinForgotPasswordUrl,
              apiKey: values.apiKey,
              username: values.username,
              password: values.password,
              mediaServerType: activeServerType,
            };
            const response = await axios.post<JellyfinServerInstance>(
              '/api/v1/settings/jellyfin',
              payload
            );

            setSelectedServerId(response.data.id);
            revalidateJellyfinServers();
            mutate('/api/v1/settings/public');

            addToast(
              intl.formatMessage(
                messages.jellyfinSettingsSuccess,
                mediaServerFormatValues
              ),
              {
                autoDismiss: true,
                appearance: 'success',
              }
            );
          } catch (e) {
            if (e?.response?.data?.message === ApiErrorCode.InvalidUrl) {
              addToast(
                intl.formatMessage(
                  messages.invalidurlerror,
                  mediaServerFormatValues
                ),
                {
                  autoDismiss: true,
                  appearance: 'error',
                }
              );
            } else if (
              e?.response?.data?.message === ApiErrorCode.InvalidCredentials ||
              e?.response?.data?.message === ApiErrorCode.InvalidAuthToken
            ) {
              addToast(
                intl.formatMessage(
                  messages.invalidautherror,
                  mediaServerFormatValues
                ),
                {
                  autoDismiss: true,
                  appearance: 'error',
                }
              );
            } else if (e?.response?.data?.message === ApiErrorCode.NotAdmin) {
              addToast(
                intl.formatMessage(
                  messages.adminerror,
                  mediaServerFormatValues
                ),
                {
                  autoDismiss: true,
                  appearance: 'error',
                }
              );
            } else {
              addToast(
                intl.formatMessage(
                  messages.jellyfinSettingsFailure,
                  mediaServerFormatValues
                ),
                {
                  autoDismiss: true,
                  appearance: 'error',
                }
              );
            }
          } finally {
            revalidate();
          }
        }}
      >
        {({
          errors,
          touched,
          values,
          setFieldValue,
          handleSubmit,
          isSubmitting,
          isValid,
        }) => {
          return (
            <form className="section" onSubmit={handleSubmit}>
              {!isSetupSettings && (
                <>
                  <div className="form-row">
                    <label htmlFor="hostname" className="text-label">
                      {intl.formatMessage(messages.hostname)}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-gray-100 sm:text-sm">
                          {values.useSsl ? 'https://' : 'http://'}
                        </span>
                        <Field
                          type="text"
                          inputMode="url"
                          id="hostname"
                          name="hostname"
                          className="rounded-r-only"
                        />
                      </div>
                      {errors.hostname &&
                        touched.hostname &&
                        typeof errors.hostname === 'string' && (
                          <div className="error">{errors.hostname}</div>
                        )}
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="port" className="text-label">
                      {intl.formatMessage(messages.port)}
                      <span className="label-required">*</span>
                    </label>
                    <div className="form-input-area">
                      <Field
                        type="text"
                        inputMode="numeric"
                        id="port"
                        name="port"
                        className="short"
                      />
                      {errors.port &&
                        touched.port &&
                        typeof errors.port === 'string' && (
                          <div className="error">{errors.port}</div>
                        )}
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="useSsl" className="checkbox-label">
                      {intl.formatMessage(messages.enablessl)}
                    </label>
                    <div className="form-input-area">
                      <Field
                        type="checkbox"
                        id="useSsl"
                        name="useSsl"
                        onChange={() => {
                          setFieldValue('useSsl', !values.useSsl);
                          setFieldValue('port', values.useSsl ? 8096 : 443);
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="form-row">
                <label htmlFor="apiKey" className="text-label">
                  {intl.formatMessage(messages.apiKey)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <SensitiveInput
                      as="field"
                      type="text"
                      inputMode="url"
                      id="apiKey"
                      name="apiKey"
                    />
                  </div>
                  {errors.apiKey && touched.apiKey && (
                    <div className="error">{errors.apiKey}</div>
                  )}
                  {'apiKey | username | password' in errors &&
                    typeof errors['apiKey | username | password'] ===
                      'string' && (
                      <div className="error">
                        {errors['apiKey | username | password'] as string}
                      </div>
                    )}
                </div>
              </div>
              {selectedServerId === 'new' && (
                <>
                  <div className="form-row">
                    <span className="text-label">
                      {intl.formatMessage(messages.serverType)}
                    </span>
                    <div className="form-input-area">
                      <div className="text-sm text-gray-400">
                        {intl.formatMessage(
                          messages.adminCredentialsDescription,
                          {
                            mediaServerName:
                              getMediaServerTypeName(activeServerType),
                          }
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="username" className="text-label">
                      {intl.formatMessage(messages.adminUsername)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          type="text"
                          inputMode="text"
                          id="username"
                          name="username"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="password" className="text-label">
                      {intl.formatMessage(messages.adminPassword)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <SensitiveInput
                          as="field"
                          type="password"
                          inputMode="text"
                          id="password"
                          name="password"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {!isSetupSettings && (
                <>
                  <div className="form-row">
                    <label htmlFor="urlBase" className="text-label">
                      {intl.formatMessage(messages.urlBase)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          type="text"
                          inputMode="url"
                          id="urlBase"
                          name="urlBase"
                        />
                      </div>
                      {errors.urlBase &&
                        touched.urlBase &&
                        typeof errors.urlBase === 'string' && (
                          <div className="error">{errors.urlBase}</div>
                        )}
                    </div>
                  </div>
                </>
              )}
              <div className="form-row">
                <label htmlFor="jellyfinExternalUrl" className="text-label">
                  {intl.formatMessage(messages.externalUrl)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      type="text"
                      inputMode="url"
                      id="jellyfinExternalUrl"
                      name="jellyfinExternalUrl"
                    />
                  </div>
                  {errors.jellyfinExternalUrl &&
                    touched.jellyfinExternalUrl && (
                      <div className="error">{errors.jellyfinExternalUrl}</div>
                    )}
                </div>
              </div>
              <div className="form-row">
                <label
                  htmlFor="jellyfinForgotPasswordUrl"
                  className="text-label"
                >
                  {intl.formatMessage(messages.jellyfinForgotPasswordUrl)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      type="text"
                      inputMode="url"
                      id="jellyfinForgotPasswordUrl"
                      name="jellyfinForgotPasswordUrl"
                    />
                  </div>
                  {errors.jellyfinForgotPasswordUrl &&
                    touched.jellyfinForgotPasswordUrl && (
                      <div className="error">
                        {errors.jellyfinForgotPasswordUrl}
                      </div>
                    )}
                </div>
              </div>
              <div
                className={`actions ${isSetupSettings ? 'mt-0 border-0' : ''}`}
              >
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
            </form>
          );
        }}
      </Formik>
    </>
  );
};

export default SettingsJellyfin;

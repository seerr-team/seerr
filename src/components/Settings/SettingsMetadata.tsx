import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import MetadataSelector, {
  MetadataProviderType,
} from '@app/components/MetadataSelector';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Settings', {
  metadataProviderSettings: 'Metadata Providers',
  general: 'General',
  settings: 'Settings',
  seriesMetadataProvider: 'Series metadata provider',
  animeMetadataProvider: 'Anime metadata provider',
  metadataSettings: 'Settings for metadata provider',
  clickTest:
    'Click on the "Test" button to check connectivity with metadata providers',
  notTested: 'Not Tested',
  failed: 'Does not work',
  operational: 'Operational',
  providerStatus: 'Metadata Provider Status',
  chooseProvider: 'Choose metadata providers for different content types',
  metadataProviderSelection: 'Metadata Provider Selection',
  tmdbProviderDoesnotWork:
    'TMDB provider does not work, please select another metadata provider',
  tvdbProviderDoesnotWork:
    'TVDB provider does not work, please select another metadata provider',
  listenbrainzProviderDoesnotWork:
    'ListenBrainz did not respond — check the Metadata Provider Configuration',
  allChosenProvidersAreOperational:
    'All chosen metadata providers are operational',
  connectionTestFailed: 'Connection test failed',
  failedToSaveMetadataSettings: 'Failed to save metadata provider settings',
  metadataSettingsSaved: 'Metadata provider settings saved',
  metadataProviderConfiguration: 'Metadata Provider Configuration',
  metadataProviderConfigurationDescription:
    'Configure connection settings for the metadata providers used by music. Point these at self-hosted mirrors to bypass public rate limits.',
  listenbrainz: 'ListenBrainz',
  apiBaseUrl: 'API base URL',
  webBaseUrl: 'Web base URL',
  userToken: 'User token (optional)',
  musicMetadataSaved: 'Music metadata settings saved',
  musicMetadataSaveFailed: 'Failed to save music metadata settings',
});

type ProviderStatus = 'ok' | 'not tested' | 'failed';

interface ProviderResponse {
  tvdb: ProviderStatus;
  tmdb: ProviderStatus;
  listenbrainz: ProviderStatus;
}

interface MetadataValues {
  tv: MetadataProviderType;
  anime: MetadataProviderType;
}

interface MetadataSettings {
  metadata: MetadataValues;
}

interface ListenBrainzSettings {
  apiBaseUrl: string;
  webBaseUrl: string;
  userToken: string;
}

interface MusicMetadataSettings {
  listenbrainz: ListenBrainzSettings;
}

const mapStatusValue = (status: string): ProviderStatus => {
  if (status === 'ok') return 'ok';
  if (status === 'failed') return 'failed';
  return 'not tested';
};

const SettingsMetadata = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const defaultStatus: ProviderResponse = {
    tmdb: 'not tested',
    tvdb: 'not tested',
    listenbrainz: 'not tested',
  };

  const [providerStatus, setProviderStatus] =
    useState<ProviderResponse>(defaultStatus);

  const { data, error } = useSWR<MetadataSettings>(
    '/api/v1/settings/metadatas',
    async (url: string) => {
      const response = await axios.get<{
        tv: MetadataProviderType;
        anime: MetadataProviderType;
      }>(url);

      return {
        metadata: {
          tv: response.data.tv,
          anime: response.data.anime,
        },
      };
    }
  );

  const { data: musicData, mutate: mutateMusic } =
    useSWR<MusicMetadataSettings>('/api/v1/settings/music-metadata');

  const testConnection = async (
    values: MetadataValues,
    musicValues?: MusicMetadataSettings
  ): Promise<ProviderResponse> => {
    const useTmdb =
      values.tv === MetadataProviderType.TMDB ||
      values.anime === MetadataProviderType.TMDB;
    const useTvdb =
      values.tv === MetadataProviderType.TVDB ||
      values.anime === MetadataProviderType.TVDB;

    const tvDbTmdbPromise = axios
      .post<{
        success: boolean;
        tests: { tvdb: ProviderStatus; tmdb: ProviderStatus };
      }>('/api/v1/settings/metadatas/test', { tmdb: useTmdb, tvdb: useTvdb })
      .then((r) => r.data.tests)
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.data?.tests) {
          return e.response.data.tests as {
            tvdb: ProviderStatus;
            tmdb: ProviderStatus;
          };
        }
        return { tvdb: 'failed' as const, tmdb: 'failed' as const };
      });

    const musicPromise = axios
      .post<{
        success: boolean;
        tests: {
          listenbrainz: ProviderStatus;
        };
      }>('/api/v1/settings/music-metadata/test', musicValues ?? {})
      .then((r) => r.data.tests)
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.data?.tests) {
          return e.response.data.tests as {
            listenbrainz: ProviderStatus;
          };
        }
        return {
          listenbrainz: 'failed' as const,
        };
      });

    const [tvdbTmdb, music] = await Promise.all([
      tvDbTmdbPromise,
      musicPromise,
    ]);

    const newStatus: ProviderResponse = {
      tmdb: useTmdb ? mapStatusValue(tvdbTmdb.tmdb) : 'not tested',
      tvdb: useTvdb ? mapStatusValue(tvdbTmdb.tvdb) : 'not tested',
      listenbrainz: mapStatusValue(music.listenbrainz),
    };

    setProviderStatus(newStatus);
    return newStatus;
  };

  /**
   * Build the localized failure messages for a provider status response.
   * Shared by the top and bottom "Test" buttons so the wording / set of
   * checked providers stays in sync.
   */
  const collectProviderFailures = (resp: ProviderResponse): string[] => {
    const failures: string[] = [];
    if (resp.tvdb === 'failed') {
      failures.push(intl.formatMessage(messages.tvdbProviderDoesnotWork));
    }
    if (resp.tmdb === 'failed') {
      failures.push(intl.formatMessage(messages.tmdbProviderDoesnotWork));
    }
    if (resp.listenbrainz === 'failed') {
      failures.push(
        intl.formatMessage(messages.listenbrainzProviderDoesnotWork)
      );
    }
    return failures;
  };

  const toastProviderFailures = (resp: ProviderResponse): void => {
    const failures = collectProviderFailures(resp);
    if (failures.length > 0) {
      for (const msg of failures) {
        addToast(msg, { appearance: 'error', autoDismiss: true });
      }
    } else {
      addToast(intl.formatMessage(messages.allChosenProvidersAreOperational), {
        appearance: 'success',
        autoDismiss: true,
      });
    }
  };

  const saveSettings = async (
    values: MetadataValues
  ): Promise<MetadataSettings> => {
    try {
      const response = await axios.put<{
        success: boolean;
        tv: MetadataProviderType;
        anime: MetadataProviderType;
        tests?: { tvdb: ProviderStatus; tmdb: ProviderStatus };
      }>('/api/v1/settings/metadatas', {
        tv: values.tv,
        anime: values.anime,
      });

      if (response.data.tests) {
        setProviderStatus((prev) => ({
          ...prev,
          tmdb: mapStatusValue(response.data.tests!.tmdb),
          tvdb: mapStatusValue(response.data.tests!.tvdb),
        }));
      }

      return {
        metadata: {
          tv: response.data.tv,
          anime: response.data.anime,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as {
          success: boolean;
          tests?: { tvdb: string; tmdb: string };
        };
        if (errorData.tests) {
          setProviderStatus((prev) => ({
            ...prev,
            tmdb: mapStatusValue(errorData.tests!.tmdb),
            tvdb: mapStatusValue(errorData.tests!.tvdb),
          }));
        }
      }
      throw new Error('Failed to save Metadata settings', { cause: error });
    }
  };

  const getStatusClass = (status: ProviderStatus): string => {
    switch (status) {
      case 'ok':
        return 'text-green-500';
      case 'not tested':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
    }
  };

  const getStatusMessage = (status: ProviderStatus): string => {
    switch (status) {
      case 'ok':
        return intl.formatMessage(messages.operational);
      case 'not tested':
        return intl.formatMessage(messages.notTested);
      case 'failed':
        return intl.formatMessage(messages.failed);
    }
  };

  const getBadgeType = (
    status: ProviderStatus
  ):
    | 'default'
    | 'primary'
    | 'danger'
    | 'warning'
    | 'success'
    | 'dark'
    | 'light'
    | undefined => {
    switch (status) {
      case 'ok':
        return 'success';
      case 'not tested':
        return 'warning';
      case 'failed':
        return 'danger';
    }
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const initialValues: MetadataValues = data?.metadata || {
    tv: MetadataProviderType.TMDB,
    anime: MetadataProviderType.TMDB,
  };

  const musicInitialValues: MusicMetadataSettings | null = musicData ?? null;

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.general),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.metadataProviderSettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.metadataSettings)}
        </p>
      </div>

      <div className="mb-6 rounded-lg bg-gray-800 p-4">
        <h4 className="mb-3 text-lg font-medium">
          {intl.formatMessage(messages.providerStatus)}
        </h4>
        <div className="flex flex-col space-y-3">
          <div className="flex items-center">
            <span className="mr-2 w-32">TheMovieDB:</span>
            <span
              className={`text-sm ${getStatusClass(providerStatus.tmdb)}`}
              data-testid="tmdb-status-container"
            >
              <Badge badgeType={getBadgeType(providerStatus.tmdb)}>
                {getStatusMessage(providerStatus.tmdb)}
              </Badge>
            </span>
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32">TheTVDB:</span>
            <span
              className={`text-sm ${getStatusClass(providerStatus.tvdb)}`}
              data-testid="tvdb-status"
            >
              <Badge badgeType={getBadgeType(providerStatus.tvdb)}>
                {getStatusMessage(providerStatus.tvdb)}
              </Badge>
            </span>
          </div>
          <div className="flex items-center">
            <span className="mr-2 w-32">ListenBrainz:</span>
            <span
              className={`text-sm ${getStatusClass(providerStatus.listenbrainz)}`}
              data-testid="listenbrainz-status"
            >
              <Badge badgeType={getBadgeType(providerStatus.listenbrainz)}>
                {getStatusMessage(providerStatus.listenbrainz)}
              </Badge>
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <Formik
          initialValues={{ metadata: initialValues }}
          onSubmit={async (values) => {
            try {
              const result = await saveSettings(values.metadata);

              if (data) {
                data.metadata = result.metadata;
              }

              addToast(intl.formatMessage(messages.metadataSettingsSaved), {
                appearance: 'success',
                autoDismiss: true,
              });
            } catch {
              addToast(
                intl.formatMessage(messages.failedToSaveMetadataSettings),
                {
                  appearance: 'error',
                  autoDismiss: true,
                }
              );
            }
          }}
        >
          {({ isSubmitting, isValid, values, setFieldValue }) => {
            return (
              <Form className="section" data-testid="settings-main-form">
                <div className="mb-6">
                  <h2 className="heading">
                    {intl.formatMessage(messages.metadataProviderSelection)}
                  </h2>
                  <p className="description">
                    {intl.formatMessage(messages.chooseProvider)}
                  </p>
                </div>

                <div className="form-row">
                  <label
                    htmlFor="tv-metadata-provider"
                    className="checkbox-label"
                  >
                    <span className="mr-2">
                      {intl.formatMessage(messages.seriesMetadataProvider)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <MetadataSelector
                      testId="tv-metadata-provider-selector"
                      value={values.metadata.tv}
                      onChange={(value) => setFieldValue('metadata.tv', value)}
                      isDisabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label
                    htmlFor="anime-metadata-provider"
                    className="checkbox-label"
                  >
                    <span className="mr-2">
                      {intl.formatMessage(messages.animeMetadataProvider)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <MetadataSelector
                      testId="anime-metadata-provider-selector"
                      value={values.metadata.anime}
                      onChange={(value) =>
                        setFieldValue('metadata.anime', value)
                      }
                      isDisabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="actions">
                  <div className="flex justify-end">
                    <span className="ml-3 inline-flex rounded-md shadow-sm">
                      <Button
                        buttonType="warning"
                        type="button"
                        disabled={isSubmitting || !isValid}
                        onClick={async () => {
                          setIsTesting(true);
                          try {
                            const resp = await testConnection(values.metadata);
                            toastProviderFailures(resp);
                          } catch {
                            addToast(
                              intl.formatMessage(messages.connectionTestFailed),
                              { appearance: 'error', autoDismiss: true }
                            );
                          } finally {
                            setIsTesting(false);
                          }
                        }}
                      >
                        <BeakerIcon />
                        <span>
                          {isTesting
                            ? intl.formatMessage(globalMessages.testing)
                            : intl.formatMessage(globalMessages.test)}
                        </span>
                      </Button>
                    </span>

                    <span className="ml-3 inline-flex rounded-md shadow-sm">
                      <Button
                        data-testid="metadata-save-button"
                        buttonType="primary"
                        type="submit"
                        disabled={isSubmitting || !isValid || isTesting}
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

      <div className="section">
        <div className="mb-6">
          <h2 className="heading">
            {intl.formatMessage(messages.metadataProviderConfiguration)}
          </h2>
          <p className="description">
            {intl.formatMessage(
              messages.metadataProviderConfigurationDescription
            )}
          </p>
        </div>

        {!musicInitialValues && <LoadingSpinner />}
        {musicInitialValues && (
          <Formik
            initialValues={musicInitialValues}
            enableReinitialize
            onSubmit={async (values) => {
              try {
                await axios.put('/api/v1/settings/music-metadata', values);
                await mutateMusic();
                addToast(intl.formatMessage(messages.musicMetadataSaved), {
                  appearance: 'success',
                  autoDismiss: true,
                });
              } catch {
                addToast(intl.formatMessage(messages.musicMetadataSaveFailed), {
                  appearance: 'error',
                  autoDismiss: true,
                });
              }
            }}
          >
            {({ isSubmitting, isValid, values }) => (
              <Form className="section">
                <div className="mb-4 mt-2">
                  <h4 className="heading">
                    {intl.formatMessage(messages.listenbrainz)}
                  </h4>
                </div>

                <div className="form-row">
                  <label
                    htmlFor="listenbrainz.apiBaseUrl"
                    className="text-label"
                  >
                    {intl.formatMessage(messages.apiBaseUrl)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="listenbrainz.apiBaseUrl"
                        name="listenbrainz.apiBaseUrl"
                        type="text"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <label
                    htmlFor="listenbrainz.webBaseUrl"
                    className="text-label"
                  >
                    {intl.formatMessage(messages.webBaseUrl)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="listenbrainz.webBaseUrl"
                        name="listenbrainz.webBaseUrl"
                        type="text"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <label
                    htmlFor="listenbrainz.userToken"
                    className="text-label"
                  >
                    {intl.formatMessage(messages.userToken)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <SensitiveInput
                        as="field"
                        id="listenbrainz.userToken"
                        name="listenbrainz.userToken"
                      />
                    </div>
                  </div>
                </div>

                <div className="actions">
                  <div className="flex justify-end">
                    <span className="ml-3 inline-flex rounded-md shadow-sm">
                      <Button
                        buttonType="warning"
                        type="button"
                        disabled={isSubmitting || !isValid || isTesting}
                        onClick={async () => {
                          setIsTesting(true);
                          try {
                            const resp = await testConnection(
                              data?.metadata ?? {
                                tv: MetadataProviderType.TMDB,
                                anime: MetadataProviderType.TMDB,
                              },
                              values
                            );
                            toastProviderFailures(resp);
                          } catch {
                            addToast(
                              intl.formatMessage(messages.connectionTestFailed),
                              { appearance: 'error', autoDismiss: true }
                            );
                          } finally {
                            setIsTesting(false);
                          }
                        }}
                      >
                        <BeakerIcon />
                        <span>
                          {isTesting
                            ? intl.formatMessage(globalMessages.testing)
                            : intl.formatMessage(globalMessages.test)}
                        </span>
                      </Button>
                    </span>

                    <span className="ml-3 inline-flex rounded-md shadow-sm">
                      <Button
                        buttonType="primary"
                        type="submit"
                        disabled={isSubmitting || !isValid || isTesting}
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
            )}
          </Formik>
        )}
      </div>
    </>
  );
};

export default SettingsMetadata;

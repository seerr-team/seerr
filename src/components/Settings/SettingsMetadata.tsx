import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
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
  theAudioDbProviderDoesnotWork:
    'TheAudioDB did not respond — check the Artwork Providers Configuration',
  allChosenProvidersAreOperational:
    'All chosen metadata providers are operational',
  connectionTestFailed: 'Connection test failed',
  failedToSaveMetadataSettings: 'Failed to save metadata provider settings',
  metadataSettingsSaved: 'Metadata provider settings saved',
  artworkProvidersConfiguration: 'Artwork Providers Configuration',
  artworkProvidersConfigurationDescription:
    'Configure rate limits and credentials for the artist-image provider used by music. The upstream is a hosted service with no self-hosted equivalent, so only the request rate and the API key are configurable.',
  theAudioDb: 'TheAudioDB',
  maxRPS: 'Max requests per second',
  maxRequests: 'Max in-flight requests',
  apiKey: 'API key (required)',
  artworkProvidersSaved: 'Artwork provider settings saved',
  artworkProvidersSaveFailed: 'Failed to save artwork provider settings',
});

type ProviderStatus = 'ok' | 'not tested' | 'failed';

interface ProviderResponse {
  tvdb: ProviderStatus;
  tmdb: ProviderStatus;
  theAudioDb: ProviderStatus;
}

interface MetadataValues {
  tv: MetadataProviderType;
  anime: MetadataProviderType;
}

interface MetadataSettings {
  metadata: MetadataValues;
}

interface TheAudioDbSettings {
  apiKey: string;
  maxRPS: number;
  maxRequests: number;
}

interface ArtworkProvidersSettings {
  theAudioDb: TheAudioDbSettings;
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
    theAudioDb: 'not tested',
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

  const { data: artworkData, mutate: mutateArtwork } =
    useSWR<ArtworkProvidersSettings>('/api/v1/settings/artwork-providers');

  const testConnection = async (
    values: MetadataValues
  ): Promise<ProviderResponse> => {
    const useTmdb =
      values.tv === MetadataProviderType.TMDB ||
      values.anime === MetadataProviderType.TMDB;
    const useTvdb =
      values.tv === MetadataProviderType.TVDB ||
      values.anime === MetadataProviderType.TVDB;

    const tvdbTmdbPromise = axios
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

    const artworkPromise = axios
      .post<{
        success: boolean;
        tests: {
          theAudioDb: ProviderStatus;
        };
      }>('/api/v1/settings/artwork-providers/test')
      .then((r) => r.data.tests)
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.data?.tests) {
          return e.response.data.tests as {
            theAudioDb: ProviderStatus;
          };
        }
        return {
          theAudioDb: 'failed' as const,
        };
      });

    const [tvdbTmdb, artwork] = await Promise.all([
      tvdbTmdbPromise,
      artworkPromise,
    ]);

    const newStatus: ProviderResponse = {
      tmdb: useTmdb ? mapStatusValue(tvdbTmdb.tmdb) : 'not tested',
      tvdb: useTvdb ? mapStatusValue(tvdbTmdb.tvdb) : 'not tested',
      theAudioDb: mapStatusValue(artwork.theAudioDb),
    };

    setProviderStatus(newStatus);
    return newStatus;
  };

  const saveSettings = async (
    values: MetadataValues
  ): Promise<MetadataSettings> => {
    try {
      const response = await axios.put<{
        success: boolean;
        tv: MetadataProviderType;
        anime: MetadataProviderType;
        tests?: {
          tvdb: ProviderStatus;
          tmdb: ProviderStatus;
        };
      }>('/api/v1/settings/metadatas', {
        tv: values.tv,
        anime: values.anime,
      });

      // Update metadata provider status if available
      if (response.data.tests) {
        setProviderStatus((prev) => ({
          ...prev,
          tmdb: mapStatusValue(response.data.tests!.tmdb),
          tvdb: mapStatusValue(response.data.tests!.tvdb),
        }));
      }

      // Adapt the response to the format expected by the component
      return {
        metadata: {
          tv: response.data.tv,
          anime: response.data.anime,
        },
      };
    } catch (error) {
      // Retrieve test data in case of error
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as {
          success: boolean;
          tests?: {
            tvdb: string;
            tmdb: string;
          };
        };

        // If test data is available in the error response
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

  const runProviderTests = async (
    metadataValues: MetadataValues
  ): Promise<void> => {
    setIsTesting(true);
    try {
      const resp = await testConnection(metadataValues);

      const failures: string[] = [];
      if (resp.tvdb === 'failed') {
        failures.push(intl.formatMessage(messages.tvdbProviderDoesnotWork));
      }
      if (resp.tmdb === 'failed') {
        failures.push(intl.formatMessage(messages.tmdbProviderDoesnotWork));
      }
      if (resp.theAudioDb === 'failed') {
        failures.push(
          intl.formatMessage(messages.theAudioDbProviderDoesnotWork)
        );
      }

      if (failures.length > 0) {
        for (const msg of failures) {
          addToast(msg, { appearance: 'error', autoDismiss: true });
        }
      } else {
        addToast(
          intl.formatMessage(messages.allChosenProvidersAreOperational),
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.connectionTestFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const runArtworkProviderTests = async (): Promise<void> => {
    setIsTesting(true);
    try {
      const resp = await axios
        .post<{
          success: boolean;
          tests: {
            theAudioDb: ProviderStatus;
          };
        }>('/api/v1/settings/artwork-providers/test')
        .then((r) => r.data.tests)
        .catch((e) => {
          if (axios.isAxiosError(e) && e.response?.data?.tests) {
            return e.response.data.tests as {
              theAudioDb: ProviderStatus;
            };
          }
          return {
            theAudioDb: 'failed' as const,
          };
        });

      const mapped = {
        theAudioDb: mapStatusValue(resp.theAudioDb),
      };

      setProviderStatus((prev) => ({
        ...prev,
        theAudioDb: mapped.theAudioDb,
      }));

      const failures: string[] = [];
      if (mapped.theAudioDb === 'failed') {
        failures.push(
          intl.formatMessage(messages.theAudioDbProviderDoesnotWork)
        );
      }

      if (failures.length > 0) {
        for (const msg of failures) {
          addToast(msg, { appearance: 'error', autoDismiss: true });
        }
      } else {
        addToast(
          intl.formatMessage(messages.allChosenProvidersAreOperational),
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.connectionTestFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const initialValues: MetadataValues = data?.metadata || {
    tv: MetadataProviderType.TMDB,
    anime: MetadataProviderType.TMDB,
  };

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
            <span className="mr-2 w-44 whitespace-nowrap">TheMovieDB:</span>
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
            <span className="mr-2 w-44 whitespace-nowrap">TheTVDB:</span>
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
            <span className="mr-2 w-44 whitespace-nowrap">TheAudioDB:</span>
            <span
              className={`text-sm ${getStatusClass(providerStatus.theAudioDb)}`}
              data-testid="theaudiodb-status"
            >
              <Badge badgeType={getBadgeType(providerStatus.theAudioDb)}>
                {getStatusMessage(providerStatus.theAudioDb)}
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
                        disabled={isSubmitting || !isValid || isTesting}
                        onClick={() => runProviderTests(values.metadata)}
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

      <div className="mb-6 mt-10">
        <h3 className="heading">
          {intl.formatMessage(messages.artworkProvidersConfiguration)}
        </h3>
        <p className="description">
          {intl.formatMessage(
            messages.artworkProvidersConfigurationDescription
          )}
        </p>
      </div>

      <div className="section">
        <Formik
          initialValues={
            artworkData ?? {
              theAudioDb: { apiKey: '195003', maxRPS: 25, maxRequests: 20 },
            }
          }
          enableReinitialize
          onSubmit={async (values) => {
            try {
              const resp = await axios.put<{
                success: boolean;
                theAudioDb: TheAudioDbSettings;
              }>('/api/v1/settings/artwork-providers', values);
              mutateArtwork({
                theAudioDb: resp.data.theAudioDb,
              });
              addToast(intl.formatMessage(messages.artworkProvidersSaved), {
                appearance: 'success',
                autoDismiss: true,
              });
            } catch {
              addToast(
                intl.formatMessage(messages.artworkProvidersSaveFailed),
                {
                  appearance: 'error',
                  autoDismiss: true,
                }
              );
            }
          }}
        >
          {({ isSubmitting, isValid }) => (
            <Form className="section" data-testid="artwork-providers-form">
              <div className="mb-6">
                <h2 className="heading">
                  {intl.formatMessage(messages.theAudioDb)}
                </h2>
              </div>
              <div className="form-row">
                <label htmlFor="theAudioDb.apiKey" className="text-label">
                  {intl.formatMessage(messages.apiKey)}
                </label>
                <div className="form-input-area">
                  <Field
                    id="theAudioDb.apiKey"
                    name="theAudioDb.apiKey"
                    type="text"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="theAudioDb.maxRPS" className="text-label">
                  {intl.formatMessage(messages.maxRPS)}
                </label>
                <div className="form-input-area">
                  <Field
                    id="theAudioDb.maxRPS"
                    name="theAudioDb.maxRPS"
                    type="text"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="theAudioDb.maxRequests" className="text-label">
                  {intl.formatMessage(messages.maxRequests)}
                </label>
                <div className="form-input-area">
                  <Field
                    id="theAudioDb.maxRequests"
                    name="theAudioDb.maxRequests"
                    type="text"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="actions">
                <div className="flex justify-end">
                  <span className="ml-3 inline-flex rounded-md shadow-sm">
                    <Button
                      buttonType="warning"
                      type="button"
                      disabled={isSubmitting || !isValid || isTesting}
                      onClick={() => runArtworkProviderTests()}
                      data-testid="artwork-providers-test-button"
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
                      data-testid="artwork-providers-save-button"
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
      </div>
    </>
  );
};

export default SettingsMetadata;

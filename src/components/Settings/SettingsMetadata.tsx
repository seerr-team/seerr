import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import MetadataSelector, {
  MetadataProviderType,
} from '@app/components/MetadataSelector';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon, BeakerIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { Form, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
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
  allChosenProvidersAreOperational:
    'All chosen metadata providers are operational',
  connectionTestFailed: 'Connection test failed',
  failedToSaveMetadataSettings: 'Failed to save metadata provider settings',
  metadataSettingsSaved: 'Metadata provider settings saved',
});

type ProviderStatus = 'ok' | 'not tested' | 'failed';

interface ProviderResponse {
  tvdb: ProviderStatus;
  tmdb: ProviderStatus;
}

interface MetadataValues {
  tv: MetadataProviderType;
  anime: MetadataProviderType;
}

interface MetadataSettings {
  metadata: MetadataValues;
}

const SettingsMetadata = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const defaultStatus: ProviderResponse = {
    tmdb: 'not tested',
    tvdb: 'not tested',
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

  const testConnection = async (
    values: MetadataValues
  ): Promise<ProviderResponse> => {
    const useTmdb =
      values.tv === MetadataProviderType.TMDB ||
      values.anime === MetadataProviderType.TMDB;
    const useTvdb =
      values.tv === MetadataProviderType.TVDB ||
      values.anime === MetadataProviderType.TVDB;

    const testData = {
      tmdb: useTmdb,
      tvdb: useTvdb,
    };

    try {
      const response = await axios.post<{
        success: boolean;
        tests: ProviderResponse;
      }>('/api/v1/settings/metadatas/test', testData);

      const newStatus: ProviderResponse = {
        tmdb: useTmdb ? response.data.tests.tmdb : 'not tested',
        tvdb: useTvdb ? response.data.tests.tvdb : 'not tested',
      };

      setProviderStatus(newStatus);
      return newStatus;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // If we receive an error response with a valid format
        const errorData = error.response.data as {
          success: boolean;
          tests: ProviderResponse;
        };

        if (errorData.tests) {
          const newStatus: ProviderResponse = {
            tmdb: useTmdb ? errorData.tests.tmdb : 'not tested',
            tvdb: useTvdb ? errorData.tests.tvdb : 'not tested',
          };

          setProviderStatus(newStatus);
          return newStatus;
        }
      }

      // In case of error without usable data
      throw new Error('Failed to test connection');
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
        const mapStatusValue = (status: string): ProviderStatus => {
          if (status === 'ok') return 'ok';
          if (status === 'failed') return 'failed';
          return 'not tested';
        };

        setProviderStatus({
          tmdb: mapStatusValue(response.data.tests.tmdb),
          tvdb: mapStatusValue(response.data.tests.tvdb),
        });
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
          const mapStatusValue = (status: string): ProviderStatus => {
            if (status === 'ok') return 'ok';
            if (status === 'failed') return 'failed';
            return 'not tested';
          };

          // Update metadata provider status with error data
          setProviderStatus({
            tmdb: mapStatusValue(errorData.tests.tmdb),
            tvdb: mapStatusValue(errorData.tests.tvdb),
          });
        }
      }

      throw new Error('Failed to save Metadata settings');
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
            <span className="mr-2 w-24">TheMovieDB:</span>
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
            <span className="mr-2 w-24">TheTVDB:</span>
            <span
              className={`text-sm ${getStatusClass(providerStatus.tvdb)}`}
              data-testid="tvdb-status"
            >
              <Badge badgeType={getBadgeType(providerStatus.tvdb)}>
                {getStatusMessage(providerStatus.tvdb)}
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
              });
            } catch (e) {
              addToast(
                intl.formatMessage(messages.failedToSaveMetadataSettings),
                {
                  appearance: 'error',
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

                            if (resp.tvdb === 'failed') {
                              addToast(
                                intl.formatMessage(
                                  messages.tvdbProviderDoesnotWork
                                ),
                                {
                                  appearance: 'error',
                                  autoDismiss: true,
                                }
                              );
                            } else if (resp.tmdb === 'failed') {
                              addToast(
                                intl.formatMessage(
                                  messages.tmdbProviderDoesnotWork
                                ),
                                {
                                  appearance: 'error',
                                  autoDismiss: true,
                                }
                              );
                            } else {
                              addToast(
                                intl.formatMessage(
                                  messages.allChosenProvidersAreOperational
                                ),
                                {
                                  appearance: 'success',
                                }
                              );
                            }
                          } catch (e) {
                            addToast(
                              intl.formatMessage(messages.connectionTestFailed),
                              {
                                appearance: 'error',
                                autoDismiss: true,
                              }
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
    </>
  );
};

export default SettingsMetadata;

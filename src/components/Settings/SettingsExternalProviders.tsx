import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import type { ExternalProvider } from '@app/components/Settings/SettingsExternalProviderModal/SettingsExternalProviderModal';
import SettingsExternalProviderModal from '@app/components/Settings/SettingsExternalProviderModal/SettingsExternalProviderModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings.ExternalProviders', {
  externalProviders: 'External Providers',
  externalProviderSettings: 'External Provider Settings',
  externalProviderSettingsDescription:
    'Add external APIs that return TMDB or TVDB IDs. You can use these providers later when creating custom Discover sliders.',
  addProvider: 'Add Provider',
  configuredProviders: 'Configured Providers',
  noProviders: 'No external providers configured.',
  edit: 'Edit',
  delete: 'Delete',
});

const SettingsExternalProviders = () => {
  const intl = useIntl();

  const [providers, setProviders] = useState<ExternalProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalProvider, setModalProvider] = useState<ExternalProvider | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const providersResponse = await axios.get<ExternalProvider[]>(
        '/api/v1/settings/external-providers/providers'
      );

      setProviders(providersResponse.data);
    } catch {
      setError(
        'External providers could not be loaded. Check whether /api/v1/settings/external-providers/providers is registered and working.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setModalProvider(null);
    setIsModalOpen(true);
  };

  const openEditModal = (provider: ExternalProvider) => {
    setModalProvider(provider);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setModalProvider(null);
    setIsModalOpen(false);
  };

  const handleModalSave = async () => {
    closeModal();
    await loadData();
  };

  const deleteProvider = async (providerId: number) => {
    if (!window.confirm('Delete this provider?')) {
      return;
    }

    setError(null);

    try {
      await axios.delete(
        `/api/v1/settings/external-providers/providers/${providerId}`
      );
      await loadData();
    } catch {
      setError('External provider could not be deleted.');
    }
  };

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.externalProviders),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.externalProviderSettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.externalProviderSettingsDescription)}
        </p>
      </div>

      <div className="section">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {error && (
              <div className="mb-6 rounded-md bg-red-600 p-4 text-sm text-white">
                {error}
              </div>
            )}

            <div className="mb-8 flex h-40 max-w-lg items-center justify-center rounded-md border border-dashed border-gray-500">
              <button
                type="button"
                className="button-md-secondary inline-flex items-center"
                onClick={openCreateModal}
              >
                <span className="mr-2 text-xl leading-none">+</span>
                {intl.formatMessage(messages.addProvider)}
              </button>
            </div>

            <h3 className="heading">
              {intl.formatMessage(messages.configuredProviders)}
            </h3>

            <div className="mt-4 space-y-3">
              {providers.length === 0 && (
                <p className="description">
                  {intl.formatMessage(messages.noProviders)}
                </p>
              )}

              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-md border border-gray-700 bg-gray-800 p-4"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row">
                    <div>
                      <div className="font-bold text-white">
                        {provider.name}
                      </div>
                      <div className="break-all text-sm text-gray-300">
                        {provider.url}
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        ID: {provider.idType} | Media: {provider.mediaType} |
                        Cache: {provider.cacheMinutes} min |{' '}
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </div>

                      {(provider.itemsPath ||
                        provider.tmdbIdPath ||
                        provider.tvdbIdPath ||
                        provider.mediaTypePath ||
                        provider.defaultMediaType) && (
                        <div className="mt-1 text-xs text-gray-500">
                          Advanced mapping configured
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(provider)}
                        className="inline-flex items-center rounded-md border border-gray-500 bg-gray-700 px-4 py-2 text-sm font-medium text-white transition hover:border-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z"
                          />
                        </svg>
                        {intl.formatMessage(messages.edit)}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteProvider(provider.id)}
                        className="inline-flex items-center rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-7 0h8"
                          />
                        </svg>
                        {intl.formatMessage(messages.delete)}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <SettingsExternalProviderModal
          provider={modalProvider}
          onClose={closeModal}
          onSave={handleModalSave}
        />
      )}
    </>
  );
};

export default SettingsExternalProviders;

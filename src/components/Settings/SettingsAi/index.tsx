import Button from '@app/components/Common/Button';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

interface AiSettings {
  enabled: boolean;
  provider: {
    type: 'openai' | 'ollama' | 'openrouter' | 'custom';
    apiKey?: string;
    hasApiKey?: boolean;
    baseUrl?: string;
    model: string;
  };
  recommendations: {
    enabled: boolean;
    sliderTitle: string;
    maxResults: number;
    minRating: number;
    ttlDays: number;
  };
  search: {
    enabled: boolean;
  };
}

const messages = defineMessages('components.Settings.SettingsAi', {
  aiSettings: 'AI Settings',
  aiSettingsDescription:
    'Configure AI-powered recommendations and search features.',
  loading: 'Loading…',
  providerConfiguration: 'Provider Configuration',
  enabled: 'Enable AI Features',
  enabledTip: 'Enable AI-powered recommendations and search',
  providerType: 'AI Provider',
  providerTypeTip:
    'Choose your AI provider (OpenAI, Ollama, OpenRouter, or custom)',
  apiKey: 'API Key',
  apiKeyTip: 'API key for your chosen provider (not required for Ollama)',
  apiKeySet: 'An API key is saved — leave blank to keep the current one',
  baseUrl: 'Base URL',
  baseUrlTip: 'Base URL for your AI provider API',
  model: 'Model',
  modelTip: 'AI model to use for recommendations (e.g., gpt-4o-mini, mistral)',
  testConnection: 'Test Connection',
  testing: 'Testing…',
  connectionSuccess: 'Connection test successful!',
  connectionFailure: 'Connection test failed!',
  recommendations: 'Recommendations',
  recommendationsEnabled: 'Enable Recommendations',
  recommendationsEnabledTip: 'Enable AI-powered personalized recommendations',
  sliderTitle: 'Slider Title',
  sliderTitleTip: 'Title for the recommendations slider on the discover page',
  maxResults: 'Max Results',
  maxResultsTip: 'Maximum number of recommendations to generate per user',
  minRating: 'Minimum Rating',
  minRatingTip:
    'Minimum TMDB rating (0.0–10.0) a recommendation must meet; higher values surface better-rated titles',
  ttlDays: 'Recommendation TTL (days)',
  ttlDaysTip:
    'How long a recommendation lives. Re-recommended titles stay alive; stale ones expire after this many days',
  validationTtlDays: 'TTL must be between 1 and 365 days',
  search: 'AI Search',
  searchEnabled: 'Enable AI Search',
  searchEnabledTip: 'Enable natural language search using AI',
  toastSettingsSuccess: 'AI settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving AI settings.',
  validationModelRequired: 'You must provide a model name',
  validationMaxResults: 'Max results must be between 1 and 50',
  validationMinRating: 'Minimum rating must be between 0 and 10',
  testingConnection: 'Testing AI connection…',
  connectionTestSuccess: 'Connection successful! Latency: {latency}ms',
  connectionTestFailure: 'Connection failed: {error}',
});

const SettingsAi = () => {
  const { addToast } = useToasts();
  const intl = useIntl();

  const { data, mutate } = useSWR<AiSettings>('/api/v1/ai/settings');

  const AiSettingsSchema = Yup.object().shape({
    provider: Yup.object().shape({
      model: Yup.string().required(
        intl.formatMessage(messages.validationModelRequired)
      ),
    }),
    recommendations: Yup.object().shape({
      maxResults: Yup.number()
        .min(1, intl.formatMessage(messages.validationMaxResults))
        .max(50, intl.formatMessage(messages.validationMaxResults))
        .required(),
      minRating: Yup.number()
        .min(0, intl.formatMessage(messages.validationMinRating))
        .max(10, intl.formatMessage(messages.validationMinRating))
        .required(),
      ttlDays: Yup.number()
        .min(1, intl.formatMessage(messages.validationTtlDays))
        .max(365, intl.formatMessage(messages.validationTtlDays))
        .required(),
    }),
  });

  const testConnection = async (provider: AiSettings['provider']) => {
    addToast(intl.formatMessage(messages.testingConnection), {
      appearance: 'info',
      autoDismiss: true,
    });

    try {
      const response = await axios.post('/api/v1/ai/test', { provider });

      if (response.data.success) {
        addToast(
          intl.formatMessage(messages.connectionTestSuccess, {
            latency: response.data.latency,
          }),
          { appearance: 'success', autoDismiss: true }
        );
      } else {
        addToast(
          intl.formatMessage(messages.connectionTestFailure, {
            error: response.data.error,
          }),
          { appearance: 'error', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.connectionFailure), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  if (!data) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        {intl.formatMessage(messages.loading)}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <PageTitle title={intl.formatMessage(messages.aiSettings)} />

      <Formik
        initialValues={data}
        validationSchema={AiSettingsSchema}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            await axios.put('/api/v1/ai/settings', values);
            mutate();
            addToast(intl.formatMessage(messages.toastSettingsSuccess), {
              appearance: 'success',
              autoDismiss: true,
            });
          } catch {
            addToast(intl.formatMessage(messages.toastSettingsFailure), {
              appearance: 'error',
              autoDismiss: true,
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, errors, touched, isSubmitting, handleChange }) => (
          <Form>
            <div className="section">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="mb-1">
                    {intl.formatMessage(messages.aiSettings)}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {intl.formatMessage(messages.aiSettingsDescription)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {/* Enable AI Features */}
              <div>
                <div className="flex cursor-pointer items-start">
                  <div className="relative flex items-center">
                    <input
                      id="ai-enabled"
                      type="checkbox"
                      name="enabled"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                      checked={values.enabled}
                      onChange={handleChange}
                    />
                  </div>
                  <label htmlFor="ai-enabled" className="ml-3 cursor-pointer">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      {intl.formatMessage(messages.enabled)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {intl.formatMessage(messages.enabledTip)}
                    </span>
                  </label>
                </div>
              </div>

              {/* Provider Configuration */}
              <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <h4 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {intl.formatMessage(messages.providerConfiguration)}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="provider.type"
                      className="block text-sm font-medium"
                    >
                      {intl.formatMessage(messages.providerType)}
                    </label>
                    <select
                      id="provider.type"
                      name="provider.type"
                      value={values.provider.type}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="custom">Custom</option>
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      {intl.formatMessage(messages.providerTypeTip)}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="provider.baseUrl"
                      className="block text-sm font-medium"
                    >
                      {intl.formatMessage(messages.baseUrl)}
                    </label>
                    <input
                      type="text"
                      id="provider.baseUrl"
                      name="provider.baseUrl"
                      value={values.provider.baseUrl || ''}
                      onChange={handleChange}
                      placeholder={
                        values.provider.type === 'ollama'
                          ? 'http://localhost:11434/v1'
                          : 'https://api.openai.com/v1'
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {intl.formatMessage(messages.baseUrlTip)}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="provider.model"
                      className="block text-sm font-medium"
                    >
                      {intl.formatMessage(messages.model)}
                    </label>
                    <input
                      type="text"
                      id="provider.model"
                      name="provider.model"
                      value={values.provider.model}
                      onChange={handleChange}
                      placeholder="gpt-4o-mini"
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {intl.formatMessage(messages.modelTip)}
                    </p>
                    {errors.provider?.model && touched.provider?.model && (
                      <div className="mt-1 text-sm text-red-600">
                        {errors.provider.model}
                      </div>
                    )}
                  </div>

                  {values.provider.type !== 'ollama' && (
                    <div>
                      <label
                        htmlFor="provider.apiKey"
                        className="block text-sm font-medium"
                      >
                        {intl.formatMessage(messages.apiKey)}
                      </label>
                      <SensitiveInput
                        id="provider.apiKey"
                        name="provider.apiKey"
                        value={values.provider.apiKey || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        {intl.formatMessage(messages.apiKeyTip)}
                      </p>
                      {data?.provider?.hasApiKey &&
                        !values.provider.apiKey &&
                        values.provider.type === data.provider.type &&
                        (values.provider.baseUrl ?? '') ===
                          (data.provider.baseUrl ?? '') && (
                          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                            {intl.formatMessage(messages.apiKeySet)}
                          </p>
                        )}
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={() => testConnection(values.provider)}
                    className="mt-2"
                  >
                    <ArrowPathIcon />
                    <span>{intl.formatMessage(messages.testConnection)}</span>
                  </Button>
                </div>
              </div>

              {/* Recommendations Settings */}
              <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <h4 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {intl.formatMessage(messages.recommendations)}
                </h4>

                <div className="space-y-4">
                  <div>
                    <div className="flex cursor-pointer items-start">
                      <div className="relative flex items-center">
                        <input
                          id="ai-recs-enabled"
                          type="checkbox"
                          name="recommendations.enabled"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                          checked={values.recommendations.enabled}
                          onChange={handleChange}
                        />
                      </div>
                      <label
                        htmlFor="ai-recs-enabled"
                        className="ml-3 cursor-pointer"
                      >
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                          {intl.formatMessage(messages.recommendationsEnabled)}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {intl.formatMessage(
                            messages.recommendationsEnabledTip
                          )}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="recommendations.sliderTitle"
                      className="block text-sm font-medium"
                    >
                      {intl.formatMessage(messages.sliderTitle)}
                    </label>
                    <input
                      type="text"
                      id="recommendations.sliderTitle"
                      name="recommendations.sliderTitle"
                      value={values.recommendations.sliderTitle}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {intl.formatMessage(messages.sliderTitleTip)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="recommendations.maxResults"
                        className="block text-sm font-medium"
                      >
                        {intl.formatMessage(messages.maxResults)}
                      </label>
                      <input
                        type="number"
                        id="recommendations.maxResults"
                        name="recommendations.maxResults"
                        min="1"
                        max="50"
                        value={values.recommendations.maxResults}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        {intl.formatMessage(messages.maxResultsTip)}
                      </p>
                      {errors.recommendations?.maxResults &&
                        touched.recommendations?.maxResults && (
                          <div className="mt-1 text-sm text-red-600">
                            {errors.recommendations.maxResults}
                          </div>
                        )}
                    </div>

                    <div>
                      <label
                        htmlFor="recommendations.minRating"
                        className="block text-sm font-medium"
                      >
                        {intl.formatMessage(messages.minRating)}
                      </label>
                      <input
                        type="number"
                        id="recommendations.minRating"
                        name="recommendations.minRating"
                        min="0"
                        max="10"
                        step="0.5"
                        value={values.recommendations.minRating}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        {intl.formatMessage(messages.minRatingTip)}
                      </p>
                      {errors.recommendations?.minRating &&
                        touched.recommendations?.minRating && (
                          <div className="mt-1 text-sm text-red-600">
                            {errors.recommendations.minRating}
                          </div>
                        )}
                    </div>

                    <div>
                      <label
                        htmlFor="recommendations.ttlDays"
                        className="block text-sm font-medium"
                      >
                        {intl.formatMessage(messages.ttlDays)}
                      </label>
                      <input
                        type="number"
                        id="recommendations.ttlDays"
                        name="recommendations.ttlDays"
                        min="1"
                        max="365"
                        value={values.recommendations.ttlDays}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        {intl.formatMessage(messages.ttlDaysTip)}
                      </p>
                      {errors.recommendations?.ttlDays &&
                        touched.recommendations?.ttlDays && (
                          <div className="mt-1 text-sm text-red-600">
                            {errors.recommendations.ttlDays}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Settings */}
              <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <h4 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {intl.formatMessage(messages.search)}
                </h4>

                <div>
                  <div className="flex cursor-pointer items-start">
                    <div className="relative flex items-center">
                      <input
                        id="ai-search-enabled"
                        type="checkbox"
                        name="search.enabled"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                        checked={values.search.enabled}
                        onChange={handleChange}
                      />
                    </div>
                    <label
                      htmlFor="ai-search-enabled"
                      className="ml-3 cursor-pointer"
                    >
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {intl.formatMessage(messages.searchEnabled)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {intl.formatMessage(messages.searchEnabledTip)}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    <ArrowDownOnSquareIcon />
                    <span>{intl.formatMessage(globalMessages.save)}</span>
                  </Button>
                </div>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default SettingsAi;

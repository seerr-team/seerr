import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import * as Yup from 'yup';

export type AuthType = 'none' | 'apiKey' | 'bearer';
export type IdType = 'tmdb' | 'tvdb' | 'mixed';
export type ExternalMediaType = 'movie' | 'tv' | 'mixed';

export type ExternalProvider = {
  id: number;
  name: string;
  url: string;
  authType: AuthType;
  apiKey?: string | null;
  apiKeyHeader?: string | null;
  bearerToken?: string | null;
  cacheMinutes: number;
  idType: IdType;
  mediaType: ExternalMediaType;
  itemsPath?: string | null;
  tmdbIdPath?: string | null;
  tvdbIdPath?: string | null;
  mediaTypePath?: string | null;
  defaultMediaType?: string | null;
  enabled: boolean;
};

type ExternalProviderFormValues = {
  name: string;
  url: string;
  authType: AuthType;
  apiKey: string;
  apiKeyHeader: string;
  bearerToken: string;
  cacheMinutes: string;
  idType: IdType;
  mediaType: ExternalMediaType;
  itemsPath: string;
  tmdbIdPath: string;
  tvdbIdPath: string;
  mediaTypePath: string;
  defaultMediaType: string;
  enabled: boolean;
};

type ExternalProviderTestResponse = {
  ok: boolean;
  status: number;
  totalParsed: number;
  sample?: {
    tmdbId?: number;
    tvdbId?: number;
    mediaType: string;
  }[];
};

type SettingsExternalProviderModalProps = {
  provider: ExternalProvider | null;
  onClose: () => void;
  onSave: () => void;
};

const messages = defineMessages('components.Settings.ExternalProviderModal', {
  createProvider: 'Add New External Provider',
  editProvider: 'Edit External Provider',
  providerName: 'Provider Name',
  providerUrl: 'Full URL',
  authentication: 'Authentication',
  apiKeyHeader: 'API Key Header',
  apiKey: 'API Key',
  bearerToken: 'Bearer Token',
  cacheMinutes: 'Cache Minutes',
  idType: 'ID Type',
  mediaType: 'Media Type',
  enabled: 'Enabled',
  advancedMapping: 'Advanced Mapping',
  showAdvancedMapping: 'Show Advanced Mapping',
  hideAdvancedMapping: 'Hide Advanced Mapping',
  itemsPath: 'Items Path',
  tmdbIdPath: 'TMDB ID Path',
  tvdbIdPath: 'TVDB ID Path',
  mediaTypePath: 'Media Type Path',
  defaultMediaType: 'Default Media Type',
  validationNameRequired: 'You must provide a provider name',
  validationUrlRequired: 'You must provide a valid URL',
  validationCacheMinutesRequired: 'You must provide a cache time',
  validationCacheMinutesInvalid: 'Cache time must be 0 or greater',
  toastProviderTestSuccess:
    'External provider connection established successfully. Parsed {count} item(s).',
  toastProviderTestFailure:
    'Failed to connect to external provider or detect valid TMDB/TVDB items.',
});

const isValidFullUrl = (value?: string): boolean => {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const getInitialValues = (
  provider: ExternalProvider | null
): ExternalProviderFormValues => ({
  name: provider?.name ?? '',
  url: provider?.url ?? '',
  authType: provider?.authType ?? 'none',
  apiKey: provider?.apiKey ?? '',
  apiKeyHeader: provider?.apiKeyHeader ?? 'X-Api-Key',
  bearerToken: provider?.bearerToken ?? '',
  cacheMinutes: String(provider?.cacheMinutes ?? 60),
  idType: provider?.idType ?? 'mixed',
  mediaType: provider?.mediaType ?? 'mixed',
  itemsPath: provider?.itemsPath ?? '',
  tmdbIdPath: provider?.tmdbIdPath ?? '',
  tvdbIdPath: provider?.tvdbIdPath ?? '',
  mediaTypePath: provider?.mediaTypePath ?? '',
  defaultMediaType: provider?.defaultMediaType ?? '',
  enabled: provider?.enabled ?? true,
});

const buildPayload = (
  values: ExternalProviderFormValues,
  provider?: ExternalProvider | null
) => ({
  providerId: provider?.id,
  name: values.name,
  url: values.url,
  authType: values.authType,

  apiKey:
    values.authType === 'apiKey'
      ? values.apiKey || provider?.apiKey || null
      : null,

  apiKeyHeader:
    values.authType === 'apiKey'
      ? values.apiKeyHeader || provider?.apiKeyHeader || 'X-Api-Key'
      : null,

  bearerToken:
    values.authType === 'bearer'
      ? values.bearerToken || provider?.bearerToken || null
      : null,

  cacheMinutes: Number(values.cacheMinutes || 0),
  idType: values.idType,
  mediaType: values.mediaType,
  enabled: values.enabled,
  itemsPath: values.itemsPath || null,
  tmdbIdPath: values.tmdbIdPath || null,
  tvdbIdPath: values.tvdbIdPath || null,
  mediaTypePath: values.mediaTypePath || null,
  defaultMediaType: values.defaultMediaType || null,
});

const SettingsExternalProviderModal = ({
  provider,
  onClose,
  onSave,
}: SettingsExternalProviderModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [isTesting, setIsTesting] = useState(false);
  const [isValidated, setIsValidated] = useState(Boolean(provider));
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(
    Boolean(
      provider?.itemsPath ||
      provider?.tmdbIdPath ||
      provider?.tvdbIdPath ||
      provider?.mediaTypePath ||
      provider?.defaultMediaType
    )
  );

  const ExternalProviderSchema = Yup.object().shape({
    name: Yup.string().required(
      intl.formatMessage(messages.validationNameRequired)
    ),
    url: Yup.string()
      .required(intl.formatMessage(messages.validationUrlRequired))
      .test(
        'valid-url',
        intl.formatMessage(messages.validationUrlRequired),
        isValidFullUrl
      ),
    cacheMinutes: Yup.number()
      .min(0, intl.formatMessage(messages.validationCacheMinutesInvalid))
      .required(intl.formatMessage(messages.validationCacheMinutesRequired)),
  });

  const testConnection = async (values: ExternalProviderFormValues) => {
    setIsTesting(true);

    try {
      const response = await axios.post<ExternalProviderTestResponse>(
        '/api/v1/settings/external-providers/providers/test',
        buildPayload(values, provider)
      );

      if (!response.data.ok || response.data.totalParsed <= 0) {
        throw new Error('No valid items detected.');
      }

      setIsValidated(true);
      addToast(
        intl.formatMessage(messages.toastProviderTestSuccess, {
          count: response.data.totalParsed,
        }),
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );
    } catch {
      setIsValidated(false);
      addToast(intl.formatMessage(messages.toastProviderTestFailure), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Transition
      as="div"
      show={true}
      enter="transition-opacity ease-in-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in-out duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={getInitialValues(provider)}
        validationSchema={ExternalProviderSchema}
        onSubmit={async (values) => {
          const payload = buildPayload(values, provider);

          if (provider) {
            await axios.put(
              `/api/v1/settings/external-providers/providers/${provider.id}`,
              payload
            );
          } else {
            await axios.post(
              '/api/v1/settings/external-providers/providers',
              payload
            );
          }

          onSave();
        }}
      >
        {({
          errors,
          touched,
          values,
          handleSubmit,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => (
          <Modal
            onCancel={onClose}
            okButtonType="primary"
            okText={
              isSubmitting
                ? intl.formatMessage(globalMessages.saving)
                : provider
                  ? intl.formatMessage(globalMessages.save)
                  : 'Add Provider'
            }
            secondaryButtonType="warning"
            secondaryText={
              isTesting
                ? intl.formatMessage(globalMessages.testing)
                : intl.formatMessage(globalMessages.test)
            }
            onSecondary={() => testConnection(values)}
            secondaryDisabled={
              !values.name || !values.url || isTesting || isSubmitting
            }
            okDisabled={!isValidated || isSubmitting || isTesting || !isValid}
            onOk={() => handleSubmit()}
            title={
              provider
                ? intl.formatMessage(messages.editProvider)
                : intl.formatMessage(messages.createProvider)
            }
          >
            <div className="mb-6">
              <div className="form-row">
                <label htmlFor="name" className="text-label">
                  {intl.formatMessage(messages.providerName)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                      placeholder="Name of the Provider"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setIsValidated(false);
                        setFieldValue('name', e.target.value);
                      }}
                    />
                  </div>
                  {errors.name &&
                    touched.name &&
                    typeof errors.name === 'string' && (
                      <div className="error">{errors.name}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="url" className="text-label">
                  {intl.formatMessage(messages.providerUrl)}
                  <span className="label-required">*</span>
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      id="url"
                      name="url"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      data-form-type="other"
                      data-1pignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                      placeholder="http://localhost:3999/recommendations"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setIsValidated(false);
                        setFieldValue('url', e.target.value);
                      }}
                    />
                  </div>
                  {errors.url &&
                    touched.url &&
                    typeof errors.url === 'string' && (
                      <div className="error">{errors.url}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="authType" className="text-label">
                  {intl.formatMessage(messages.authentication)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="select"
                      id="authType"
                      name="authType"
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setIsValidated(false);
                        setFieldValue('authType', e.target.value);
                      }}
                    >
                      <option value="none">None</option>
                      <option value="apiKey">API Key Header</option>
                      <option value="bearer">Bearer Token</option>
                    </Field>
                  </div>
                </div>
              </div>

              {values.authType === 'apiKey' && (
                <>
                  <div className="form-row">
                    <label htmlFor="apiKeyHeader" className="text-label">
                      {intl.formatMessage(messages.apiKeyHeader)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="apiKeyHeader"
                          name="apiKeyHeader"
                          type="text"
                          autoComplete="off"
                          data-form-type="other"
                          data-1pignore="true"
                          data-lpignore="true"
                          data-bwignore="true"
                          placeholder="X-Api-Key"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('apiKeyHeader', e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label htmlFor="apiKey" className="text-label">
                      {intl.formatMessage(messages.apiKey)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <SensitiveInput
                          as="field"
                          id="apiKey"
                          name="apiKey"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('apiKey', e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {values.authType === 'bearer' && (
                <div className="form-row">
                  <label htmlFor="bearerToken" className="text-label">
                    {intl.formatMessage(messages.bearerToken)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <SensitiveInput
                        as="field"
                        id="bearerToken"
                        name="bearerToken"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('bearerToken', e.target.value);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-row">
                <label htmlFor="cacheMinutes" className="text-label">
                  {intl.formatMessage(messages.cacheMinutes)}
                </label>
                <div className="form-input-area">
                  <Field
                    id="cacheMinutes"
                    name="cacheMinutes"
                    type="text"
                    inputMode="numeric"
                    className="short"
                    autoComplete="off"
                    data-form-type="other"
                    data-1pignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setIsValidated(false);
                      setFieldValue(
                        'cacheMinutes',
                        e.target.value.replace(/\D/g, '')
                      );
                    }}
                  />
                  <span className="label-tip">
                    Use 0 to request fresh data every time.
                  </span>
                  {errors.cacheMinutes &&
                    touched.cacheMinutes &&
                    typeof errors.cacheMinutes === 'string' && (
                      <div className="error">{errors.cacheMinutes}</div>
                    )}
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="idType" className="text-label">
                  {intl.formatMessage(messages.idType)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="select"
                      id="idType"
                      name="idType"
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setIsValidated(false);
                        setFieldValue('idType', e.target.value);
                      }}
                    >
                      <option value="mixed">Mixed</option>
                      <option value="tmdb">TMDB</option>
                      <option value="tvdb">TVDB</option>
                    </Field>
                  </div>
                  <span className="label-tip">
                    Choose TMDB or TVDB if the external API only returns generic
                    id fields.
                  </span>
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="mediaType" className="text-label">
                  {intl.formatMessage(messages.mediaType)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <Field
                      as="select"
                      id="mediaType"
                      name="mediaType"
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setIsValidated(false);
                        setFieldValue('mediaType', e.target.value);
                      }}
                    >
                      <option value="mixed">Mixed</option>
                      <option value="movie">Movie</option>
                      <option value="tv">TV</option>
                    </Field>
                  </div>
                  <span className="label-tip">
                    Choose Movie or TV when the external API does not return a
                    media type.
                  </span>
                </div>
              </div>

              <div className="form-row">
                <label className="checkbox-label">
                  {intl.formatMessage(messages.advancedMapping)}
                  <span className="label-tip">
                    Optional. Leave empty to enable automatic JSON detection.
                  </span>
                </label>
                <div className="form-input-area">
                  <button
                    type="button"
                    className="button-sm"
                    onClick={() =>
                      setShowAdvancedMapping((current) => !current)
                    }
                  >
                    {showAdvancedMapping
                      ? intl.formatMessage(messages.hideAdvancedMapping)
                      : intl.formatMessage(messages.showAdvancedMapping)}
                  </button>
                </div>
              </div>

              {showAdvancedMapping && (
                <>
                  <div className="form-row">
                    <label htmlFor="itemsPath" className="text-label">
                      {intl.formatMessage(messages.itemsPath)}
                      <span className="label-tip">
                        Examples: results, data.items, shows.
                      </span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="itemsPath"
                          name="itemsPath"
                          type="text"
                          placeholder="results"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('itemsPath', e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label htmlFor="tmdbIdPath" className="text-label">
                      {intl.formatMessage(messages.tmdbIdPath)}
                      <span className="label-tip">
                        Examples: tmdbId, tmdb_id, ids.tmdb.
                      </span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="tmdbIdPath"
                          name="tmdbIdPath"
                          type="text"
                          placeholder="ids.tmdb"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('tmdbIdPath', e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label htmlFor="tvdbIdPath" className="text-label">
                      {intl.formatMessage(messages.tvdbIdPath)}
                      <span className="label-tip">
                        Examples: tvdbId, tvdb_id, ids.tvdb.
                      </span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="tvdbIdPath"
                          name="tvdbIdPath"
                          type="text"
                          placeholder="ids.tvdb"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('tvdbIdPath', e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label htmlFor="mediaTypePath" className="text-label">
                      {intl.formatMessage(messages.mediaTypePath)}
                      <span className="label-tip">
                        Examples: mediaType, media_type, type.
                      </span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="mediaTypePath"
                          name="mediaTypePath"
                          type="text"
                          placeholder="mediaType"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('mediaTypePath', e.target.value);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label htmlFor="defaultMediaType" className="text-label">
                      {intl.formatMessage(messages.defaultMediaType)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="select"
                          id="defaultMediaType"
                          name="defaultMediaType"
                          onChange={(
                            e: React.ChangeEvent<HTMLSelectElement>
                          ) => {
                            setIsValidated(false);
                            setFieldValue('defaultMediaType', e.target.value);
                          }}
                        >
                          <option value="">None</option>
                          <option value="movie">Movie</option>
                          <option value="tv">TV</option>
                        </Field>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="form-row">
                <label htmlFor="enabled" className="checkbox-label">
                  {intl.formatMessage(messages.enabled)}
                </label>
                <div className="form-input-area">
                  <Field
                    type="checkbox"
                    id="enabled"
                    name="enabled"
                    onChange={() => {
                      setIsValidated(false);
                      setFieldValue('enabled', !values.enabled);
                    }}
                  />
                </div>
              </div>
            </div>
          </Modal>
        )}
      </Formik>
    </Transition>
  );
};

export default SettingsExternalProviderModal;

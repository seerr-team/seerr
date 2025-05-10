import Modal from '@app/components/Common/Modal';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import type { SonarrTestResponse } from '@app/components/Settings/SettingsServices';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { Transition } from '@headlessui/react';
import type { SonarrSettings } from '@server/interfaces/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { OnChangeValue } from 'react-select';
import Select from 'react-select';
import { useToasts } from 'react-toast-notifications';
import * as Yup from 'yup';

type OptionType = {
  value: number;
  label: string;
};

const messages = defineMessages('components.Settings.SonarrModal', {
  createsonarr: 'Add New Sonarr Server',
  create4ksonarr: 'Add New 4K Sonarr Server',
  editsonarr: 'Edit Sonarr Server',
  edit4ksonarr: 'Edit 4K Sonarr Server',
  validationNameRequired: 'You must provide a server name',
  validationHostnameRequired: 'You must provide a valid hostname or IP address',
  validationPortRequired: 'You must provide a valid port number',
  validationApiKeyRequired: 'You must provide an API key',
  validationRootFolderRequired: 'You must select a root folder',
  validationProfileRequired: 'You must select a quality profile',
  validationLanguageProfileRequired: 'You must select a language profile',
  toastSonarrTestSuccess: 'Sonarr connection established successfully!',
  toastSonarrTestFailure: 'Failed to connect to Sonarr.',
  add: 'Add Server',
  defaultserver: 'Default Server',
  default4kserver: 'Default 4K Server',
  servername: 'Server Name',
  hostname: 'Hostname or IP Address',
  port: 'Port',
  ssl: 'Use SSL',
  apiKey: 'API Key',
  baseUrl: 'URL Base',
  qualityprofile: 'Quality Profile',
  languageprofile: 'Language Profile',
  rootfolder: 'Root Folder',
  seriesType: 'Series Type',
  animeSeriesType: 'Anime Series Type',
  animequalityprofile: 'Anime Quality Profile',
  animelanguageprofile: 'Anime Language Profile',
  animerootfolder: 'Anime Root Folder',
  seasonfolders: 'Season Folders',
  server4k: '4K Server',
  selectQualityProfile: 'Select quality profile',
  selectRootFolder: 'Select root folder',
  selectLanguageProfile: 'Select language profile',
  loadingprofiles: 'Loading quality profiles…',
  testFirstQualityProfiles: 'Test connection to load quality profiles',
  loadingrootfolders: 'Loading root folders…',
  testFirstRootFolders: 'Test connection to load root folders',
  loadinglanguageprofiles: 'Loading language profiles…',
  testFirstLanguageProfiles: 'Test connection to load language profiles',
  loadingTags: 'Loading tags…',
  testFirstTags: 'Test connection to load tags',
  syncEnabled: 'Enable Scan',
  externalUrl: 'External URL',
  enableSearch: 'Enable Automatic Search',
  tagRequests: 'Tag Requests',
  tagRequestsInfo:
    "Automatically add an additional tag with the requester's user ID & display name",
  validationApplicationUrl: 'You must provide a valid URL',
  validationApplicationUrlTrailingSlash: 'URL must not end in a trailing slash',
  validationBaseUrlLeadingSlash: 'Base URL must have a leading slash',
  validationBaseUrlTrailingSlash: 'Base URL must not end in a trailing slash',
  tags: 'Tags',
  animeTags: 'Anime Tags',
  notagoptions: 'No tags.',
  selecttags: 'Select tags',
});

interface SonarrModalProps {
  sonarr: SonarrSettings | null;
  onClose: () => void;
  onSave: () => void;
}

const SonarrModal = ({ onClose, sonarr, onSave }: SonarrModalProps) => {
  const intl = useIntl();
  const initialLoad = useRef(false);
  const { addToast } = useToasts();
  const [isValidated, setIsValidated] = useState(sonarr ? true : false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<SonarrTestResponse>({
    profiles: [],
    rootFolders: [],
    languageProfiles: null,
    tags: [],
  });

  const SonarrSettingsSchema = Yup.object().shape({
    name: Yup.string().required(
      intl.formatMessage(messages.validationNameRequired)
    ),
    hostname: Yup.string().required(
      intl.formatMessage(messages.validationHostnameRequired)
    ),
    port: Yup.number()
      .nullable()
      .required(intl.formatMessage(messages.validationPortRequired)),
    apiKey: Yup.string().required(
      intl.formatMessage(messages.validationApiKeyRequired)
    ),
    rootFolder: Yup.string().required(
      intl.formatMessage(messages.validationRootFolderRequired)
    ),
    activeProfileId: Yup.string().required(
      intl.formatMessage(messages.validationProfileRequired)
    ),
    activeLanguageProfileId: testResponse.languageProfiles
      ? Yup.number().required(
          intl.formatMessage(messages.validationLanguageProfileRequired)
        )
      : Yup.number(),
    externalUrl: Yup.string()
      .test(
        'valid-url',
        intl.formatMessage(messages.validationApplicationUrl),
        isValidURL
      )
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationApplicationUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
    baseUrl: Yup.string()
      .test(
        'leading-slash',
        intl.formatMessage(messages.validationBaseUrlLeadingSlash),
        (value) => !value || value.startsWith('/')
      )
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationBaseUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
  });

  const testConnection = useCallback(
    async ({
      hostname,
      port,
      apiKey,
      baseUrl,
      useSsl = false,
    }: {
      hostname: string;
      port: number;
      apiKey: string;
      baseUrl?: string;
      useSsl?: boolean;
    }) => {
      setIsTesting(true);
      try {
        const response = await axios.post<SonarrTestResponse>(
          '/api/v1/settings/sonarr/test',
          {
            hostname,
            apiKey,
            port: Number(port),
            baseUrl,
            useSsl,
          }
        );

        setIsValidated(true);
        setTestResponse(response.data);
        if (initialLoad.current) {
          addToast(intl.formatMessage(messages.toastSonarrTestSuccess), {
            appearance: 'success',
            autoDismiss: true,
          });
        }
      } catch (e) {
        setIsValidated(false);
        if (initialLoad.current) {
          addToast(intl.formatMessage(messages.toastSonarrTestFailure), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      } finally {
        setIsTesting(false);
        initialLoad.current = true;
      }
    },
    [addToast, intl]
  );

  useEffect(() => {
    if (sonarr) {
      testConnection({
        apiKey: sonarr.apiKey,
        hostname: sonarr.hostname,
        port: sonarr.port,
        baseUrl: sonarr.baseUrl,
        useSsl: sonarr.useSsl,
      });
    }
  }, [sonarr, testConnection]);

  return (
    <Transition
      as="div"
      appear
      show
      enter="transition-opacity ease-in-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in-out duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={{
          name: sonarr?.name,
          hostname: sonarr?.hostname,
          port: sonarr?.port ?? 8989,
          ssl: sonarr?.useSsl ?? false,
          apiKey: sonarr?.apiKey,
          baseUrl: sonarr?.baseUrl,
          activeProfileId: sonarr?.activeProfileId,
          activeLanguageProfileId: sonarr?.activeLanguageProfileId,
          rootFolder: sonarr?.activeDirectory,
          seriesType: sonarr?.seriesType,
          animeSeriesType: sonarr?.animeSeriesType,
          activeAnimeProfileId: sonarr?.activeAnimeProfileId,
          activeAnimeLanguageProfileId: sonarr?.activeAnimeLanguageProfileId,
          activeAnimeRootFolder: sonarr?.activeAnimeDirectory,
          tags: sonarr?.tags ?? [],
          animeTags: sonarr?.animeTags ?? [],
          isDefault: sonarr?.isDefault ?? false,
          is4k: sonarr?.is4k ?? false,
          enableSeasonFolders: sonarr?.enableSeasonFolders ?? false,
          externalUrl: sonarr?.externalUrl,
          syncEnabled: sonarr?.syncEnabled ?? false,
          enableSearch: !sonarr?.preventSearch,
          tagRequests: sonarr?.tagRequests ?? false,
        }}
        validationSchema={SonarrSettingsSchema}
        onSubmit={async (values) => {
          try {
            const profileName = testResponse.profiles.find(
              (profile) => profile.id === Number(values.activeProfileId)
            )?.name;
            const animeProfileName = testResponse.profiles.find(
              (profile) => profile.id === Number(values.activeAnimeProfileId)
            )?.name;

            const submission = {
              name: values.name,
              hostname: values.hostname,
              port: Number(values.port),
              apiKey: values.apiKey,
              useSsl: values.ssl,
              baseUrl: values.baseUrl,
              activeProfileId: Number(values.activeProfileId),
              activeLanguageProfileId: values.activeLanguageProfileId
                ? Number(values.activeLanguageProfileId)
                : undefined,
              activeProfileName: profileName,
              activeDirectory: values.rootFolder,
              seriesType: values.seriesType,
              animeSeriesType: values.animeSeriesType,
              activeAnimeProfileId: values.activeAnimeProfileId
                ? Number(values.activeAnimeProfileId)
                : undefined,
              activeAnimeLanguageProfileId: values.activeAnimeLanguageProfileId
                ? Number(values.activeAnimeLanguageProfileId)
                : undefined,
              activeAnimeProfileName: animeProfileName ?? undefined,
              activeAnimeDirectory: values.activeAnimeRootFolder,
              tags: values.tags,
              animeTags: values.animeTags,
              is4k: values.is4k,
              isDefault: values.isDefault,
              enableSeasonFolders: values.enableSeasonFolders,
              externalUrl: values.externalUrl,
              syncEnabled: values.syncEnabled,
              preventSearch: !values.enableSearch,
              tagRequests: values.tagRequests,
            };
            if (!sonarr) {
              await axios.post('/api/v1/settings/sonarr', submission);
            } else {
              await axios.put(
                `/api/v1/settings/sonarr/${sonarr.id}`,
                submission
              );
            }

            onSave();
          } catch (e) {
            // set error here
          }
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
        }) => {
          return (
            <Modal
              onCancel={onClose}
              okButtonType="primary"
              okText={
                isSubmitting
                  ? intl.formatMessage(globalMessages.saving)
                  : sonarr
                  ? intl.formatMessage(globalMessages.save)
                  : intl.formatMessage(messages.add)
              }
              secondaryButtonType="warning"
              secondaryText={
                isTesting
                  ? intl.formatMessage(globalMessages.testing)
                  : intl.formatMessage(globalMessages.test)
              }
              onSecondary={() => {
                if (values.apiKey && values.hostname && values.port) {
                  testConnection({
                    apiKey: values.apiKey,
                    baseUrl: values.baseUrl,
                    hostname: values.hostname,
                    port: values.port,
                    useSsl: values.ssl,
                  });
                  if (!values.baseUrl || values.baseUrl === '/') {
                    setFieldValue('baseUrl', testResponse.urlBase);
                  }
                }
              }}
              secondaryDisabled={
                !values.apiKey ||
                !values.hostname ||
                !values.port ||
                isTesting ||
                isSubmitting
              }
              okDisabled={!isValidated || isSubmitting || isTesting || !isValid}
              onOk={() => handleSubmit()}
              title={
                !sonarr
                  ? intl.formatMessage(
                      values.is4k
                        ? messages.create4ksonarr
                        : messages.createsonarr
                    )
                  : intl.formatMessage(
                      values.is4k ? messages.edit4ksonarr : messages.editsonarr
                    )
              }
            >
              <div className="mb-6">
                <div className="form-row">
                  <label htmlFor="isDefault" className="checkbox-label">
                    {intl.formatMessage(
                      values.is4k
                        ? messages.default4kserver
                        : messages.defaultserver
                    )}
                  </label>
                  <div className="form-input-area">
                    <Field type="checkbox" id="isDefault" name="isDefault" />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="is4k" className="checkbox-label">
                    {intl.formatMessage(messages.server4k)}
                  </label>
                  <div className="form-input-area">
                    <Field type="checkbox" id="is4k" name="is4k" />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="name" className="text-label">
                    {intl.formatMessage(messages.servername)}
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
                  <label htmlFor="hostname" className="text-label">
                    {intl.formatMessage(messages.hostname)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <span className="protocol">
                        {values.ssl ? 'https://' : 'http://'}
                      </span>
                      <Field
                        id="hostname"
                        name="hostname"
                        type="text"
                        inputMode="url"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('hostname', e.target.value);
                        }}
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
                      id="port"
                      name="port"
                      type="text"
                      inputMode="numeric"
                      className="short"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setIsValidated(false);
                        setFieldValue('port', e.target.value);
                      }}
                    />
                    {errors.port &&
                      touched.port &&
                      typeof errors.port === 'string' && (
                        <div className="error">{errors.port}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="ssl" className="checkbox-label">
                    {intl.formatMessage(messages.ssl)}
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="ssl"
                      name="ssl"
                      onChange={() => {
                        setIsValidated(false);
                        setFieldValue('ssl', !values.ssl);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="apiKey" className="text-label">
                    {intl.formatMessage(messages.apiKey)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <SensitiveInput
                        as="field"
                        id="apiKey"
                        name="apiKey"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('apiKey', e.target.value);
                        }}
                      />
                    </div>
                    {errors.apiKey &&
                      touched.apiKey &&
                      typeof errors.apiKey === 'string' && (
                        <div className="error">{errors.apiKey}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="baseUrl" className="text-label">
                    {intl.formatMessage(messages.baseUrl)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="baseUrl"
                        name="baseUrl"
                        type="text"
                        inputMode="url"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setIsValidated(false);
                          setFieldValue('baseUrl', e.target.value);
                        }}
                      />
                    </div>
                    {errors.baseUrl &&
                      touched.baseUrl &&
                      typeof errors.baseUrl === 'string' && (
                        <div className="error">{errors.baseUrl}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="seriesType" className="text-label">
                    {intl.formatMessage(messages.seriesType)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="seriesType"
                        name="seriesType"
                        disabled={!isValidated || isTesting}
                      >
                        <option value="standard">Standard</option>
                        <option value="daily">Daily</option>
                      </Field>
                    </div>
                  </div>
                  {errors.seriesType && touched.seriesType && (
                    <div className="error">{errors.seriesType}</div>
                  )}
                </div>
                <div className="form-row">
                  <label htmlFor="activeProfileId" className="text-label">
                    {intl.formatMessage(messages.qualityprofile)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="activeProfileId"
                        name="activeProfileId"
                        disabled={!isValidated || isTesting}
                      >
                        <option value="">
                          {isTesting
                            ? intl.formatMessage(messages.loadingprofiles)
                            : !isValidated
                            ? intl.formatMessage(
                                messages.testFirstQualityProfiles
                              )
                            : intl.formatMessage(messages.selectQualityProfile)}
                        </option>
                        {testResponse.profiles.length > 0 &&
                          testResponse.profiles.map((profile) => (
                            <option
                              key={`loaded-profile-${profile.id}`}
                              value={profile.id}
                            >
                              {profile.name}
                            </option>
                          ))}
                      </Field>
                    </div>
                    {errors.activeProfileId &&
                      touched.activeProfileId &&
                      typeof errors.activeProfileId === 'string' && (
                        <div className="error">{errors.activeProfileId}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="rootFolder" className="text-label">
                    {intl.formatMessage(messages.rootfolder)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="rootFolder"
                        name="rootFolder"
                        disabled={!isValidated || isTesting}
                      >
                        <option value="">
                          {isTesting
                            ? intl.formatMessage(messages.loadingrootfolders)
                            : !isValidated
                            ? intl.formatMessage(messages.testFirstRootFolders)
                            : intl.formatMessage(messages.selectRootFolder)}
                        </option>
                        {testResponse.rootFolders.length > 0 &&
                          testResponse.rootFolders.map((folder) => (
                            <option
                              key={`loaded-profile-${folder.id}`}
                              value={folder.path}
                            >
                              {folder.path}
                            </option>
                          ))}
                      </Field>
                    </div>
                    {errors.rootFolder &&
                      touched.rootFolder &&
                      typeof errors.rootFolder === 'string' && (
                        <div className="error">{errors.rootFolder}</div>
                      )}
                  </div>
                </div>
                {testResponse.languageProfiles && (
                  <div className="form-row">
                    <label
                      htmlFor="activeLanguageProfileId"
                      className="text-label"
                    >
                      {intl.formatMessage(messages.languageprofile)}
                      <span className="label-required">*</span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="select"
                          id="activeLanguageProfileId"
                          name="activeLanguageProfileId"
                          disabled={!isValidated || isTesting}
                        >
                          <option value="">
                            {isTesting
                              ? intl.formatMessage(
                                  messages.loadinglanguageprofiles
                                )
                              : !isValidated
                              ? intl.formatMessage(
                                  messages.testFirstLanguageProfiles
                                )
                              : intl.formatMessage(
                                  messages.selectLanguageProfile
                                )}
                          </option>
                          {testResponse.languageProfiles.length > 0 &&
                            testResponse.languageProfiles.map((language) => (
                              <option
                                key={`loaded-profile-${language.id}`}
                                value={language.id}
                              >
                                {language.name}
                              </option>
                            ))}
                        </Field>
                      </div>
                      {errors.activeLanguageProfileId &&
                        touched.activeLanguageProfileId && (
                          <div className="error">
                            {errors.activeLanguageProfileId}
                          </div>
                        )}
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <label htmlFor="tags" className="text-label">
                    {intl.formatMessage(messages.tags)}
                  </label>
                  <div className="form-input-area">
                    <Select<OptionType, true>
                      options={
                        isValidated
                          ? testResponse.tags.map((tag) => ({
                              label: tag.label,
                              value: tag.id,
                            }))
                          : []
                      }
                      isMulti
                      isDisabled={!isValidated || isTesting}
                      placeholder={
                        !isValidated
                          ? intl.formatMessage(messages.testFirstTags)
                          : isTesting
                          ? intl.formatMessage(messages.loadingTags)
                          : intl.formatMessage(messages.selecttags)
                      }
                      isLoading={isTesting}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      value={
                        isTesting
                          ? []
                          : (values.tags
                              .map((tagId) => {
                                const foundTag = testResponse.tags.find(
                                  (tag) => tag.id === tagId
                                );

                                if (!foundTag) {
                                  return undefined;
                                }

                                return {
                                  value: foundTag.id,
                                  label: foundTag.label,
                                };
                              })
                              .filter(
                                (option) => option !== undefined
                              ) as OptionType[])
                      }
                      onChange={(value: OnChangeValue<OptionType, true>) => {
                        setFieldValue(
                          'tags',
                          value.map((option) => option.value)
                        );
                      }}
                      noOptionsMessage={() =>
                        intl.formatMessage(messages.notagoptions)
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="animeSeriesType" className="text-label">
                    {intl.formatMessage(messages.animeSeriesType)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="animeSeriesType"
                        name="animeSeriesType"
                        disabled={!isValidated || isTesting}
                      >
                        <option value="standard">Standard</option>
                        <option value="anime">Anime</option>
                      </Field>
                    </div>
                  </div>
                  {errors.animeSeriesType && touched.animeSeriesType && (
                    <div className="error">{errors.animeSeriesType}</div>
                  )}
                </div>
                <div className="form-row">
                  <label htmlFor="activeAnimeProfileId" className="text-label">
                    {intl.formatMessage(messages.animequalityprofile)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="activeAnimeProfileId"
                        name="activeAnimeProfileId"
                        disabled={!isValidated || isTesting}
                      >
                        <option value="">
                          {isTesting
                            ? intl.formatMessage(messages.loadingprofiles)
                            : !isValidated
                            ? intl.formatMessage(
                                messages.testFirstQualityProfiles
                              )
                            : intl.formatMessage(messages.selectQualityProfile)}
                        </option>
                        {testResponse.profiles.length > 0 &&
                          testResponse.profiles.map((profile) => (
                            <option
                              key={`loaded-profile-${profile.id}`}
                              value={profile.id}
                            >
                              {profile.name}
                            </option>
                          ))}
                      </Field>
                    </div>
                    {errors.activeAnimeProfileId &&
                      touched.activeAnimeProfileId && (
                        <div className="error">
                          {errors.activeAnimeProfileId}
                        </div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="activeAnimeRootFolder" className="text-label">
                    {intl.formatMessage(messages.animerootfolder)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="activeAnimeRootFolder"
                        name="activeAnimeRootFolder"
                        disabled={!isValidated || isTesting}
                      >
                        <option value="">
                          {isTesting
                            ? intl.formatMessage(messages.loadingrootfolders)
                            : !isValidated
                            ? intl.formatMessage(messages.testFirstRootFolders)
                            : intl.formatMessage(messages.selectRootFolder)}
                        </option>
                        {testResponse.rootFolders.length > 0 &&
                          testResponse.rootFolders.map((folder) => (
                            <option
                              key={`loaded-profile-${folder.id}`}
                              value={folder.path}
                            >
                              {folder.path}
                            </option>
                          ))}
                      </Field>
                    </div>
                    {errors.activeAnimeRootFolder &&
                      touched.activeAnimeRootFolder && (
                        <div className="error">{errors.rootFolder}</div>
                      )}
                  </div>
                </div>
                {testResponse.languageProfiles && (
                  <div className="form-row">
                    <label
                      htmlFor="activeAnimeLanguageProfileId"
                      className="text-label"
                    >
                      {intl.formatMessage(messages.animelanguageprofile)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="select"
                          id="activeAnimeLanguageProfileId"
                          name="activeAnimeLanguageProfileId"
                          disabled={!isValidated || isTesting}
                        >
                          <option value="">
                            {isTesting
                              ? intl.formatMessage(
                                  messages.loadinglanguageprofiles
                                )
                              : !isValidated
                              ? intl.formatMessage(
                                  messages.testFirstLanguageProfiles
                                )
                              : intl.formatMessage(
                                  messages.selectLanguageProfile
                                )}
                          </option>
                          {testResponse.languageProfiles.length > 0 &&
                            testResponse.languageProfiles.map((language) => (
                              <option
                                key={`loaded-profile-${language.id}`}
                                value={language.id}
                              >
                                {language.name}
                              </option>
                            ))}
                        </Field>
                      </div>
                      {errors.activeAnimeLanguageProfileId &&
                        touched.activeAnimeLanguageProfileId && (
                          <div className="error">
                            {errors.activeAnimeLanguageProfileId}
                          </div>
                        )}
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <label htmlFor="tags" className="text-label">
                    {intl.formatMessage(messages.animeTags)}
                  </label>
                  <div className="form-input-area">
                    <Select<OptionType, true>
                      options={
                        isValidated
                          ? testResponse.tags.map((tag) => ({
                              label: tag.label,
                              value: tag.id,
                            }))
                          : []
                      }
                      isMulti
                      isDisabled={!isValidated}
                      placeholder={
                        !isValidated
                          ? intl.formatMessage(messages.testFirstTags)
                          : isTesting
                          ? intl.formatMessage(messages.loadingTags)
                          : intl.formatMessage(messages.selecttags)
                      }
                      isLoading={isTesting}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      value={
                        isTesting
                          ? []
                          : (values.animeTags
                              .map((tagId) => {
                                const foundTag = testResponse.tags.find(
                                  (tag) => tag.id === tagId
                                );

                                if (!foundTag) {
                                  return undefined;
                                }

                                return {
                                  value: foundTag.id,
                                  label: foundTag.label,
                                };
                              })
                              .filter(
                                (option) => option !== undefined
                              ) as OptionType[])
                      }
                      onChange={(value) => {
                        setFieldValue(
                          'animeTags',
                          value.map((option) => option.value)
                        );
                      }}
                      noOptionsMessage={() =>
                        intl.formatMessage(messages.notagoptions)
                      }
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label
                    htmlFor="enableSeasonFolders"
                    className="checkbox-label"
                  >
                    {intl.formatMessage(messages.seasonfolders)}
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="enableSeasonFolders"
                      name="enableSeasonFolders"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="externalUrl" className="text-label">
                    {intl.formatMessage(messages.externalUrl)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="externalUrl"
                        name="externalUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                    {errors.externalUrl &&
                      touched.externalUrl &&
                      typeof errors.externalUrl === 'string' && (
                        <div className="error">{errors.externalUrl}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="syncEnabled" className="checkbox-label">
                    {intl.formatMessage(messages.syncEnabled)}
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="syncEnabled"
                      name="syncEnabled"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="enableSearch" className="checkbox-label">
                    {intl.formatMessage(messages.enableSearch)}
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="enableSearch"
                      name="enableSearch"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="tagRequests" className="checkbox-label">
                    {intl.formatMessage(messages.tagRequests)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.tagRequestsInfo)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="tagRequests"
                      name="tagRequests"
                    />
                  </div>
                </div>
              </div>
            </Modal>
          );
        }}
      </Formik>
    </Transition>
  );
};

export default SonarrModal;

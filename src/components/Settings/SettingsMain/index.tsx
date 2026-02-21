import BlocklistedTagsSelector from '@app/components/BlocklistedTagsSelector';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import LanguageSelector from '@app/components/LanguageSelector';
import RegionSelector from '@app/components/RegionSelector';
import CopyButton from '@app/components/Settings/CopyButton';
import SettingsBadge from '@app/components/Settings/SettingsBadge';
import { availableLanguages } from '@app/context/LanguageContext';
import useLocale from '@app/hooks/useLocale';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { isValidURL } from '@app/utils/urlValidationHelper';
import { ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import type { UserSettingsGeneralResponse } from '@server/interfaces/api/userSettingsInterfaces';
import type { MainSettings } from '@server/lib/settings';
import type { AvailableLocale } from '@server/types/languages';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';
import * as Yup from 'yup';

const messages = defineMessages('components.Settings.SettingsMain', {
  general: 'General',
  generalsettings: 'General Settings',
  generalsettingsDescription:
    'Configure global and default settings for Seerr.',
  apikey: 'API Key',
  apikeyCopied: 'Copied API key to clipboard.',
  applicationTitle: 'Application Title',
  applicationurl: 'Application URL',
  discoverRegion: 'Discover Region',
  discoverRegionTip: 'Filter content by regional availability',
  originallanguage: 'Discover Language',
  originallanguageTip: 'Filter content by original language',
  blocklistedTags: 'Blocklist Content with Tags',
  blocklistedTagsTip:
    'Automatically add content with tags to the blocklist using the "Process Blocklisted Tags" job',
  blocklistedTagsLimit: 'Limit Content Blocklisted per Tag',
  blocklistedTagsLimitTip:
    'The "Process Blocklisted Tags" job will blocklist this many pages into each sort. Larger numbers will create a more accurate blocklist, but use more space.',
  streamingRegion: 'Streaming Region',
  streamingRegionTip: 'Show streaming sites by regional availability',
  hideBlocklisted: 'Hide Blocklisted Items',
  hideBlocklistedTip:
    'Hide blocklisted items from discover pages for all users with the "Manage Blocklist" permission',
  toastApiKeySuccess: 'New API key generated successfully!',
  toastApiKeyFailure: 'Something went wrong while generating a new API key.',
  toastSettingsSuccess: 'Settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
  hideAvailable: 'Hide Available Media',
  hideAvailableTip:
    'Hide available media from the discover pages but not search results',
  cacheImages: 'Enable Image Caching',
  cacheImagesTip:
    'Cache externally sourced images (requires a significant amount of disk space)',
  validationApplicationTitle: 'You must provide an application title',
  validationApplicationUrl: 'You must provide a valid URL',
  validationApplicationUrlTrailingSlash: 'URL must not end in a trailing slash',
  partialRequestsEnabled: 'Allow Partial Series Requests',
  enableSpecialEpisodes: 'Allow Special Episodes Requests',
  removeUnmonitoredEnabled: 'Remove Unmonitored Media',
  removeUnmonitoredExplanation:
    'Remove Movies from Jellyseerr that are not available and have been un-monitored since',
  locale: 'Display Language',
  youtubeUrl: 'YouTube URL',
  youtubeUrlTip:
    'Base URL for YouTube videos if a self-hosted YouTube instance is used.',
  validationUrl: 'You must provide a valid URL',
  validationUrlTrailingSlash: 'URL must not end in a trailing slash',
});

const SettingsMain = () => {
  const { addToast } = useToasts();
  const { user: currentUser, hasPermission: userHasPermission } = useUser();
  const intl = useIntl();
  const { setLocale } = useLocale();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<MainSettings>('/api/v1/settings/main');
  const { data: userData } = useSWR<UserSettingsGeneralResponse>(
    currentUser ? `/api/v1/user/${currentUser.id}/settings/main` : null
  );

  const MainSettingsSchema = Yup.object().shape({
    applicationTitle: Yup.string().required(
      intl.formatMessage(messages.validationApplicationTitle)
    ),
    applicationUrl: Yup.string()
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
    blocklistedTagsLimit: Yup.number()
      .test(
        'positive',
        'Number must be greater than 0.',
        (value) => (value ?? 0) >= 0
      )
      .test(
        'lte-250',
        'Number must be less than or equal to 250.',
        (value) => (value ?? 0) <= 250
      ),
    youtubeUrl: Yup.string()
      .url(intl.formatMessage(messages.validationUrl))
      .test(
        'no-trailing-slash',
        intl.formatMessage(messages.validationUrlTrailingSlash),
        (value) => !value || !value.endsWith('/')
      ),
  });

  const regenerate = async () => {
    try {
      await axios.post('/api/v1/settings/main/regenerate');

      revalidate();
      addToast(intl.formatMessage(messages.toastApiKeySuccess), {
        autoDismiss: true,
        appearance: 'success',
      });
    } catch (e) {
      addToast(intl.formatMessage(messages.toastApiKeyFailure), {
        autoDismiss: true,
        appearance: 'error',
      });
    }
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

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
          {intl.formatMessage(messages.generalsettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.generalsettingsDescription)}
        </p>
      </div>
      <div className="section">
        <Formik
          initialValues={{
            applicationTitle: data?.applicationTitle,
            applicationUrl: data?.applicationUrl,
            hideAvailable: data?.hideAvailable,
            hideBlocklisted: data?.hideBlocklisted,
            locale: data?.locale ?? 'en',
            discoverRegion: data?.discoverRegion,
            originalLanguage: data?.originalLanguage,
            streamingRegion: data?.streamingRegion || 'US',
            blocklistedTags: data?.blocklistedTags,
            blocklistedTagsLimit: data?.blocklistedTagsLimit || 50,
            partialRequestsEnabled: data?.partialRequestsEnabled,
            enableSpecialEpisodes: data?.enableSpecialEpisodes,
            cacheImages: data?.cacheImages,
            youtubeUrl: data?.youtubeUrl,
            removeUnmonitoredEnabled: data?.removeUnmonitoredEnabled,
          }}
          enableReinitialize
          validationSchema={MainSettingsSchema}
          onSubmit={async (values) => {
            try {
              await axios.post('/api/v1/settings/main', {
                applicationTitle: values.applicationTitle,
                applicationUrl: values.applicationUrl,
                hideAvailable: values.hideAvailable,
                hideBlocklisted: values.hideBlocklisted,
                locale: values.locale,
                discoverRegion: values.discoverRegion,
                streamingRegion: values.streamingRegion,
                originalLanguage: values.originalLanguage,
                blocklistedTags: values.blocklistedTags,
                blocklistedTagsLimit: values.blocklistedTagsLimit,
                partialRequestsEnabled: values.partialRequestsEnabled,
                enableSpecialEpisodes: values.enableSpecialEpisodes,
                cacheImages: values.cacheImages,
                youtubeUrl: values.youtubeUrl,
                removeUnmonitoredEnabled: values.removeUnmonitoredEnabled,
              });
              mutate('/api/v1/settings/public');
              mutate('/api/v1/status');

              if (setLocale) {
                setLocale(
                  (userData?.locale
                    ? userData.locale
                    : values.locale) as AvailableLocale
                );
              }

              addToast(intl.formatMessage(messages.toastSettingsSuccess), {
                autoDismiss: true,
                appearance: 'success',
              });
            } catch (e) {
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
              <Form className="section" data-testid="settings-main-form">
                {userHasPermission(Permission.ADMIN) && (
                  <div className="form-row">
                    <label htmlFor="apiKey" className="text-label">
                      {intl.formatMessage(messages.apikey)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <SensitiveInput
                          type="text"
                          id="apiKey"
                          className="rounded-l-only"
                          value={data?.apiKey}
                          readOnly
                        />
                        <CopyButton
                          textToCopy={data?.apiKey ?? ''}
                          toastMessage={intl.formatMessage(
                            messages.apikeyCopied
                          )}
                          key={data?.apiKey}
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            regenerate();
                          }}
                          className="input-action"
                          type="button"
                        >
                          <ArrowPathIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <label htmlFor="applicationTitle" className="text-label">
                    {intl.formatMessage(messages.applicationTitle)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="applicationTitle"
                        name="applicationTitle"
                        type="text"
                      />
                    </div>
                    {errors.applicationTitle &&
                      touched.applicationTitle &&
                      typeof errors.applicationTitle === 'string' && (
                        <div className="error">{errors.applicationTitle}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="applicationUrl" className="text-label">
                    {intl.formatMessage(messages.applicationurl)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="applicationUrl"
                        name="applicationUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                    {errors.applicationUrl &&
                      touched.applicationUrl &&
                      typeof errors.applicationUrl === 'string' && (
                        <div className="error">{errors.applicationUrl}</div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="cacheImages" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.cacheImages)}
                    </span>
                    <SettingsBadge badgeType="experimental" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.cacheImagesTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="cacheImages"
                      name="cacheImages"
                      onChange={() => {
                        setFieldValue('cacheImages', !values.cacheImages);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="locale" className="text-label">
                    {intl.formatMessage(messages.locale)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field as="select" id="locale" name="locale">
                        {(
                          Object.keys(
                            availableLanguages
                          ) as (keyof typeof availableLanguages)[]
                        ).map((key) => (
                          <option
                            key={key}
                            value={availableLanguages[key].code}
                            lang={availableLanguages[key].code}
                          >
                            {availableLanguages[key].display}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="discoverRegion" className="text-label">
                    <span>{intl.formatMessage(messages.discoverRegion)}</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.discoverRegionTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <RegionSelector
                        value={values.discoverRegion ?? ''}
                        name="discoverRegion"
                        onChange={setFieldValue}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="originalLanguage" className="text-label">
                    <span>{intl.formatMessage(messages.originallanguage)}</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.originallanguageTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field relative z-30">
                      <LanguageSelector
                        setFieldValue={setFieldValue}
                        value={values.originalLanguage}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="streamingRegion" className="text-label">
                    <span>{intl.formatMessage(messages.streamingRegion)}</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.streamingRegionTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field relative z-20">
                      <RegionSelector
                        value={values.streamingRegion}
                        name="streamingRegion"
                        onChange={setFieldValue}
                        regionType="streaming"
                        disableAll
                      />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="blocklistedTags" className="text-label">
                    <span>{intl.formatMessage(messages.blocklistedTags)}</span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.blocklistedTagsTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field relative z-10">
                      <BlocklistedTagsSelector
                        defaultValue={values.blocklistedTags}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="blocklistedTagsLimit" className="text-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.blocklistedTagsLimit)}
                    </span>
                    <SettingsBadge badgeType="advanced" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.blocklistedTagsLimitTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      id="blocklistedTagsLimit"
                      name="blocklistedTagsLimit"
                      type="text"
                      inputMode="numeric"
                      className="short"
                      placeholder={50}
                    />
                    {errors.blocklistedTagsLimit &&
                      touched.blocklistedTagsLimit &&
                      typeof errors.blocklistedTagsLimit === 'string' && (
                        <div className="error">
                          {errors.blocklistedTagsLimit}
                        </div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="hideAvailable" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.hideAvailable)}
                    </span>
                    <SettingsBadge badgeType="experimental" />
                    <span className="label-tip">
                      {intl.formatMessage(messages.hideAvailableTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="hideAvailable"
                      name="hideAvailable"
                      onChange={() => {
                        setFieldValue('hideAvailable', !values.hideAvailable);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="hideBlocklisted" className="checkbox-label">
                    <span className="mr-2">
                      {intl.formatMessage(messages.hideBlocklisted)}
                    </span>
                    <span className="label-tip">
                      {intl.formatMessage(messages.hideBlocklistedTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="hideBlocklisted"
                      name="hideBlocklisted"
                      onChange={() => {
                        setFieldValue(
                          'hideBlocklisted',
                          !values.hideBlocklisted
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label
                    htmlFor="partialRequestsEnabled"
                    className="checkbox-label"
                  >
                    <span className="mr-2">
                      {intl.formatMessage(messages.partialRequestsEnabled)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="partialRequestsEnabled"
                      name="partialRequestsEnabled"
                      onChange={() => {
                        setFieldValue(
                          'partialRequestsEnabled',
                          !values.partialRequestsEnabled
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label
                    htmlFor="enableSpecialEpisodes"
                    className="checkbox-label"
                  >
                    <span className="mr-2">
                      {intl.formatMessage(messages.enableSpecialEpisodes)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="enableSpecialEpisodes"
                      name="enableSpecialEpisodes"
                      onChange={() => {
                        setFieldValue(
                          'enableSpecialEpisodes',
                          !values.enableSpecialEpisodes
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label
                    htmlFor="removeUnmonitoredEnabled"
                    className="checkbox-label"
                  >
                    <span className="mr-2">
                      {intl.formatMessage(messages.removeUnmonitoredEnabled)}
                    </span>
                    <SettingsBadge badgeType="experimental" />
                    <span className="label-tip">
                      {intl.formatMessage(
                        messages.removeUnmonitoredExplanation
                      )}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="checkbox"
                      id="removeUnmonitoredEnabled"
                      name="removeUnmonitoredEnabled"
                      onChange={() => {
                        setFieldValue(
                          'removeUnmonitoredEnabled',
                          !values.removeUnmonitoredEnabled
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="youtubeUrl" className="text-label">
                    {intl.formatMessage(messages.youtubeUrl)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.youtubeUrlTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="youtubeUrl"
                        name="youtubeUrl"
                        type="text"
                        inputMode="url"
                      />
                    </div>
                    {errors.youtubeUrl &&
                      touched.youtubeUrl &&
                      typeof errors.youtubeUrl === 'string' && (
                        <div className="error">{errors.youtubeUrl}</div>
                      )}
                  </div>
                </div>
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

export default SettingsMain;

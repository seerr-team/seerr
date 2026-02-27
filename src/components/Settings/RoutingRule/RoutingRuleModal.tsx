import Badge from '@app/components/Common/Badge';
import Modal from '@app/components/Common/Modal';
import LanguageSelector from '@app/components/LanguageSelector';
import {
  GenreSelector,
  KeywordSelector,
  UserSelector,
} from '@app/components/Selector';
import type { RoutingRule } from '@app/components/Settings/RoutingRule/types';
import type { DVRTestResponse } from '@app/components/Settings/SettingsServices';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/solid';
import type { RadarrSettings, SonarrSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import Select from 'react-select';
import { useToasts } from 'react-toast-notifications';
import * as Yup from 'yup';

type OptionType = { value: number; label: string };
type ServiceType = 'radarr' | 'sonarr';

const messages = defineMessages('components.Settings.RoutingRuleModal', {
  createRule: 'New Routing Rule',
  editRule: 'Edit Routing Rule',
  create: 'Create Rule',
  ruleName: 'Rule Name',
  ruleNamePlaceholder: 'e.g. Anime Content, Japanese Dramas',
  serviceType: 'Service Type',
  targetInstance: 'Target Instance',
  selectInstance: 'Select instance',
  firstInstanceSetup: 'First instance setup!',
  firstInstanceSetup4k: 'First 4K instance setup!',
  firstInstanceSetupBody:
    'We’re creating a fallback rule that catches all {mediaType} requests. You can customize defaults below or save to use instance defaults.',
  fallbackMustBeDefault: 'Fallback rules must target a default instance.',
  fallbackMustBe4k:
    'This fallback is for 4K requests, so it must target a 4K instance.',
  nonFallbackNeedsCondition:
    'Non-fallback rules must have at least one condition.',
  conditions: 'Conditions',
  conditionsDescription:
    'All condition types must match (AND). Within each type, any value can match (OR). Leave all empty for a fallback rule.',
  target: 'Target Settings',
  targetDescription:
    'Override settings for the target instance. Leave empty to use instance defaults.',
  users: 'Users',
  genres: 'Genres',
  languages: 'Languages',
  keywords: 'Keywords',
  rootFolder: 'Root Folder',
  selectRootFolder: 'Select root folder',
  qualityProfile: 'Quality Profile',
  selectQualityProfile: 'Select quality profile',
  minimumAvailability: 'Minimum Availability',
  announced: 'Announced',
  inCinemas: 'In Cinemas',
  released: 'Released',
  seriesType: 'Series Type',
  tags: 'Tags',
  selectTags: 'Select tags',
  noTagOptions: 'No tags.',
  badgeDefault: 'Default',
  badge4k: '4K',
  conditionalShouldNotBeDefault:
    'Conditional rules should target a non-default instance.',
  ruleCreated: 'Routing rule created successfully!',
  ruleUpdated: 'Routing rule updated successfully!',
  validationNameRequired: 'You must provide a rule name',
  validationTargetRequired: 'You must select a target instance',
  validationRootFolderRequired: 'You must select a root folder',
  validationProfileRequired: 'You must select a quality profile',
  validationMinimumAvailabilityRequired:
    'You must select a minimum availability',
});

interface RoutingRuleModalProps {
  rule: RoutingRule | null;
  onClose: () => void;
  radarrServices: RadarrSettings[];
  sonarrServices: SonarrSettings[];
  prefillData?: Partial<RoutingRule>;
}

const RoutingRuleModal = ({
  onClose,
  rule,
  radarrServices,
  sonarrServices,
  prefillData,
}: RoutingRuleModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { currentSettings } = useSettings();
  const [isValidated, setIsValidated] = useState(!!rule);
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<DVRTestResponse>({
    profiles: [],
    rootFolders: [],
    tags: [],
  });

  const isFallbackMode = !!(rule?.isFallback || prefillData?.isFallback);
  const isPrefillFallback = !rule && !!prefillData?.isFallback;
  const requires4kFallback = !!(
    isFallbackMode &&
    (rule?.is4k || prefillData?.is4k)
  );

  const getServiceInfos = useCallback(
    async (service: RadarrSettings | SonarrSettings, type: ServiceType) => {
      setIsTesting(true);
      try {
        const response = await axios.post<DVRTestResponse>(
          `/api/v1/settings/${type}/test`,
          {
            hostname: service.hostname,
            apiKey: service.apiKey,
            port: Number(service.port),
            baseUrl: service.baseUrl,
            useSsl: service.useSsl,
          }
        );

        setIsValidated(true);
        setTestResponse(response.data);
      } catch {
        setIsValidated(false);
        setTestResponse({ profiles: [], rootFolders: [], tags: [] });
      } finally {
        setIsTesting(false);
      }
    },
    []
  );

  useEffect(() => {
    const data = rule ?? prefillData;
    if (!data?.serviceType || data.targetServiceId == null) return;

    const services =
      data.serviceType === 'radarr' ? radarrServices : sonarrServices;
    const svc = services.find((s) => s.id === data.targetServiceId);
    if (!svc) return;

    getServiceInfos(svc, data.serviceType);
  }, [rule, prefillData, radarrServices, sonarrServices, getServiceInfos]);

  const RoutingRuleSchema = Yup.object().shape({
    name: Yup.string().required(
      intl.formatMessage(messages.validationNameRequired)
    ),
    targetServiceId: Yup.number()
      .required(intl.formatMessage(messages.validationTargetRequired))
      .min(0, intl.formatMessage(messages.validationTargetRequired)),
    isFallback: Yup.boolean().default(isFallbackMode),
    rootFolder: Yup.string().when('isFallback', {
      is: true,
      then: (s) =>
        s.required(intl.formatMessage(messages.validationRootFolderRequired)),
      otherwise: (s) => s.nullable(),
    }),
    activeProfileId: Yup.number()
      .transform((val, orig) =>
        orig === '' || orig == null ? null : Number(orig)
      )
      .nullable()
      .when('isFallback', {
        is: true,
        then: (s) =>
          s.required(intl.formatMessage(messages.validationProfileRequired)),
        otherwise: (s) => s.nullable(),
      }),
    minimumAvailability: Yup.string().when(['isFallback', 'serviceType'], {
      is: (isFallback: boolean, serviceType: ServiceType) =>
        isFallback && serviceType === 'radarr',
      then: (s) =>
        s.required(
          intl.formatMessage(messages.validationMinimumAvailabilityRequired)
        ),
      otherwise: (s) => s.nullable(),
    }),
  });

  const getDerivedFlags = (svc?: RadarrSettings | SonarrSettings) => {
    const isDefault = !!(svc && svc.isDefault);
    const is4k = !!(svc && svc.is4k);
    return { isDefault, is4k };
  };

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
          name: rule?.name ?? prefillData?.name ?? '',
          serviceType: (rule?.serviceType ??
            prefillData?.serviceType ??
            'sonarr') as ServiceType,
          targetServiceId:
            rule?.targetServiceId ?? prefillData?.targetServiceId ?? -1,
          isFallback: isFallbackMode,
          users: rule?.users ?? prefillData?.users ?? undefined,
          genres: rule?.genres ?? prefillData?.genres ?? undefined,
          languages: rule?.languages ?? prefillData?.languages ?? undefined,
          keywords: rule?.keywords ?? prefillData?.keywords ?? undefined,
          activeProfileId:
            rule?.activeProfileId ?? prefillData?.activeProfileId ?? undefined,
          rootFolder: rule?.rootFolder ?? prefillData?.rootFolder ?? undefined,
          minimumAvailability:
            rule?.minimumAvailability ??
            prefillData?.minimumAvailability ??
            'released',
          seriesType: rule?.seriesType ?? prefillData?.seriesType ?? undefined,
          tags: rule?.tags ?? prefillData?.tags ?? undefined,
        }}
        validationSchema={RoutingRuleSchema}
        onSubmit={async (values) => {
          try {
            const services =
              values.serviceType === 'radarr' ? radarrServices : sonarrServices;
            const selectedService = services.find(
              (s) => s.id === values.targetServiceId
            );
            const derived = getDerivedFlags(selectedService);

            const activeProfileId =
              values.activeProfileId == null
                ? null
                : Number(values.activeProfileId);

            const profileName =
              testResponse.profiles.find(
                (p) => p.id === Number(values.activeProfileId)
              )?.name ?? null;

            const submission = {
              name: values.name,
              serviceType: values.serviceType,
              targetServiceId: values.targetServiceId,
              isFallback: values.isFallback,
              is4k: derived.is4k,
              users: values.isFallback ? null : values.users || null,
              genres: values.isFallback ? null : values.genres || null,
              languages: values.isFallback ? null : values.languages || null,
              keywords: values.isFallback ? null : values.keywords || null,
              activeProfileId,
              activeProfileName: profileName,
              rootFolder: values.rootFolder || null,
              minimumAvailability:
                values.serviceType === 'radarr'
                  ? values.minimumAvailability || null
                  : null,
              seriesType:
                values.serviceType === 'sonarr'
                  ? values.seriesType || null
                  : null,
              tags: values.tags || null,
            };

            if (!rule) {
              await axios.post('/api/v1/routingRule', submission);
              addToast(intl.formatMessage(messages.ruleCreated), {
                appearance: 'success',
                autoDismiss: true,
              });
            } else {
              await axios.put(`/api/v1/routingRule/${rule.id}`, submission);
              addToast(intl.formatMessage(messages.ruleUpdated), {
                appearance: 'success',
                autoDismiss: true,
              });
            }
            onClose();
          } catch {
            // TODO: handle error
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
          const services =
            values.serviceType === 'radarr' ? radarrServices : sonarrServices;
          const selectedService = services.find(
            (s) => s.id === values.targetServiceId
          );
          const derived = getDerivedFlags(selectedService);

          const hasAnyCondition = !!(
            values.users ||
            values.genres ||
            values.languages ||
            values.keywords
          );

          const fallbackTargetOk =
            derived.isDefault && (!requires4kFallback || derived.is4k);

          const canSave =
            isValid &&
            isValidated &&
            (!values.isFallback ? hasAnyCondition : fallbackTargetOk);

          const optionsDisabled = !isValidated || isTesting;

          return (
            <Modal
              onCancel={onClose}
              okButtonType="primary"
              okText={
                isSubmitting
                  ? intl.formatMessage(globalMessages.saving)
                  : rule
                    ? intl.formatMessage(globalMessages.save)
                    : intl.formatMessage(messages.create)
              }
              okDisabled={isSubmitting || !isValid || !canSave}
              onOk={() => handleSubmit()}
              title={
                !rule
                  ? intl.formatMessage(messages.createRule)
                  : intl.formatMessage(messages.editRule)
              }
            >
              <div className="mb-6">
                {isPrefillFallback && (
                  <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-900/10 p-3">
                    <div className="flex items-start gap-2">
                      <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
                      <div className="text-sm text-blue-200">
                        <strong>
                          {intl.formatMessage(
                            requires4kFallback
                              ? messages.firstInstanceSetup4k
                              : messages.firstInstanceSetup
                          )}
                        </strong>{' '}
                        {intl.formatMessage(messages.firstInstanceSetupBody, {
                          mediaType:
                            values.serviceType === 'radarr' ? 'movie' : 'TV',
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <label htmlFor="name" className="text-label">
                    {intl.formatMessage(messages.ruleName)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        id="name"
                        name="name"
                        type="text"
                        placeholder={intl.formatMessage(
                          messages.ruleNamePlaceholder
                        )}
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
                  <label htmlFor="serviceType" className="text-label">
                    {intl.formatMessage(messages.serviceType)}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="serviceType"
                        name="serviceType"
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setFieldValue('serviceType', e.target.value);
                          setFieldValue('targetServiceId', -1);
                          setIsValidated(false);
                          setTestResponse({
                            profiles: [],
                            rootFolders: [],
                            tags: [],
                          });
                          setFieldValue('activeProfileId', undefined);
                          setFieldValue('rootFolder', undefined);
                          setFieldValue('tags', undefined);
                          setFieldValue('seriesType', undefined);
                          setFieldValue('minimumAvailability', 'released');
                        }}
                      >
                        <option value="sonarr">Sonarr</option>
                        <option value="radarr">Radarr</option>
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <label htmlFor="targetServiceId" className="text-label">
                    {intl.formatMessage(messages.targetInstance)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="targetServiceId"
                        name="targetServiceId"
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const id = Number(e.target.value);
                          setFieldValue('targetServiceId', id);

                          const svc = services.find((s) => s.id === id);
                          if (svc) {
                            getServiceInfos(svc, values.serviceType);
                          } else {
                            setIsValidated(false);
                            setTestResponse({
                              profiles: [],
                              rootFolders: [],
                              tags: [],
                            });
                          }
                        }}
                      >
                        <option value={-1}>
                          {intl.formatMessage(messages.selectInstance)}
                        </option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </Field>
                    </div>

                    {selectedService && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {derived.isDefault && (
                          <Badge badgeType="primary">
                            {intl.formatMessage(messages.badgeDefault)}
                          </Badge>
                        )}
                        {derived.is4k && (
                          <Badge badgeType="warning">
                            {intl.formatMessage(messages.badge4k)}
                          </Badge>
                        )}
                      </div>
                    )}

                    {values.isFallback &&
                      values.targetServiceId >= 0 &&
                      !derived.isDefault && (
                        <div className="mt-2 rounded-md border border-red-500/30 bg-red-900/10 p-2 text-sm text-red-200">
                          {intl.formatMessage(messages.fallbackMustBeDefault)}
                        </div>
                      )}

                    {values.isFallback &&
                      requires4kFallback &&
                      values.targetServiceId >= 0 &&
                      derived.isDefault &&
                      !derived.is4k && (
                        <div className="mt-2 rounded-md border border-red-500/30 bg-red-900/10 p-2 text-sm text-red-200">
                          {intl.formatMessage(messages.fallbackMustBe4k)}
                        </div>
                      )}

                    {!values.isFallback && !hasAnyCondition && (
                      <div className="mt-2 text-xs text-gray-400">
                        {intl.formatMessage(messages.nonFallbackNeedsCondition)}
                      </div>
                    )}

                    {errors.targetServiceId &&
                      touched.targetServiceId &&
                      typeof errors.targetServiceId === 'string' && (
                        <div className="error">{errors.targetServiceId}</div>
                      )}
                  </div>
                </div>

                {!values.isFallback && (
                  <>
                    <h3 className="mt-4 text-lg font-bold leading-8 text-gray-100">
                      {intl.formatMessage(messages.conditions)}
                    </h3>
                    <p className="description">
                      {intl.formatMessage(messages.conditionsDescription)}
                    </p>

                    <div className="form-row">
                      <label htmlFor="users" className="text-label">
                        {intl.formatMessage(messages.users)}
                      </label>
                      <div className="form-input-area">
                        <div className="form-input-field">
                          <UserSelector
                            defaultValue={values.users}
                            isMulti
                            onChange={(selectedUsers) => {
                              setFieldValue(
                                'users',
                                selectedUsers?.map((v) => v.value).join(',') ||
                                  undefined
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="genres" className="text-label">
                        {intl.formatMessage(messages.genres)}
                      </label>
                      <div className="form-input-area">
                        <div className="form-input-field">
                          <GenreSelector
                            type={
                              values.serviceType === 'radarr' ? 'movie' : 'tv'
                            }
                            defaultValue={values.genres}
                            isMulti
                            onChange={(selectedGenres) => {
                              setFieldValue(
                                'genres',
                                selectedGenres?.map((v) => v.value).join(',') ||
                                  undefined
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="languages" className="text-label">
                        {intl.formatMessage(messages.languages)}
                      </label>
                      <div className="form-input-area">
                        <div className="form-input-field">
                          <LanguageSelector
                            value={values.languages}
                            serverValue={currentSettings.originalLanguage}
                            setFieldValue={(_key, value) => {
                              setFieldValue('languages', value);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="keywords" className="text-label">
                        {intl.formatMessage(messages.keywords)}
                      </label>
                      <div className="form-input-area">
                        <div className="form-input-field">
                          <KeywordSelector
                            defaultValue={values.keywords}
                            isMulti
                            onChange={(value) => {
                              setFieldValue(
                                'keywords',
                                value?.map((v) => v.value).join(',') ||
                                  undefined
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <h3 className="mt-4 text-lg font-bold leading-8 text-gray-100">
                  {intl.formatMessage(messages.target)}
                </h3>
                <p className="description">
                  {intl.formatMessage(messages.targetDescription)}
                </p>

                <div className="form-row">
                  <label htmlFor="rootFolder" className="text-label">
                    {intl.formatMessage(messages.rootFolder)}
                    {values.isFallback && (
                      <span className="label-required">*</span>
                    )}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="rootFolder"
                        name="rootFolder"
                        disabled={optionsDisabled}
                      >
                        <option value="">
                          {intl.formatMessage(messages.selectRootFolder)}
                        </option>
                        {testResponse.rootFolders.map((folder) => (
                          <option key={folder.id} value={folder.path}>
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

                <div className="form-row">
                  <label htmlFor="activeProfileId" className="text-label">
                    {intl.formatMessage(messages.qualityProfile)}
                    {values.isFallback && (
                      <span className="label-required">*</span>
                    )}
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="activeProfileId"
                        name="activeProfileId"
                        disabled={optionsDisabled}
                      >
                        <option value="">
                          {intl.formatMessage(messages.selectQualityProfile)}
                        </option>
                        {testResponse.profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
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

                {values.serviceType === 'radarr' && (
                  <div className="form-row">
                    <label htmlFor="minimumAvailability" className="text-label">
                      {intl.formatMessage(messages.minimumAvailability)}
                      {values.isFallback && (
                        <span className="label-required">*</span>
                      )}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="select"
                          id="minimumAvailability"
                          name="minimumAvailability"
                          disabled={optionsDisabled}
                        >
                          <option value="announced">
                            {intl.formatMessage(messages.announced)}
                          </option>
                          <option value="inCinemas">
                            {intl.formatMessage(messages.inCinemas)}
                          </option>
                          <option value="released">
                            {intl.formatMessage(messages.released)}
                          </option>
                        </Field>
                      </div>
                      {errors.minimumAvailability &&
                        touched.minimumAvailability &&
                        typeof errors.minimumAvailability === 'string' && (
                          <div className="error">
                            {errors.minimumAvailability}
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {values.serviceType === 'sonarr' && (
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
                          disabled={optionsDisabled}
                        >
                          <option value="">—</option>
                          <option value="standard">Standard</option>
                          <option value="daily">Daily</option>
                          <option value="anime">Anime</option>
                        </Field>
                      </div>
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
                      isDisabled={optionsDisabled}
                      placeholder={intl.formatMessage(messages.selectTags)}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      value={
                        (values.tags
                          ?.split(',')
                          .map((tagId) => {
                            const foundTag = testResponse.tags.find(
                              (tag) => tag.id === Number(tagId)
                            );
                            if (!foundTag) return undefined;
                            return {
                              value: foundTag.id,
                              label: foundTag.label,
                            };
                          })
                          .filter(
                            (option) => option !== undefined
                          ) as OptionType[]) ?? []
                      }
                      onChange={(value) => {
                        setFieldValue(
                          'tags',
                          value.map((option) => option.value).join(',') ||
                            undefined
                        );
                      }}
                      noOptionsMessage={() =>
                        intl.formatMessage(messages.noTagOptions)
                      }
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

export default RoutingRuleModal;

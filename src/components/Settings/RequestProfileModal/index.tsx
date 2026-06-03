import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type {
  ServiceCommonServer,
  ServiceCommonServerWithDetails,
} from '@server/interfaces/api/serviceInterfaces';
import type { RequestProfile } from '@server/lib/settings';
import axios from 'axios';
import { Field, Formik } from 'formik';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import Select from 'react-select';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.Settings.RequestProfileModal',
  {
    createprofile: 'Add New Request Profile',
    editprofile: 'Edit Request Profile',
    profilename: 'Profile Name',
    mediatype: 'Media Type',
    server: 'Server',
    qualityprofile: 'Quality Profile',
    rootfolder: 'Root Folder',
    tags: 'Tags',
    icon: 'Icon (emoji)',
    selectserver: 'Select server',
    selectqualityprofile: 'Select quality profile',
    selectrootfolder: 'Select root folder',
    selecttags: 'Select tags',
    movie: 'Movie',
    tv: 'Series',
    validationNameRequired: 'You must provide a profile name',
    validationServerRequired: 'You must select a server',
    validationProfileRequired: 'You must select a quality profile',
    validationRootFolderRequired: 'You must select a root folder',
    toastCreateSuccess: 'Request profile created successfully!',
    toastUpdateSuccess: 'Request profile updated successfully!',
    toastError: 'Something went wrong saving the profile.',
    notagoptions: 'No tags.',
  }
);

interface RequestProfileModalProps {
  profile?: RequestProfile;
  onClose: () => void;
  onSave: () => void;
}

type OptionType = { value: number | string; label: string };

const RequestProfileModal = ({
  profile,
  onClose,
  onSave,
}: RequestProfileModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(
    profile?.mediaType === 'tv' ? 'tv' : 'movie'
  );
  const [selectedServerId, setSelectedServerId] = useState<number | null>(
    profile?.serviceId ?? null
  );
  const [serverDetails, setServerDetails] =
    useState<ServiceCommonServerWithDetails | null>(null);

  const serviceType = mediaType === 'movie' ? 'radarr' : 'sonarr';

  const { data: servers } = useSWR<ServiceCommonServer[]>(
    `/api/v1/service/${serviceType}`,
    { revalidateOnMount: true }
  );

  useEffect(() => {
    if (selectedServerId === null) return;
    axios
      .get<ServiceCommonServerWithDetails>(
        `/api/v1/service/${serviceType}/${selectedServerId}`
      )
      .then((res) => setServerDetails(res.data))
      .catch(() => setServerDetails(null));
  }, [selectedServerId, serviceType]);

  // Reset server when media type changes (unless editing and same type)
  useEffect(() => {
    if (!profile) {
      setSelectedServerId(null);
      setServerDetails(null);
    }
  }, [mediaType, profile]);

  const ValidationSchema = Yup.object().shape({
    name: Yup.string().required(
      intl.formatMessage(messages.validationNameRequired)
    ),
    serviceId: Yup.number()
      .nullable()
      .required(intl.formatMessage(messages.validationServerRequired)),
    qualityProfileId: Yup.number()
      .nullable()
      .required(intl.formatMessage(messages.validationProfileRequired)),
    rootFolder: Yup.string().required(
      intl.formatMessage(messages.validationRootFolderRequired)
    ),
  });

  const profileOptions: OptionType[] =
    serverDetails?.profiles.map((p) => ({ value: p.id, label: p.name })) ?? [];

  const folderOptions: OptionType[] =
    serverDetails?.rootFolders.map((f) => ({
      value: f.path ?? '',
      label: f.path ?? '',
    })) ?? [];

  const tagOptions: OptionType[] =
    serverDetails?.tags.map((t) => ({ value: t.id, label: t.label })) ?? [];

  return (
    <Formik
      initialValues={{
        name: profile?.name ?? '',
        mediaType: profile?.mediaType === 'tv' ? 'tv' : 'movie',
        serviceId: profile?.serviceId ?? null,
        qualityProfileId: profile?.qualityProfileId ?? null,
        rootFolder: profile?.rootFolder ?? '',
        tags: profile?.tags ?? [],
        icon: profile?.icon ?? '',
      }}
      validationSchema={ValidationSchema}
      onSubmit={async (values) => {
        try {
          const body = {
            name: values.name,
            mediaType,
            serviceId: values.serviceId,
            qualityProfileId: values.qualityProfileId,
            rootFolder: values.rootFolder,
            tags: values.tags,
            icon: values.icon || undefined,
          };
          if (profile) {
            await axios.put(
              `/api/v1/settings/request-profiles/${profile.id}`,
              body
            );
            addToast(intl.formatMessage(messages.toastUpdateSuccess), {
              appearance: 'success',
              autoDismiss: true,
            });
          } else {
            await axios.post('/api/v1/settings/request-profiles', body);
            addToast(intl.formatMessage(messages.toastCreateSuccess), {
              appearance: 'success',
              autoDismiss: true,
            });
          }
          onSave();
        } catch {
          addToast(intl.formatMessage(messages.toastError), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      }}
    >
      {({ errors, touched, values, setFieldValue, isSubmitting, handleSubmit }) => (
        <Modal
          title={
            profile
              ? intl.formatMessage(messages.editprofile)
              : intl.formatMessage(messages.createprofile)
          }
          onCancel={onClose}
          onOk={() => handleSubmit()}
          okDisabled={isSubmitting}
          okText={intl.formatMessage(
            profile ? globalMessages.save : globalMessages.add
          )}
          cancelText={intl.formatMessage(globalMessages.cancel)}
        >
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.profilename)}
              </label>
              <div className="mt-1">
                <Field
                  id="name"
                  name="name"
                  type="text"
                  className="block w-full rounded-md border border-gray-500 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                {errors.name && touched.name && (
                  <div className="mt-1 text-sm text-red-500">{errors.name}</div>
                )}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.icon)}
              </label>
              <div className="mt-1">
                <Field
                  id="icon"
                  name="icon"
                  type="text"
                  maxLength={4}
                  placeholder="🎬"
                  className="block w-24 rounded-md border border-gray-500 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Media Type */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.mediatype)}
              </label>
              <div className="mt-1">
                <select
                  value={mediaType}
                  onChange={(e) => {
                    const v = e.target.value as 'movie' | 'tv';
                    setMediaType(v);
                    void setFieldValue('mediaType', v);
                    void setFieldValue('serviceId', null);
                    void setFieldValue('qualityProfileId', null);
                    void setFieldValue('rootFolder', '');
                    void setFieldValue('tags', []);
                  }}
                  className="block w-full rounded-md border border-gray-500 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="movie">
                    {intl.formatMessage(messages.movie)}
                  </option>
                  <option value="tv">
                    {intl.formatMessage(messages.tv)}
                  </option>
                </select>
              </div>
            </div>

            {/* Server */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.server)}
              </label>
              <div className="mt-1">
                <Select<OptionType>
                  options={
                    servers?.map((s) => ({ value: s.id, label: s.name })) ?? []
                  }
                  value={
                    values.serviceId !== null
                      ? {
                          value: values.serviceId,
                          label:
                            servers?.find((s) => s.id === values.serviceId)
                              ?.name ?? '',
                        }
                      : null
                  }
                  onChange={(opt) => {
                    const id = opt ? Number(opt.value) : null;
                    setSelectedServerId(id);
                    void setFieldValue('serviceId', id);
                    void setFieldValue('qualityProfileId', null);
                    void setFieldValue('rootFolder', '');
                    void setFieldValue('tags', []);
                  }}
                  placeholder={intl.formatMessage(messages.selectserver)}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {errors.serviceId && touched.serviceId && (
                  <div className="mt-1 text-sm text-red-500">
                    {errors.serviceId as string}
                  </div>
                )}
              </div>
            </div>

            {/* Quality Profile */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.qualityprofile)}
              </label>
              <div className="mt-1">
                <Select<OptionType>
                  options={profileOptions}
                  value={
                    values.qualityProfileId !== null
                      ? profileOptions.find(
                          (o) => o.value === values.qualityProfileId
                        ) ?? null
                      : null
                  }
                  onChange={(opt) =>
                    void setFieldValue(
                      'qualityProfileId',
                      opt ? Number(opt.value) : null
                    )
                  }
                  isDisabled={!serverDetails}
                  placeholder={intl.formatMessage(messages.selectqualityprofile)}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {errors.qualityProfileId && touched.qualityProfileId && (
                  <div className="mt-1 text-sm text-red-500">
                    {errors.qualityProfileId as string}
                  </div>
                )}
              </div>
            </div>

            {/* Root Folder */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.rootfolder)}
              </label>
              <div className="mt-1">
                <Select<OptionType>
                  options={folderOptions}
                  value={
                    values.rootFolder
                      ? folderOptions.find(
                          (o) => o.value === values.rootFolder
                        ) ?? null
                      : null
                  }
                  onChange={(opt) =>
                    void setFieldValue('rootFolder', opt ? opt.value : '')
                  }
                  isDisabled={!serverDetails}
                  placeholder={intl.formatMessage(messages.selectrootfolder)}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {errors.rootFolder && touched.rootFolder && (
                  <div className="mt-1 text-sm text-red-500">
                    {errors.rootFolder}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-label">
                {intl.formatMessage(messages.tags)}
              </label>
              <div className="mt-1">
                <Select<OptionType, true>
                  isMulti
                  options={tagOptions}
                  value={tagOptions.filter((o) =>
                    (values.tags ?? []).includes(Number(o.value))
                  )}
                  onChange={(opts) =>
                    void setFieldValue(
                      'tags',
                      opts ? opts.map((o) => Number(o.value)) : []
                    )
                  }
                  isDisabled={!serverDetails}
                  noOptionsMessage={() =>
                    intl.formatMessage(messages.notagoptions)
                  }
                  placeholder={intl.formatMessage(messages.selecttags)}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Formik>
  );
};

export default RequestProfileModal;

import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages(
  'components.UserProfile.UserSettings.LinkJellyfinModal',
  {
    title: 'Link {mediaServerName} Account',
    mapTitle: 'Map {mediaServerName} Account',
    description:
      'Enter your {mediaServerName} credentials to link your account with {applicationName}.',
    mapDescription:
      'Select the {mediaServerName} account to map to this {applicationName} user. This does not create a {mediaServerName} session or store a user auth token.',
    username: 'Username',
    password: 'Password',
    selectUser: 'Select User',
    usernameRequired: 'You must provide a username',
    passwordRequired: 'You must provide a password',
    saving: 'Adding…',
    mapping: 'Mapping…',
    save: 'Link',
    map: 'Map Account',
    errorUnauthorized:
      'Unable to connect to {mediaServerName} using your credentials',
    errorExists: 'This account is already linked to a {applicationName} user',
    errorUnknown: 'An unknown error occurred',
    noUsers: 'No {mediaServerName} users are available.',
    quickConnect: 'Use Quick Connect',
  }
);

type JellyfinUserOption = {
  id: string;
  username: string;
  email: string;
  thumb: string;
};

interface LinkJellyfinModalProps {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  targetUserId?: number;
  adminLink?: boolean;
  onSwitchToQuickConnect: () => void;
}

const LinkJellyfinModal = ({
  show,
  onClose,
  onSave,
  targetUserId,
  adminLink = false,
  onSwitchToQuickConnect,
}: LinkJellyfinModalProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [selectedJellyfinUserId, setSelectedJellyfinUserId] =
    useState<string>('');
  const [isMapping, setIsMapping] = useState(false);
  const { data: jellyfinUsers, error: jellyfinUsersError } = useSWR<
    JellyfinUserOption[]
  >(adminLink && show ? `/api/v1/settings/jellyfin/users` : null);

  const JellyfinLoginSchema = Yup.object().shape({
    username: Yup.string().required(
      intl.formatMessage(messages.usernameRequired)
    ),
    password: Yup.string().required(
      intl.formatMessage(messages.passwordRequired)
    ),
  });

  const applicationName = settings.currentSettings.applicationTitle;
  const mediaServerName =
    settings.currentSettings.mediaServerType === MediaServerType.EMBY
      ? 'Emby'
      : 'Jellyfin';
  const userId = targetUserId ?? user?.id;

  useEffect(() => {
    if (!show) {
      setError(null);
      setSelectedJellyfinUserId('');
      setIsMapping(false);
    }
  }, [show]);

  const mapJellyfinAccount = async () => {
    if (!selectedJellyfinUserId || !userId) {
      return;
    }

    try {
      setIsMapping(true);
      setError(null);
      await axios.post(
        `/api/v1/user/${userId}/settings/linked-accounts/jellyfin/map`,
        {
          jellyfinUserId: selectedJellyfinUserId,
        }
      );
      onSave();
    } catch (e) {
      if (e?.response?.status === 422) {
        setError(intl.formatMessage(messages.errorExists, { applicationName }));
      } else if (e?.response?.data?.message) {
        setError(e.response.data.message);
      } else {
        setError(intl.formatMessage(messages.errorUnknown));
      }
    } finally {
      setIsMapping(false);
    }
  };

  if (!userId) {
    return null;
  }

  if (adminLink) {
    return (
      <Transition
        appear
        show={show}
        enter="transition ease-in-out duration-300 transform opacity-0"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition ease-in-out duration-300 transform opacity-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Modal
          loading={!jellyfinUsers && !jellyfinUsersError}
          onCancel={() => {
            setError(null);
            onClose();
          }}
          okButtonType="primary"
          okText={
            isMapping
              ? intl.formatMessage(messages.mapping)
              : intl.formatMessage(messages.map)
          }
          okDisabled={
            isMapping || !selectedJellyfinUserId || !jellyfinUsers?.length
          }
          onOk={() => mapJellyfinAccount()}
          title={intl.formatMessage(messages.mapTitle, { mediaServerName })}
          dialogClass="sm:max-w-lg"
        >
          {intl.formatMessage(messages.mapDescription, {
            mediaServerName,
            applicationName,
          })}
          {error && (
            <div className="mt-2">
              <Alert type="error">{error}</Alert>
            </div>
          )}
          {jellyfinUsers?.length ? (
            <div className="mt-4">
              <label htmlFor="jellyfinUserId" className="text-label">
                {intl.formatMessage(messages.selectUser)}
              </label>
              <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
                <select
                  id="jellyfinUserId"
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-indigo-500"
                  value={selectedJellyfinUserId}
                  onChange={(e) => setSelectedJellyfinUserId(e.target.value)}
                  disabled={isMapping}
                >
                  <option value="">
                    {intl.formatMessage(messages.selectUser)}
                  </option>
                  {jellyfinUsers.map((serverUser) => (
                    <option key={serverUser.id} value={serverUser.id}>
                      {serverUser.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            jellyfinUsers && (
              <div className="mt-4">
                <Alert
                  type="info"
                  title={intl.formatMessage(messages.noUsers, {
                    mediaServerName,
                  })}
                />
              </div>
            )
          )}
        </Modal>
      </Transition>
    );
  }

  return (
    <Transition
      appear
      show={show}
      enter="transition ease-in-out duration-300 transform opacity-0"
      enterFrom="opacity-0"
      enterTo="opacuty-100"
      leave="transition ease-in-out duration-300 transform opacity-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <Formik
        initialValues={{
          username: '',
          password: '',
        }}
        validationSchema={JellyfinLoginSchema}
        onSubmit={async ({ username, password }) => {
          try {
            setError(null);
            await axios.post(
              `/api/v1/user/${userId}/settings/linked-accounts/jellyfin`,
              {
                username,
                password,
              }
            );
            onSave();
          } catch (e) {
            if (e?.response?.status === 401) {
              setError(
                intl.formatMessage(messages.errorUnauthorized, {
                  mediaServerName,
                })
              );
            } else if (e?.response?.status === 422) {
              setError(
                intl.formatMessage(messages.errorExists, { applicationName })
              );
            } else {
              setError(intl.formatMessage(messages.errorUnknown));
            }
          }
        }}
      >
        {({ errors, touched, handleSubmit, isSubmitting, isValid }) => {
          return (
            <Modal
              onCancel={() => {
                setError(null);
                onClose();
              }}
              okButtonType="primary"
              okButtonProps={{ type: 'submit', form: 'link-jellyfin-account' }}
              okText={
                isSubmitting
                  ? intl.formatMessage(messages.saving)
                  : intl.formatMessage(messages.save)
              }
              okDisabled={isSubmitting || !isValid}
              onOk={() => handleSubmit()}
              title={intl.formatMessage(messages.title, { mediaServerName })}
              dialogClass="sm:max-w-lg"
            >
              <Form id="link-jellyfin-account">
                {intl.formatMessage(messages.description, {
                  mediaServerName,
                  applicationName,
                })}
                {error && (
                  <div className="mt-2">
                    <Alert type="error">{error}</Alert>
                  </div>
                )}
                <label htmlFor="username" className="text-label">
                  {intl.formatMessage(messages.username)}
                </label>
                <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
                  <div className="flex rounded-md shadow-sm">
                    <Field
                      id="username"
                      name="username"
                      type="text"
                      placeholder={intl.formatMessage(messages.username)}
                    />
                  </div>
                  {errors.username && touched.username && (
                    <div className="error">{errors.username}</div>
                  )}
                </div>
                <label htmlFor="password" className="text-label">
                  {intl.formatMessage(messages.password)}
                </label>
                <div className="mb-2 mt-1 sm:col-span-2 sm:mt-0">
                  <div className="flex rounded-md shadow-sm">
                    <Field
                      id="password"
                      name="password"
                      type="password"
                      placeholder={intl.formatMessage(messages.password)}
                    />
                  </div>
                  {errors.password && touched.password && (
                    <div className="error">{errors.password}</div>
                  )}
                </div>
                {settings.currentSettings.mediaServerType ===
                  MediaServerType.JELLYFIN && (
                  <div className="mt-4">
                    <Button
                      buttonType="ghost"
                      type="button"
                      onClick={() => {
                        setError(null);
                        onSwitchToQuickConnect();
                      }}
                      className="w-full gap-2"
                    >
                      <QrCodeIcon />
                      <span>{intl.formatMessage(messages.quickConnect)}</span>
                    </Button>
                  </div>
                )}
              </Form>
            </Modal>
          );
        }}
      </Formik>
    </Transition>
  );
};

export default LinkJellyfinModal;

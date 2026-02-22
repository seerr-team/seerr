import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

type SwitchTargetServerType = 'jellyfin' | 'emby' | 'plex';

const messages = defineMessages('components.Settings', {
  switchMediaServerError:
    'Something went wrong while switching media server. Please try again.',
  switchMediaServerSuccess:
    'Media server switched. All users logged out. Restart the server, then sign in again.',
  switchMediaServerStepsPlex:
    '1) Have users link Jellyfin or Emby in {profile} → {linkedAccounts}.\n2) Optionally check {users} to see who has linked.\n3) Choose the target below and switch.',
  switchMediaServerStepsJellyfinEmby:
    '1) Configure Plex in the Plex tab.\n2) Have users link Plex in {profile} → {linkedAccounts}.\n3) Optionally check {users}.\n4) Choose the target below and switch.',
  switchMediaServerWarning:
    'Everyone will be logged out. You must restart the server after switching.',
  switchTargetAfter: 'New media server:',
  switchMediaServerButton: 'Switch media server',
  checkUsersLink: 'Users',
});

const SwitchMediaServerSection = () => {
  const settings = useSettings();
  const intl = useIntl();
  const { addToast } = useToasts();
  const isPlex =
    settings.currentSettings.mediaServerType === MediaServerType.PLEX;
  const isJellyfin =
    settings.currentSettings.mediaServerType === MediaServerType.JELLYFIN;
  const isEmby =
    settings.currentSettings.mediaServerType === MediaServerType.EMBY;

  const [isModalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [switchTargetServerType, setSwitchTargetServerType] =
    useState<SwitchTargetServerType>(isPlex ? 'jellyfin' : 'plex');

  if (
    settings.currentSettings.mediaServerType === MediaServerType.NOT_CONFIGURED
  ) {
    return null;
  }

  const targetPayload = { targetServerType: switchTargetServerType };

  const handleSwitch = async () => {
    setSubmitting(true);
    try {
      const { data } = await axios.post<{ message?: string }>(
        '/api/v1/settings/switch-media-server',
        targetPayload
      );
      addToast(
        data?.message ?? intl.formatMessage(messages.switchMediaServerSuccess),
        { appearance: 'success' }
      );
      setModalOpen(false);
      window.location.reload();
    } catch (err: unknown) {
      const extracted = axios.isAxiosError(err)
        ? (err.response?.data?.error ??
          err.response?.data?.message ??
          err.message)
        : err instanceof Error
          ? err.message
          : null;
      const message =
        extracted != null && String(extracted).trim() !== ''
          ? String(extracted)
          : intl.formatMessage(messages.switchMediaServerError);
      addToast(message, { appearance: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const linkValues = {
    profile: <strong className="font-semibold text-gray-300">Profile</strong>,
    linkedAccounts: (
      <strong className="font-semibold text-gray-300">Linked accounts</strong>
    ),
    users: (
      <Link
        href="/settings/users"
        className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
      >
        {intl.formatMessage(messages.checkUsersLink)}
      </Link>
    ),
  };

  return (
    <div className="mt-10 border-t border-gray-700 pt-8">
      <Button buttonType="danger" onClick={() => setModalOpen(true)}>
        <FormattedMessage
          id="components.Settings.switchMediaServerButton"
          defaultMessage={messages.switchMediaServerButton.defaultMessage}
        />
      </Button>

      <Transition
        as={Fragment}
        show={isModalOpen}
        enter="transition-opacity ease-in-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Modal
          title={intl.formatMessage(messages.switchMediaServerButton)}
          onCancel={() => !isSubmitting && setModalOpen(false)}
          onOk={handleSwitch}
          okText={intl.formatMessage(messages.switchMediaServerButton)}
          okButtonType="danger"
          cancelText={intl.formatMessage(globalMessages.cancel)}
          loading={isSubmitting}
          okDisabled={isSubmitting}
        >
          <p className="whitespace-pre-line text-gray-300">
            {isPlex ? (
              <FormattedMessage
                id="components.Settings.switchMediaServerStepsPlex"
                defaultMessage={
                  messages.switchMediaServerStepsPlex.defaultMessage
                }
                values={linkValues}
              />
            ) : (
              <FormattedMessage
                id="components.Settings.switchMediaServerStepsJellyfinEmby"
                defaultMessage={
                  messages.switchMediaServerStepsJellyfinEmby.defaultMessage
                }
                values={linkValues}
              />
            )}
          </p>
          <div className="mt-3">
            <Alert
              title={intl.formatMessage(messages.switchMediaServerWarning)}
              type="warning"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              htmlFor="switch-target-server-modal"
              className="text-sm text-gray-400"
            >
              <FormattedMessage
                id="components.Settings.switchTargetAfter"
                defaultMessage={messages.switchTargetAfter.defaultMessage}
              />
            </label>
            <select
              id="switch-target-server-modal"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:ring-indigo-500"
              value={switchTargetServerType}
              onChange={(e) =>
                setSwitchTargetServerType(
                  e.target.value as SwitchTargetServerType
                )
              }
              disabled={isSubmitting}
            >
              {isPlex && (
                <>
                  <option value="jellyfin">Jellyfin</option>
                  <option value="emby">Emby</option>
                </>
              )}
              {(isJellyfin || isEmby) && (
                <>
                  <option value="plex">Plex</option>
                  {isEmby && <option value="jellyfin">Jellyfin</option>}
                  {isJellyfin && <option value="emby">Emby</option>}
                </>
              )}
            </select>
          </div>
        </Modal>
      </Transition>
    </div>
  );
};

export default SwitchMediaServerSection;

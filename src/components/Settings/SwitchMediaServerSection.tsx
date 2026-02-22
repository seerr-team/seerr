import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { MediaServerType } from '@server/constants/server';
import type { JellyfinSettings, PlexSettings } from '@server/lib/settings';
import axios from 'axios';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

type SwitchTargetServerType = 'jellyfin' | 'emby' | 'plex';

const messages = defineMessages('components.Settings', {
  switchMediaServerError:
    'Something went wrong while switching media server. Please try again.',
  switchMediaServerSuccess:
    'Media server switched. All users logged out. Restart the server, then sign in again.',
  switchMediaServerStep1Plex:
    '1) Configure Jellyfin or Emby in the Jellyfin settings tab.',
  switchMediaServerStep2Plex:
    '2) Have users link Jellyfin or Emby in {profile} => {linkedAccounts}.',
  switchMediaServerStep3Plex:
    '3) Optionally check {users} to see who has linked.',
  switchMediaServerStep4Plex: '4) Choose the target below and switch.',
  switchMediaServerStep1JellyfinEmby:
    '1) Configure Plex in the Plex settings tab.',
  switchMediaServerStep2JellyfinEmby:
    '2) Have users link Plex in {profile} => {linkedAccounts}.',
  switchMediaServerStep3JellyfinEmby: '3) Optionally check {users}.',
  switchMediaServerStep4JellyfinEmby: '4) Choose the target below and switch.',
  switchMediaServerStep1JellyfinEmbyToOther:
    '1) Choose the target below and switch.',
  switchMediaServerStep2JellyfinEmbyToOther: '2) Restart the server.',
  switchMediaServerStep3JellyfinEmbyToOther:
    '3) Reconfigure the connection in the Jellyfin settings tab (same tab, new server type).',
  switchMediaServerStep4JellyfinEmbyToOther:
    '4) Have users sign in with the new media server.',
  switchMediaServerWarning:
    'Everyone will be logged out. You must restart the server after switching.',
  switchTargetAfter: 'New media server:',
  switchMediaServerButton: 'Switch media server',
  switchToPlex: 'Switch to Plex',
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

  const { data: plexData } = useSWR<PlexSettings>(
    isJellyfin || isEmby ? '/api/v1/settings/plex' : null
  );
  const { data: jellyfinData } = useSWR<JellyfinSettings>(
    isPlex ? '/api/v1/settings/jellyfin' : null
  );

  const plexConfigured = Boolean(plexData?.name || plexData?.ip);
  const jellyfinConfigured = Boolean(jellyfinData?.ip);

  const [isModalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [switchTargetServerType, setSwitchTargetServerType] =
    useState<SwitchTargetServerType>('jellyfin');

  if (
    settings.currentSettings.mediaServerType === MediaServerType.NOT_CONFIGURED
  ) {
    return null;
  }

  const canSwitchToPlex = (isJellyfin || isEmby) && plexConfigured;
  const canSwitchToJellyfinEmby = isPlex && jellyfinConfigured;
  const hasValidTarget =
    canSwitchToJellyfinEmby || canSwitchToPlex || isJellyfin || isEmby;
  if (!hasValidTarget) {
    return null;
  }

  const validTargets: SwitchTargetServerType[] = isPlex
    ? (['jellyfin', 'emby'] as const)
    : isJellyfin
      ? (['emby', ...(plexConfigured ? (['plex'] as const) : [])] as const)
      : (['jellyfin', ...(plexConfigured ? (['plex'] as const) : [])] as const);
  const effectiveTarget = validTargets.includes(switchTargetServerType)
    ? switchTargetServerType
    : validTargets[0];
  const targetPayload: { targetServerType: SwitchTargetServerType } = {
    targetServerType: effectiveTarget,
  };

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
        {validTargets.length === 1 && validTargets[0] === 'plex' ? (
          <FormattedMessage
            id="components.Settings.switchToPlex"
            defaultMessage={messages.switchToPlex.defaultMessage}
          />
        ) : (
          <FormattedMessage
            id="components.Settings.switchMediaServerButton"
            defaultMessage={messages.switchMediaServerButton.defaultMessage}
          />
        )}
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
          title={
            validTargets.length === 1 && validTargets[0] === 'plex'
              ? intl.formatMessage(messages.switchToPlex)
              : intl.formatMessage(messages.switchMediaServerButton)
          }
          onCancel={() => !isSubmitting && setModalOpen(false)}
          onOk={handleSwitch}
          okText={
            validTargets.length === 1 && validTargets[0] === 'plex'
              ? intl.formatMessage(messages.switchToPlex)
              : intl.formatMessage(messages.switchMediaServerButton)
          }
          okButtonType="danger"
          cancelText={intl.formatMessage(globalMessages.cancel)}
          loading={isSubmitting}
          okDisabled={isSubmitting}
        >
          <div className="space-y-1 text-gray-300">
            {isPlex ? (
              <>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep1Plex"
                    defaultMessage={
                      messages.switchMediaServerStep1Plex.defaultMessage
                    }
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep2Plex"
                    defaultMessage={
                      messages.switchMediaServerStep2Plex.defaultMessage
                    }
                    values={linkValues}
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep3Plex"
                    defaultMessage={
                      messages.switchMediaServerStep3Plex.defaultMessage
                    }
                    values={linkValues}
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep4Plex"
                    defaultMessage={
                      messages.switchMediaServerStep4Plex.defaultMessage
                    }
                  />
                </p>
              </>
            ) : (isJellyfin || isEmby) && effectiveTarget !== 'plex' ? (
              <>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep1JellyfinEmbyToOther"
                    defaultMessage={
                      messages.switchMediaServerStep1JellyfinEmbyToOther
                        .defaultMessage
                    }
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep2JellyfinEmbyToOther"
                    defaultMessage={
                      messages.switchMediaServerStep2JellyfinEmbyToOther
                        .defaultMessage
                    }
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep3JellyfinEmbyToOther"
                    defaultMessage={
                      messages.switchMediaServerStep3JellyfinEmbyToOther
                        .defaultMessage
                    }
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep4JellyfinEmbyToOther"
                    defaultMessage={
                      messages.switchMediaServerStep4JellyfinEmbyToOther
                        .defaultMessage
                    }
                  />
                </p>
              </>
            ) : (
              <>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep1JellyfinEmby"
                    defaultMessage={
                      messages.switchMediaServerStep1JellyfinEmby.defaultMessage
                    }
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep2JellyfinEmby"
                    defaultMessage={
                      messages.switchMediaServerStep2JellyfinEmby.defaultMessage
                    }
                    values={linkValues}
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep3JellyfinEmby"
                    defaultMessage={
                      messages.switchMediaServerStep3JellyfinEmby.defaultMessage
                    }
                    values={linkValues}
                  />
                </p>
                <p className="m-0">
                  <FormattedMessage
                    id="components.Settings.switchMediaServerStep4JellyfinEmby"
                    defaultMessage={
                      messages.switchMediaServerStep4JellyfinEmby.defaultMessage
                    }
                  />
                </p>
              </>
            )}
          </div>
          <div className="mt-3">
            <Alert
              title={intl.formatMessage(messages.switchMediaServerWarning)}
              type="warning"
            />
          </div>
          {validTargets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-400">
                <FormattedMessage
                  id="components.Settings.switchTargetAfter"
                  defaultMessage={messages.switchTargetAfter.defaultMessage}
                />
              </span>
              {validTargets.length > 1 ? (
                <select
                  id="switch-target-server-modal"
                  className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:ring-indigo-500"
                  value={effectiveTarget}
                  onChange={(e) =>
                    setSwitchTargetServerType(
                      e.target.value as SwitchTargetServerType
                    )
                  }
                  disabled={isSubmitting}
                >
                  {validTargets.map((t) => (
                    <option key={t} value={t}>
                      {t === 'plex'
                        ? 'Plex'
                        : t === 'jellyfin'
                          ? 'Jellyfin'
                          : 'Emby'}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-medium text-white">
                  {effectiveTarget === 'plex'
                    ? 'Plex'
                    : effectiveTarget === 'jellyfin'
                      ? 'Jellyfin'
                      : 'Emby'}
                </span>
              )}
            </div>
          )}
        </Modal>
      </Transition>
    </div>
  );
};

export default SwitchMediaServerSection;

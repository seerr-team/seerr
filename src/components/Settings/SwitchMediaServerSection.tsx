import ConfirmButton from '@app/components/Common/ConfirmButton';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaServerType } from '@server/constants/server';
import axios from 'axios';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

type SwitchTargetServerType = 'jellyfin' | 'emby';

const messages = defineMessages('components.Settings', {
  switchMediaServerError:
    'Something went wrong while switching media server. Please try again.',
  switchMediaServerSuccess: 'Media server cleared. You may need to restart.',
});

const SwitchMediaServerSection = () => {
  const settings = useSettings();
  const intl = useIntl();
  const { addToast } = useToasts();
  const [switchTargetServerType, setSwitchTargetServerType] =
    useState<SwitchTargetServerType>('jellyfin');

  if (
    settings.currentSettings.mediaServerType === MediaServerType.NOT_CONFIGURED
  ) {
    return null;
  }

  return (
    <div className="mt-10 border-t border-gray-700 pt-8">
      <h3 className="text-lg font-medium text-red-400">
        <FormattedMessage
          id="components.Settings.switchMediaServer"
          defaultMessage="Switch media server"
        />
      </h3>
      <p className="mt-1 text-sm text-gray-400">
        {settings.currentSettings.mediaServerType === MediaServerType.PLEX ? (
          <FormattedMessage
            id="components.Settings.switchMediaServerDescriptionPlex"
            defaultMessage="Have users link Jellyfin or Emby in {profile} => {linkedAccounts} first, then choose the target below and switch. Restart may be required."
            values={{
              profile: (
                <strong className="font-semibold text-gray-300">Profile</strong>
              ),
              linkedAccounts: (
                <strong className="font-semibold text-gray-300">
                  Linked accounts
                </strong>
              ),
            }}
          />
        ) : (
          <FormattedMessage
            id="components.Settings.switchMediaServerDescriptionJellyfinEmby"
            defaultMessage="Configure Plex in the Plex tab, then have users link Plex in {profile} => {linkedAccounts}, then switch. This clears the current server. Restart may be required."
            values={{
              profile: (
                <strong className="font-semibold text-gray-300">Profile</strong>
              ),
              linkedAccounts: (
                <strong className="font-semibold text-gray-300">
                  Linked accounts
                </strong>
              ),
            }}
          />
        )}
      </p>
      {settings.currentSettings.mediaServerType === MediaServerType.PLEX && (
        <div className="mt-3 flex items-center gap-2">
          <label
            htmlFor="switch-target-server"
            className="text-sm text-gray-400"
          >
            <FormattedMessage
              id="components.Settings.switchTargetServerType"
              defaultMessage="After switch, use:"
            />
          </label>
          <select
            id="switch-target-server"
            className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:ring-indigo-500"
            value={switchTargetServerType}
            onChange={(e) =>
              setSwitchTargetServerType(
                e.target.value as SwitchTargetServerType
              )
            }
          >
            <option value="jellyfin">Jellyfin</option>
            <option value="emby">Emby</option>
          </select>
        </div>
      )}
      <ConfirmButton
        className="mt-4"
        confirmText={intl.formatMessage(globalMessages.areyousure)}
        onClick={async () => {
          try {
            await axios.post(
              '/api/v1/settings/switch-media-server',
              settings.currentSettings.mediaServerType === MediaServerType.PLEX
                ? { targetServerType: switchTargetServerType }
                : undefined
            );
            addToast(intl.formatMessage(messages.switchMediaServerSuccess), {
              appearance: 'success',
            });
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
          }
        }}
      >
        <FormattedMessage
          id="components.Settings.switchMediaServerButton"
          defaultMessage="Switch media server"
        />
      </ConfirmButton>
    </div>
  );
};

export default SwitchMediaServerSection;

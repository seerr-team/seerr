import PageTitle from '@app/components/Common/PageTitle';
import type { SettingsRoute } from '@app/components/Common/SettingsTabs';
import SettingsTabs from '@app/components/Common/SettingsTabs';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaServerType } from '@server/constants/server';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings', {
  menuGeneralSettings: 'General',
  menuUsers: 'Users',
  menuPlexSettings: 'Plex',
  menuJellyfinSettings: '{mediaServerName}',
  menuServices: 'Services',
  menuNetwork: 'Network',
  menuNotifications: 'Notifications',
  menuLogs: 'Logs',
  menuJobs: 'Jobs & Cache',
  menuAbout: 'About',
  menuMetadataProviders: 'Metadata Providers',
});

type SettingsLayoutProps = {
  children: React.ReactNode;
};

const SettingsLayout = ({ children }: SettingsLayoutProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { primaryMediaServer, enabledAuthMethods } = settings.currentSettings;

  const plexConfigured =
    primaryMediaServer === MediaServerType.PLEX ||
    enabledAuthMethods.includes(MediaServerType.PLEX);
  const jellyfinConfigured =
    primaryMediaServer === MediaServerType.JELLYFIN ||
    enabledAuthMethods.includes(MediaServerType.JELLYFIN);
  const embyConfigured =
    primaryMediaServer === MediaServerType.EMBY ||
    enabledAuthMethods.includes(MediaServerType.EMBY);

  const mediaServerTabs: SettingsRoute[] = [];

  if (plexConfigured) {
    mediaServerTabs.push({
      text: intl.formatMessage(messages.menuPlexSettings),
      route: '/settings/plex',
      regex: /^\/settings\/plex/,
    });
  }

  if (jellyfinConfigured || embyConfigured) {
    mediaServerTabs.push({
      text: getAvailableMediaServerName(),
      route: '/settings/jellyfin',
      regex: /^\/settings\/jellyfin/,
    });
  }

  const settingsRoutes: SettingsRoute[] = [
    {
      text: intl.formatMessage(messages.menuGeneralSettings),
      route: '/settings/main',
      regex: /^\/settings(\/main)?$/,
    },
    {
      text: intl.formatMessage(messages.menuUsers),
      route: '/settings/users',
      regex: /^\/settings\/users/,
    },
    ...mediaServerTabs,
    {
      text: intl.formatMessage(messages.menuServices),
      route: '/settings/services',
      regex: /^\/settings\/services/,
    },
    {
      text: intl.formatMessage(messages.menuNetwork),
      route: '/settings/network',
      regex: /^\/settings\/network/,
    },
    {
      text: intl.formatMessage(messages.menuMetadataProviders),
      route: '/settings/metadata',
      regex: /^\/settings\/metadata/,
    },
    {
      text: intl.formatMessage(messages.menuNotifications),
      route: '/settings/notifications/email',
      regex: /^\/settings\/notifications/,
    },
    {
      text: intl.formatMessage(messages.menuLogs),
      route: '/settings/logs',
      regex: /^\/settings\/logs/,
    },
    {
      text: intl.formatMessage(messages.menuJobs),
      route: '/settings/jobs',
      regex: /^\/settings\/jobs/,
    },
    {
      text: intl.formatMessage(messages.menuAbout),
      route: '/settings/about',
      regex: /^\/settings\/about/,
    },
  ];

  return (
    <>
      <PageTitle title={intl.formatMessage(globalMessages.settings)} />
      <div className="mt-6">
        <SettingsTabs settingsRoutes={settingsRoutes} />
      </div>
      <div className="mt-10 text-white">{children}</div>
    </>
  );
  function getAvailableMediaServerName() {
    const isJellyfin =
      primaryMediaServer === MediaServerType.JELLYFIN ||
      (jellyfinConfigured && !embyConfigured);
    const isEmby =
      primaryMediaServer === MediaServerType.EMBY ||
      (embyConfigured && !jellyfinConfigured);

    return intl.formatMessage(messages.menuJellyfinSettings, {
      mediaServerName: isJellyfin ? 'Jellyfin' : isEmby ? 'Emby' : undefined,
    });
  }
};

export default SettingsLayout;

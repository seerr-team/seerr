import type {
  AllSettings,
  JellyfinServerSettings,
  JellyfinSettings,
  JobId,
  MainSettings,
  PlexServerSettings,
  PlexSettings,
  ProxySettings,
  RadarrSettings,
  SonarrSettings,
} from '@server/lib/settings';

type LegacyMainSettings = Partial<MainSettings> & {
  region?: string;
  csrfProtection?: boolean;
  trustProxy?: boolean;
  forceIpv4First?: boolean;
  proxy?: Partial<ProxySettings>;
  hideBlacklisted?: boolean;
  blacklistedTags?: string;
  blacklistedTagsLimit?: number;
};

type LegacyNotificationAgents =
  | (AllSettings['notifications']['agents'] & {
      lunasea?: unknown;
    })
  | undefined;

export interface LegacySettings {
  clientId?: AllSettings['clientId'];
  vapidPublic?: AllSettings['vapidPublic'];
  vapidPrivate?: AllSettings['vapidPrivate'];
  main: LegacyMainSettings;
  plex?: Partial<PlexSettings>;
  plexServers?: Partial<PlexServerSettings>[];
  jellyfin?: Partial<JellyfinSettings> & {
    hostname?: string;
  };
  jellyfinServers?: Partial<JellyfinServerSettings>[];
  notifications?: Partial<AllSettings['notifications']> & {
    agents?: Partial<NonNullable<LegacyNotificationAgents>>;
  };
  jobs?: Partial<
    Record<JobId | 'process-blacklisted-tags', { schedule: string }>
  >;
  radarr?: Partial<RadarrSettings>[];
  sonarr?: Partial<SonarrSettings>[];
  migrations?: string[];
  public?: AllSettings['public'];
  tautulli?: AllSettings['tautulli'];
  metadataSettings?: AllSettings['metadataSettings'];
  network?: Partial<AllSettings['network']>;
  [key: string]: unknown;
}

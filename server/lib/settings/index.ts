import { MediaServerType } from '@server/constants/server';
import { Permission } from '@server/lib/permissions';
import { runMigrations } from '@server/lib/settings/migrator';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import { mergeWith, omit } from 'lodash';
import path from 'path';
import webpush from 'web-push';

// Prevents stale array entries when incoming data has fewer elements
const mergeSettings = <T>(current: T, incoming: Partial<T>): T =>
  mergeWith({}, current, incoming, (_objValue, srcValue) =>
    Array.isArray(srcValue) ? srcValue : undefined
  ) as T;

export interface Library {
  id: string;
  name: string;
  enabled: boolean;
  type: 'show' | 'movie';
  lastScan?: number;
}

export interface Region {
  iso_3166_1: string;
  english_name: string;
  name?: string;
}

export interface Language {
  iso_639_1: string;
  english_name: string;
  name: string;
}

export interface PlexSettings {
  name: string;
  machineId?: string;
  ip: string;
  port: number;
  useSsl?: boolean;
  libraries: Library[];
  webAppUrl?: string;
}

export interface PlexServerSettings extends PlexSettings {
  id: string;
  mediaServerType: MediaServerType.PLEX;
}

export interface JellyfinSettings {
  name: string;
  ip: string;
  port: number;
  useSsl?: boolean;
  urlBase?: string;
  externalHostname?: string;
  jellyfinForgotPasswordUrl?: string;
  libraries: Library[];
  serverId: string;
  apiKey: string;
  jellyfinUserId?: string;
}

export interface JellyfinServerSettings extends JellyfinSettings {
  // Seerr's stable config entry ID. This is distinct from Jellyfin's native
  // serverId below, which is returned by the remote server after authentication.
  id: string;
  mediaServerType: MediaServerType.JELLYFIN | MediaServerType.EMBY;
}

export type MediaServerSettings = PlexServerSettings | JellyfinServerSettings;
export interface TautulliSettings {
  hostname?: string;
  port?: number;
  useSsl?: boolean;
  urlBase?: string;
  apiKey?: string;
  externalUrl?: string;
}

export interface DVRSettings {
  id: number;
  name: string;
  hostname: string;
  port: number;
  apiKey: string;
  useSsl: boolean;
  baseUrl?: string;
  activeProfileId: number;
  activeProfileName: string;
  activeDirectory: string;
  tags: number[];
  is4k: boolean;
  isDefault: boolean;
  externalUrl?: string;
  syncEnabled: boolean;
  preventSearch: boolean;
  tagRequests: boolean;
  overrideRule: number[];
}

export interface RadarrSettings extends DVRSettings {
  minimumAvailability: string;
}

export interface SonarrSettings extends DVRSettings {
  seriesType: 'standard' | 'daily' | 'anime';
  animeSeriesType: 'standard' | 'daily' | 'anime';
  activeAnimeProfileId?: number;
  activeAnimeProfileName?: string;
  activeAnimeDirectory?: string;
  activeAnimeLanguageProfileId?: number;
  activeLanguageProfileId?: number;
  animeTags?: number[];
  enableSeasonFolders: boolean;
  monitorNewItems: 'all' | 'none';
}

interface Quota {
  quotaLimit?: number;
  quotaDays?: number;
}

export enum MetadataProviderType {
  TMDB = 'tmdb',
  TVDB = 'tvdb',
}

export interface MetadataSettings {
  tv: MetadataProviderType;
  anime: MetadataProviderType;
}

export interface ProxySettings {
  enabled: boolean;
  hostname: string;
  port: number;
  useSsl: boolean;
  user: string;
  password: string;
  bypassFilter: string;
  bypassLocalAddresses: boolean;
}

export interface MainSettings {
  apiKey: string;
  applicationTitle: string;
  applicationUrl: string;
  cacheImages: boolean;
  defaultPermissions: number;
  defaultQuotas: {
    movie: Quota;
    tv: Quota;
  };
  hideAvailable: boolean;
  hideBlocklisted: boolean;
  localLogin: boolean;
  mediaServerLogin: boolean;
  plexLogin: boolean;
  jellyfinLogin: boolean;
  embyLogin: boolean;
  newPlexLogin: boolean;
  discoverRegion: string;
  streamingRegion: string;
  originalLanguage: string;
  blocklistedTags: string;
  blocklistedTagsLimit: number;
  mediaServerType: number;
  partialRequestsEnabled: boolean;
  enableSpecialEpisodes: boolean;
  locale: string;
  youtubeUrl: string;
}

export interface ProxySettings {
  enabled: boolean;
  hostname: string;
  port: number;
  useSsl: boolean;
  user: string;
  password: string;
  bypassFilter: string;
  bypassLocalAddresses: boolean;
}

export interface DnsCacheSettings {
  enabled: boolean;
  forceMinTtl?: number;
  forceMaxTtl?: number;
}

export interface NetworkSettings {
  csrfProtection: boolean;
  forceIpv4First: boolean;
  trustProxy: boolean;
  proxy: ProxySettings;
  dnsCache: DnsCacheSettings;
  apiRequestTimeout: number;
}

interface PublicSettings {
  initialized: boolean;
}

export interface PublicMediaServerSettings {
  id: string;
  mediaServerType: number;
  name: string;
  externalHostname?: string;
  jellyfinForgotPasswordUrl?: string;
}

interface FullPublicSettings extends PublicSettings {
  applicationTitle: string;
  applicationUrl: string;
  hideAvailable: boolean;
  hideBlocklisted: boolean;
  localLogin: boolean;
  mediaServerLogin: boolean;
  plexLogin: boolean;
  jellyfinLogin: boolean;
  embyLogin: boolean;
  movie4kEnabled: boolean;
  series4kEnabled: boolean;
  discoverRegion: string;
  streamingRegion: string;
  originalLanguage: string;
  mediaServerType: number;
  mediaServerTypes: number[];
  mediaServers: PublicMediaServerSettings[];
  jellyfinExternalHost?: string;
  jellyfinForgotPasswordUrl?: string;
  jellyfinServerName?: string;
  partialRequestsEnabled: boolean;
  enableSpecialEpisodes: boolean;
  cacheImages: boolean;
  vapidPublic: string;
  enablePushRegistration: boolean;
  locale: string;
  emailEnabled: boolean;
  userEmailRequired: boolean;
  newPlexLogin: boolean;
  youtubeUrl: string;
}

export interface NotificationAgentConfig {
  enabled: boolean;
  embedPoster: boolean;
  types?: number;
  options: Record<string, unknown>;
}
export interface NotificationAgentDiscord extends NotificationAgentConfig {
  options: {
    botUsername?: string;
    botAvatarUrl?: string;
    webhookUrl: string;
    webhookRoleId?: string;
    enableMentions: boolean;
  };
}

export interface NotificationAgentSlack extends NotificationAgentConfig {
  options: {
    webhookUrl: string;
  };
}

export interface NotificationAgentEmail extends NotificationAgentConfig {
  options: {
    userEmailRequired: boolean;
    emailFrom: string;
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    ignoreTls: boolean;
    requireTls: boolean;
    authUser?: string;
    authPass?: string;
    allowSelfSigned: boolean;
    senderName: string;
    pgpPrivateKey?: string;
    pgpPassword?: string;
  };
}

export interface NotificationAgentTelegram extends NotificationAgentConfig {
  options: {
    botUsername?: string;
    botAPI: string;
    chatId: string;
    messageThreadId: string;
    sendSilently: boolean;
  };
}

export interface NotificationAgentPushbullet extends NotificationAgentConfig {
  options: {
    accessToken: string;
    channelTag?: string;
  };
}

export interface NotificationAgentPushover extends NotificationAgentConfig {
  options: {
    accessToken: string;
    userToken: string;
    sound: string;
  };
}

export interface NotificationAgentWebhook extends NotificationAgentConfig {
  options: {
    webhookUrl: string;
    jsonPayload: string;
    authHeader?: string;
    customHeaders?: { key: string; value: string }[];
    supportVariables?: boolean;
  };
}

export interface NotificationAgentGotify extends NotificationAgentConfig {
  options: {
    url: string;
    token: string;
    priority: number;
  };
}

export interface NotificationAgentNtfy extends NotificationAgentConfig {
  options: {
    url: string;
    topic: string;
    authMethodUsernamePassword?: boolean;
    username?: string;
    password?: string;
    authMethodToken?: boolean;
    token?: string;
    priority?: number;
  };
}

export enum NotificationAgentKey {
  DISCORD = 'discord',
  EMAIL = 'email',
  GOTIFY = 'gotify',
  NTFY = 'ntfy',
  PUSHBULLET = 'pushbullet',
  PUSHOVER = 'pushover',
  SLACK = 'slack',
  TELEGRAM = 'telegram',
  WEBHOOK = 'webhook',
  WEBPUSH = 'webpush',
}

interface NotificationAgents {
  discord: NotificationAgentDiscord;
  email: NotificationAgentEmail;
  gotify: NotificationAgentGotify;
  ntfy: NotificationAgentNtfy;
  pushbullet: NotificationAgentPushbullet;
  pushover: NotificationAgentPushover;
  slack: NotificationAgentSlack;
  telegram: NotificationAgentTelegram;
  webhook: NotificationAgentWebhook;
  webpush: NotificationAgentConfig;
}

interface NotificationSettings {
  agents: NotificationAgents;
}

interface JobSettings {
  schedule: string;
}

export type JobId =
  | 'plex-recently-added-scan'
  | 'plex-full-scan'
  | 'plex-watchlist-sync'
  | 'plex-refresh-token'
  | 'radarr-scan'
  | 'sonarr-scan'
  | 'download-sync'
  | 'download-sync-reset'
  | 'jellyfin-recently-added-scan'
  | 'jellyfin-full-scan'
  | 'image-cache-cleanup'
  | 'availability-sync'
  | 'process-blocklisted-tags';

export interface AllSettings {
  clientId: string;
  vapidPublic: string;
  vapidPrivate: string;
  main: MainSettings;
  plex: PlexSettings;
  plexServers: PlexServerSettings[];
  jellyfin: JellyfinSettings;
  jellyfinServers: JellyfinServerSettings[];
  tautulli: TautulliSettings;
  radarr: RadarrSettings[];
  sonarr: SonarrSettings[];
  public: PublicSettings;
  notifications: NotificationSettings;
  jobs: Record<JobId, JobSettings>;
  network: NetworkSettings;
  metadataSettings: MetadataSettings;
  migrations: string[];
}

const SETTINGS_PATH = process.env.CONFIG_DIRECTORY
  ? `${process.env.CONFIG_DIRECTORY}/settings.json`
  : path.join(__dirname, '../../../config/settings.json');

const getDefaultPlexSettings = (): PlexSettings => ({
  name: '',
  ip: '',
  port: 32400,
  useSsl: false,
  libraries: [],
});

const getDefaultJellyfinSettings = (): JellyfinSettings => ({
  name: '',
  ip: '',
  port: 8096,
  useSsl: false,
  urlBase: '',
  externalHostname: '',
  jellyfinForgotPasswordUrl: '',
  libraries: [],
  serverId: '',
  apiKey: '',
});

class Settings {
  private data: AllSettings;
  private saveLock: Promise<void> = Promise.resolve();

  constructor(initialSettings?: AllSettings) {
    this.data = {
      clientId: randomUUID(),
      vapidPrivate: '',
      vapidPublic: '',
      main: {
        apiKey: '',
        applicationTitle: 'Seerr',
        applicationUrl: '',
        cacheImages: false,
        defaultPermissions: Permission.REQUEST,
        defaultQuotas: {
          movie: {},
          tv: {},
        },
        hideAvailable: false,
        hideBlocklisted: false,
        localLogin: true,
        mediaServerLogin: true,
        plexLogin: true,
        jellyfinLogin: true,
        embyLogin: true,
        newPlexLogin: true,
        discoverRegion: '',
        streamingRegion: '',
        originalLanguage: '',
        blocklistedTags: '',
        blocklistedTagsLimit: 50,
        mediaServerType: MediaServerType.NOT_CONFIGURED,
        partialRequestsEnabled: true,
        enableSpecialEpisodes: false,
        locale: 'en',
        youtubeUrl: '',
      },
      plex: getDefaultPlexSettings(),
      plexServers: [],
      jellyfin: getDefaultJellyfinSettings(),
      jellyfinServers: [],
      tautulli: {},
      metadataSettings: {
        tv: MetadataProviderType.TMDB,
        anime: MetadataProviderType.TMDB,
      },
      radarr: [],
      sonarr: [],
      public: {
        initialized: false,
      },
      notifications: {
        agents: {
          email: {
            enabled: false,
            embedPoster: true,
            options: {
              userEmailRequired: false,
              emailFrom: '',
              smtpHost: '',
              smtpPort: 587,
              secure: false,
              ignoreTls: false,
              requireTls: false,
              allowSelfSigned: false,
              senderName: 'Seerr',
            },
          },
          discord: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              webhookUrl: '',
              webhookRoleId: '',
              enableMentions: true,
            },
          },
          slack: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              webhookUrl: '',
            },
          },
          telegram: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              botAPI: '',
              chatId: '',
              messageThreadId: '',
              sendSilently: false,
            },
          },
          pushbullet: {
            enabled: false,
            embedPoster: false,
            types: 0,
            options: {
              accessToken: '',
            },
          },
          pushover: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              accessToken: '',
              userToken: '',
              sound: '',
            },
          },
          webhook: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              webhookUrl: '',
              jsonPayload:
                'IntcbiAgXCJub3RpZmljYXRpb25fdHlwZVwiOiBcInt7bm90aWZpY2F0aW9uX3R5cGV9fVwiLFxuICBcImV2ZW50XCI6IFwie3tldmVudH19XCIsXG4gIFwic3ViamVjdFwiOiBcInt7c3ViamVjdH19XCIsXG4gIFwibWVzc2FnZVwiOiBcInt7bWVzc2FnZX19XCIsXG4gIFwiaW1hZ2VcIjogXCJ7e2ltYWdlfX1cIixcbiAgXCJ7e21lZGlhfX1cIjoge1xuICAgIFwibWVkaWFfdHlwZVwiOiBcInt7bWVkaWFfdHlwZX19XCIsXG4gICAgXCJ0bWRiSWRcIjogXCJ7e21lZGlhX3RtZGJpZH19XCIsXG4gICAgXCJ0dmRiSWRcIjogXCJ7e21lZGlhX3R2ZGJpZH19XCIsXG4gICAgXCJzdGF0dXNcIjogXCJ7e21lZGlhX3N0YXR1c319XCIsXG4gICAgXCJzdGF0dXM0a1wiOiBcInt7bWVkaWFfc3RhdHVzNGt9fVwiXG4gIH0sXG4gIFwie3tyZXF1ZXN0fX1cIjoge1xuICAgIFwicmVxdWVzdF9pZFwiOiBcInt7cmVxdWVzdF9pZH19XCIsXG4gICAgXCJyZXF1ZXN0ZWRCeV9lbWFpbFwiOiBcInt7cmVxdWVzdGVkQnlfZW1haWx9fVwiLFxuICAgIFwicmVxdWVzdGVkQnlfdXNlcm5hbWVcIjogXCJ7e3JlcXVlc3RlZEJ5X3VzZXJuYW1lfX1cIixcbiAgICBcInJlcXVlc3RlZEJ5X2F2YXRhclwiOiBcInt7cmVxdWVzdGVkQnlfYXZhdGFyfX1cIixcbiAgICBcInJlcXVlc3RlZEJ5X3NldHRpbmdzX2Rpc2NvcmRJZFwiOiBcInt7cmVxdWVzdGVkQnlfc2V0dGluZ3NfZGlzY29yZElkfX1cIixcbiAgICBcInJlcXVlc3RlZEJ5X3NldHRpbmdzX3RlbGVncmFtQ2hhdElkXCI6IFwie3tyZXF1ZXN0ZWRCeV9zZXR0aW5nc190ZWxlZ3JhbUNoYXRJZH19XCJcbiAgfSxcbiAgXCJ7e2lzc3VlfX1cIjoge1xuICAgIFwiaXNzdWVfaWRcIjogXCJ7e2lzc3VlX2lkfX1cIixcbiAgICBcImlzc3VlX3R5cGVcIjogXCJ7e2lzc3VlX3R5cGV9fVwiLFxuICAgIFwiaXNzdWVfc3RhdHVzXCI6IFwie3tpc3N1ZV9zdGF0dXN9fVwiLFxuICAgIFwicmVwb3J0ZWRCeV9lbWFpbFwiOiBcInt7cmVwb3J0ZWRCeV9lbWFpbH19XCIsXG4gICAgXCJyZXBvcnRlZEJ5X3VzZXJuYW1lXCI6IFwie3tyZXBvcnRlZEJ5X3VzZXJuYW1lfX1cIixcbiAgICBcInJlcG9ydGVkQnlfYXZhdGFyXCI6IFwie3tyZXBvcnRlZEJ5X2F2YXRhcn19XCIsXG4gICAgXCJyZXBvcnRlZEJ5X3NldHRpbmdzX2Rpc2NvcmRJZFwiOiBcInt7cmVwb3J0ZWRCeV9zZXR0aW5nc19kaXNjb3JkSWR9fVwiLFxuICAgIFwicmVwb3J0ZWRCeV9zZXR0aW5nc190ZWxlZ3JhbUNoYXRJZFwiOiBcInt7cmVwb3J0ZWRCeV9zZXR0aW5nc190ZWxlZ3JhbUNoYXRJZH19XCJcbiAgfSxcbiAgXCJ7e2NvbW1lbnR9fVwiOiB7XG4gICAgXCJjb21tZW50X21lc3NhZ2VcIjogXCJ7e2NvbW1lbnRfbWVzc2FnZX19XCIsXG4gICAgXCJjb21tZW50ZWRCeV9lbWFpbFwiOiBcInt7Y29tbWVudGVkQnlfZW1haWx9fVwiLFxuICAgIFwiY29tbWVudGVkQnlfdXNlcm5hbWVcIjogXCJ7e2NvbW1lbnRlZEJ5X3VzZXJuYW1lfX1cIixcbiAgICBcImNvbW1lbnRlZEJ5X2F2YXRhclwiOiBcInt7Y29tbWVudGVkQnlfYXZhdGFyfX1cIixcbiAgICBcImNvbW1lbnRlZEJ5X3NldHRpbmdzX2Rpc2NvcmRJZFwiOiBcInt7Y29tbWVudGVkQnlfc2V0dGluZ3NfZGlzY29yZElkfX1cIixcbiAgICBcImNvbW1lbnRlZEJ5X3NldHRpbmdzX3RlbGVncmFtQ2hhdElkXCI6IFwie3tjb21tZW50ZWRCeV9zZXR0aW5nc190ZWxlZ3JhbUNoYXRJZH19XCJcbiAgfSxcbiAgXCJ7e2V4dHJhfX1cIjogW11cbn0i',
            },
          },
          webpush: {
            enabled: false,
            embedPoster: true,
            options: {},
          },
          gotify: {
            enabled: false,
            embedPoster: false,
            types: 0,
            options: {
              url: '',
              token: '',
              priority: 0,
            },
          },
          ntfy: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              url: '',
              topic: '',
              priority: 3,
            },
          },
        },
      },
      jobs: {
        'plex-recently-added-scan': {
          schedule: '0 */5 * * * *',
        },
        'plex-full-scan': {
          schedule: '0 0 3 * * *',
        },
        'plex-watchlist-sync': {
          schedule: '0 */3 * * * *',
        },
        'plex-refresh-token': {
          schedule: '0 0 5 * * *',
        },
        'radarr-scan': {
          schedule: '0 0 4 * * *',
        },
        'sonarr-scan': {
          schedule: '0 30 4 * * *',
        },
        'availability-sync': {
          schedule: '0 0 5 * * *',
        },
        'download-sync': {
          schedule: '0 * * * * *',
        },
        'download-sync-reset': {
          schedule: '0 0 1 * * *',
        },
        'jellyfin-recently-added-scan': {
          schedule: '0 */5 * * * *',
        },
        'jellyfin-full-scan': {
          schedule: '0 0 3 * * *',
        },
        'image-cache-cleanup': {
          schedule: '0 0 5 * * *',
        },
        'process-blocklisted-tags': {
          schedule: '0 30 1 */7 * *',
        },
      },
      network: {
        csrfProtection: false,
        forceIpv4First: false,
        trustProxy: false,
        proxy: {
          enabled: false,
          hostname: '',
          port: 8080,
          useSsl: false,
          user: '',
          password: '',
          bypassFilter: '',
          bypassLocalAddresses: true,
        },
        dnsCache: {
          enabled: false,
          forceMinTtl: 0,
          forceMaxTtl: -1,
        },
        apiRequestTimeout: 10000,
      },
      migrations: [],
    };
    if (initialSettings) {
      this.data = mergeSettings(this.data, initialSettings);
    }

    this.synchronizeMediaServerSettings();
  }

  get main(): MainSettings {
    return this.data.main;
  }

  set main(data: MainSettings) {
    this.data.main = mergeSettings(this.data.main, data);
  }

  get plex(): PlexSettings {
    return this.data.plex;
  }

  set plex(data: PlexSettings) {
    this.data.plex = mergeSettings(this.data.plex, data);
    this.synchronizeMediaServerSettings({ syncLegacyFromArrays: false });
  }

  get plexServers(): PlexServerSettings[] {
    return this.clonePlexServers(this.data.plexServers);
  }

  set plexServers(data: PlexServerSettings[]) {
    this.data.plexServers = this.clonePlexServers(data);
    this.synchronizeMediaServerSettings();
  }

  get jellyfin(): JellyfinSettings {
    return this.data.jellyfin;
  }

  set jellyfin(data: JellyfinSettings) {
    this.data.jellyfin = mergeSettings(this.data.jellyfin, data);
    this.synchronizeMediaServerSettings({ syncLegacyFromArrays: false });
  }

  get jellyfinServers(): JellyfinServerSettings[] {
    return this.cloneJellyfinServers(this.data.jellyfinServers);
  }

  set jellyfinServers(data: JellyfinServerSettings[]) {
    this.data.jellyfinServers = this.cloneJellyfinServers(data);
    this.synchronizeMediaServerSettings();
  }

  public upsertPlexServer(server: PlexServerSettings): void {
    const existingServerIndex = this.data.plexServers.findIndex(
      (candidate) => candidate.id === server.id
    );

    if (existingServerIndex >= 0) {
      this.data.plexServers[existingServerIndex] = this.clonePlexServer(server);
    } else {
      this.data.plexServers.push(this.clonePlexServer(server));
    }

    this.synchronizeMediaServerSettings();
  }

  public updatePlexServer(
    serverId: string,
    updater: (server: PlexServerSettings) => PlexServerSettings
  ): boolean {
    const serverIndex = this.data.plexServers.findIndex(
      (server) => server.id === serverId
    );

    if (serverIndex === -1) {
      return false;
    }

    this.data.plexServers[serverIndex] = this.clonePlexServer(
      updater(this.clonePlexServer(this.data.plexServers[serverIndex]))
    );
    this.synchronizeMediaServerSettings();

    return true;
  }

  public removePlexServer(serverId: string): PlexServerSettings | undefined {
    const serverIndex = this.data.plexServers.findIndex(
      (server) => server.id === serverId
    );

    if (serverIndex === -1) {
      return undefined;
    }

    const [removedServer] = this.data.plexServers.splice(serverIndex, 1);
    this.synchronizeMediaServerSettings();

    return this.clonePlexServer(removedServer);
  }

  public upsertJellyfinServer(server: JellyfinServerSettings): void {
    const existingServerIndex = this.data.jellyfinServers.findIndex(
      (candidate) => candidate.id === server.id
    );

    if (existingServerIndex >= 0) {
      this.data.jellyfinServers[existingServerIndex] =
        this.cloneJellyfinServer(server);
    } else {
      this.data.jellyfinServers.push(this.cloneJellyfinServer(server));
    }

    this.synchronizeMediaServerSettings();
  }

  public updateJellyfinServer(
    serverId: string,
    updater: (server: JellyfinServerSettings) => JellyfinServerSettings
  ): boolean {
    const serverIndex = this.data.jellyfinServers.findIndex(
      (server) => server.id === serverId
    );

    if (serverIndex === -1) {
      return false;
    }

    this.data.jellyfinServers[serverIndex] = this.cloneJellyfinServer(
      updater(this.cloneJellyfinServer(this.data.jellyfinServers[serverIndex]))
    );
    this.synchronizeMediaServerSettings();

    return true;
  }

  public removeJellyfinServer(
    serverId: string
  ): JellyfinServerSettings | undefined {
    const serverIndex = this.data.jellyfinServers.findIndex(
      (server) => server.id === serverId
    );

    if (serverIndex === -1) {
      return undefined;
    }

    const [removedServer] = this.data.jellyfinServers.splice(serverIndex, 1);
    this.synchronizeMediaServerSettings();

    return this.cloneJellyfinServer(removedServer);
  }

  get tautulli(): TautulliSettings {
    return this.data.tautulli;
  }

  set tautulli(data: TautulliSettings) {
    this.data.tautulli = mergeSettings(this.data.tautulli, data);
  }

  get metadataSettings(): MetadataSettings {
    return this.data.metadataSettings;
  }

  set metadataSettings(data: MetadataSettings) {
    this.data.metadataSettings = mergeSettings(
      this.data.metadataSettings,
      data
    );
  }

  get radarr(): RadarrSettings[] {
    return this.data.radarr;
  }

  set radarr(data: RadarrSettings[]) {
    this.data.radarr = data;
  }

  get sonarr(): SonarrSettings[] {
    return this.data.sonarr;
  }

  set sonarr(data: SonarrSettings[]) {
    this.data.sonarr = data;
  }

  get public(): PublicSettings {
    return this.data.public;
  }

  set public(data: PublicSettings) {
    this.data.public = mergeSettings(this.data.public, data);
  }

  get fullPublicSettings(): FullPublicSettings {
    const mediaServers = this.getMediaServers();
    const primaryMediaServerType = this.getPrimaryMediaServerType();
    const activeJellyfinLikeServer =
      primaryMediaServerType === MediaServerType.JELLYFIN ||
      primaryMediaServerType === MediaServerType.EMBY
        ? this.getPrimaryJellyfinLikeServer(primaryMediaServerType)
        : this.getPrimaryJellyfinLikeServer();

    return {
      ...this.data.public,
      applicationTitle: this.data.main.applicationTitle,
      applicationUrl: this.data.main.applicationUrl,
      hideAvailable: this.data.main.hideAvailable,
      hideBlocklisted: this.data.main.hideBlocklisted,
      localLogin: this.data.main.localLogin,
      mediaServerLogin: this.data.main.mediaServerLogin,
      plexLogin: this.data.main.plexLogin,
      jellyfinLogin: this.data.main.jellyfinLogin,
      embyLogin: this.data.main.embyLogin,
      movie4kEnabled: this.data.radarr.some(
        (radarr) => radarr.is4k && radarr.isDefault
      ),
      series4kEnabled: this.data.sonarr.some(
        (sonarr) => sonarr.is4k && sonarr.isDefault
      ),
      discoverRegion: this.data.main.discoverRegion,
      streamingRegion: this.data.main.streamingRegion,
      originalLanguage: this.data.main.originalLanguage,
      mediaServerType: this.getPrimaryMediaServerType(),
      mediaServerTypes: this.getMediaServerTypes(),
      mediaServers: mediaServers.map((server) => ({
        id: server.id,
        mediaServerType: server.mediaServerType,
        name: server.name,
        externalHostname:
          'externalHostname' in server ? server.externalHostname : undefined,
        jellyfinForgotPasswordUrl:
          'jellyfinForgotPasswordUrl' in server
            ? server.jellyfinForgotPasswordUrl
            : undefined,
      })),
      partialRequestsEnabled: this.data.main.partialRequestsEnabled,
      enableSpecialEpisodes: this.data.main.enableSpecialEpisodes,
      cacheImages: this.data.main.cacheImages,
      vapidPublic: this.vapidPublic,
      enablePushRegistration: this.data.notifications.agents.webpush.enabled,
      locale: this.data.main.locale,
      emailEnabled: this.data.notifications.agents.email.enabled,
      userEmailRequired:
        this.data.notifications.agents.email.options.userEmailRequired,
      newPlexLogin: this.data.main.newPlexLogin,
      youtubeUrl: this.data.main.youtubeUrl,
      jellyfinExternalHost: activeJellyfinLikeServer?.externalHostname,
      jellyfinForgotPasswordUrl:
        activeJellyfinLikeServer?.jellyfinForgotPasswordUrl,
      jellyfinServerName: activeJellyfinLikeServer?.name,
    };
  }

  get notifications(): NotificationSettings {
    return this.data.notifications;
  }

  set notifications(data: NotificationSettings) {
    this.data.notifications = mergeSettings(this.data.notifications, data);
  }

  get jobs(): Record<JobId, JobSettings> {
    return this.data.jobs;
  }

  set jobs(data: Record<JobId, JobSettings>) {
    this.data.jobs = mergeSettings(this.data.jobs, data);
  }

  get network(): NetworkSettings {
    return this.data.network;
  }

  set network(data: NetworkSettings) {
    this.data.network = mergeSettings(this.data.network, data);
  }

  get migrations(): string[] {
    return this.data.migrations;
  }

  set migrations(data: string[]) {
    this.data.migrations = data;
  }

  get clientId(): string {
    return this.data.clientId;
  }

  get vapidPublic(): string {
    return this.data.vapidPublic;
  }

  get vapidPrivate(): string {
    return this.data.vapidPrivate;
  }

  public async regenerateApiKey(): Promise<MainSettings> {
    this.main.apiKey = this.generateApiKey();
    await this.save();
    return this.main;
  }

  private generateApiKey(): string {
    if (process.env.API_KEY) {
      return process.env.API_KEY;
    } else {
      return Buffer.from(`${Date.now()}${randomUUID()}`).toString('base64');
    }
  }

  private cloneLibraries(libraries: Library[] = []): Library[] {
    return libraries.map((library) => ({ ...library }));
  }

  private clonePlexServer(server: PlexServerSettings): PlexServerSettings {
    return {
      ...server,
      libraries: this.cloneLibraries(server.libraries),
    };
  }

  private clonePlexServers(
    data: PlexServerSettings[] = []
  ): PlexServerSettings[] {
    return data.map((server) => this.clonePlexServer(server));
  }

  private cloneJellyfinServer(
    server: JellyfinServerSettings
  ): JellyfinServerSettings {
    return {
      ...server,
      libraries: this.cloneLibraries(server.libraries),
    };
  }

  private cloneJellyfinServers(
    data: JellyfinServerSettings[] = []
  ): JellyfinServerSettings[] {
    return data.map((server) => this.cloneJellyfinServer(server));
  }

  private async finalizeLoadedSettings(): Promise<void> {
    // generate keys and ids if it's missing
    let change = this.synchronizeMediaServerSettings();
    if (!this.data.main.apiKey) {
      this.data.main.apiKey = this.generateApiKey();
      change = true;
    } else if (process.env.API_KEY) {
      if (this.main.apiKey != process.env.API_KEY) {
        this.main.apiKey = process.env.API_KEY;
      }
    }
    if (!this.data.clientId) {
      this.data.clientId = randomUUID();
      change = true;
    }
    if (!this.data.vapidPublic || !this.data.vapidPrivate) {
      const vapidKeys = webpush.generateVAPIDKeys();
      this.data.vapidPrivate = vapidKeys.privateKey;
      this.data.vapidPublic = vapidKeys.publicKey;
      change = true;
    }
    if (change) {
      await this.save();
    }
  }

  /**
   * Settings Load
   *
   * This will load settings from file unless an optional argument of the object structure
   * is passed in.
   * @param overrideSettings If passed in, will override all existing settings with these
   * @param raw If true, will load the settings without running migrations or generating missing
   * values
   */
  public async load(
    overrideSettings?: AllSettings,
    raw = false
  ): Promise<Settings> {
    if (overrideSettings) {
      this.data = overrideSettings;
      await this.finalizeLoadedSettings();
      return this;
    }

    let data;
    try {
      data = await fs.readFile(SETTINGS_PATH, 'utf-8');
    } catch {
      await this.save();
    }

    if (data && !raw) {
      const parsedJson = JSON.parse(data);
      const migratedData = await runMigrations(parsedJson, SETTINGS_PATH);
      this.data = mergeSettings(this.data, migratedData);
    } else if (data) {
      this.data = JSON.parse(data);
    }

    await this.finalizeLoadedSettings();

    return this;
  }

  public async save(): Promise<void> {
    this.synchronizeMediaServerSettings();

    const savePromise = this.saveLock.then(async () => {
      const tmp = SETTINGS_PATH + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(this.data, undefined, ' '));
      await fs.rename(tmp, SETTINGS_PATH);
    });

    this.saveLock = savePromise.catch(() => {
      // Keep the chain alive so future saves aren't blocked by past failures
    });

    return savePromise;
  }

  public getMediaServers(): MediaServerSettings[] {
    return [...this.plexServers, ...this.jellyfinServers];
  }

  public getMediaServerTypes(): number[] {
    return [
      ...new Set(
        this.getMediaServers().map((server) => server.mediaServerType)
      ),
    ];
  }

  public getPrimaryMediaServerType(): number {
    const mediaServerTypes = this.getMediaServerTypes();
    const configuredPrimaryMediaServerType = this.data.main.mediaServerType;

    if (
      configuredPrimaryMediaServerType !== MediaServerType.NOT_CONFIGURED &&
      mediaServerTypes.includes(configuredPrimaryMediaServerType)
    ) {
      return configuredPrimaryMediaServerType;
    }

    if (mediaServerTypes.length === 1) {
      return mediaServerTypes[0];
    }

    return MediaServerType.NOT_CONFIGURED;
  }

  public isAuthMethodEnabled(
    mediaServerType:
      | MediaServerType.PLEX
      | MediaServerType.JELLYFIN
      | MediaServerType.EMBY
  ): boolean {
    switch (mediaServerType) {
      case MediaServerType.PLEX:
        return this.data.main.plexLogin;
      case MediaServerType.JELLYFIN:
        return this.data.main.jellyfinLogin;
      case MediaServerType.EMBY:
        return this.data.main.embyLogin;
    }
  }

  public getPrimaryPlexServer(): PlexServerSettings | undefined {
    return this.data.plexServers[0]
      ? this.clonePlexServer(this.data.plexServers[0])
      : undefined;
  }

  public getPrimaryJellyfinLikeServer(
    mediaServerType?: MediaServerType.JELLYFIN | MediaServerType.EMBY
  ): JellyfinServerSettings | undefined {
    const server = this.data.jellyfinServers.find((candidate) =>
      mediaServerType ? candidate.mediaServerType === mediaServerType : true
    );

    return server ? this.cloneJellyfinServer(server) : undefined;
  }

  private getLegacyJellyfinServerIndex(): number {
    const legacyMediaServerType =
      this.data.main.mediaServerType === MediaServerType.EMBY
        ? MediaServerType.EMBY
        : MediaServerType.JELLYFIN;

    const exactMatchIndex = this.data.jellyfinServers.findIndex(
      (server) =>
        server.mediaServerType === legacyMediaServerType &&
        (!this.data.jellyfin.serverId ||
          server.serverId === this.data.jellyfin.serverId)
    );

    if (exactMatchIndex >= 0) {
      return exactMatchIndex;
    }

    const typeMatchIndex = this.data.jellyfinServers.findIndex(
      (server) => server.mediaServerType === legacyMediaServerType
    );

    if (typeMatchIndex >= 0) {
      return typeMatchIndex;
    }

    return this.data.jellyfinServers[0] ? 0 : -1;
  }

  private synchronizeMediaServerSettings({
    syncLegacyFromArrays = true,
  }: { syncLegacyFromArrays?: boolean } = {}): boolean {
    const originalState = JSON.stringify({
      main: this.data.main,
      plex: this.data.plex,
      jellyfin: this.data.jellyfin,
      plexServers: this.data.plexServers,
      jellyfinServers: this.data.jellyfinServers,
    });
    const legacyMediaServerLogin = this.data.main.mediaServerLogin ?? true;

    this.data.main.plexLogin ??= legacyMediaServerLogin;
    this.data.main.jellyfinLogin ??= legacyMediaServerLogin;
    this.data.main.embyLogin ??= legacyMediaServerLogin;
    this.data.main.mediaServerLogin =
      this.data.main.plexLogin ||
      this.data.main.jellyfinLogin ||
      this.data.main.embyLogin;

    this.data.plexServers = (this.data.plexServers ?? []).map((server) => ({
      ...server,
      id: server.id || randomUUID(),
      mediaServerType: MediaServerType.PLEX,
    }));
    this.data.jellyfinServers = (this.data.jellyfinServers ?? []).map(
      (server) => ({
        ...server,
        id: server.id || randomUUID(),
        mediaServerType:
          server.mediaServerType === MediaServerType.EMBY
            ? MediaServerType.EMBY
            : MediaServerType.JELLYFIN,
      })
    );

    if (
      this.data.plexServers.length === 0 &&
      (this.data.plex.ip ||
        this.data.plex.machineId ||
        this.data.plex.libraries.length > 0)
    ) {
      this.data.plexServers.push({
        id: randomUUID(),
        mediaServerType: MediaServerType.PLEX,
        ...this.data.plex,
      });
    }

    if (
      this.data.jellyfinServers.length === 0 &&
      (this.data.jellyfin.ip ||
        this.data.jellyfin.serverId ||
        this.data.jellyfin.libraries.length > 0)
    ) {
      this.data.jellyfinServers.push({
        id: randomUUID(),
        mediaServerType:
          this.data.main.mediaServerType === MediaServerType.EMBY
            ? MediaServerType.EMBY
            : MediaServerType.JELLYFIN,
        ...this.data.jellyfin,
      });
    }

    if (syncLegacyFromArrays) {
      const primaryPlexServer = this.getPrimaryPlexServer();
      if (primaryPlexServer) {
        this.data.plex = omit(primaryPlexServer, [
          'id',
          'mediaServerType',
        ]) as PlexSettings;
      } else {
        this.data.plex = getDefaultPlexSettings();
      }

      const primaryMediaServerType = this.getPrimaryMediaServerType();
      const primaryJellyfinServer =
        primaryMediaServerType === MediaServerType.JELLYFIN ||
        primaryMediaServerType === MediaServerType.EMBY
          ? this.getPrimaryJellyfinLikeServer(primaryMediaServerType)
          : this.getPrimaryJellyfinLikeServer();
      if (primaryJellyfinServer) {
        this.data.jellyfin = omit(primaryJellyfinServer, [
          'id',
          'mediaServerType',
        ]) as JellyfinSettings;
      } else {
        this.data.jellyfin = getDefaultJellyfinSettings();
      }
    } else {
      if (this.data.plexServers[0]) {
        this.data.plexServers[0] = {
          ...this.data.plexServers[0],
          ...this.data.plex,
          id: this.data.plexServers[0].id,
          mediaServerType: MediaServerType.PLEX,
        };
      } else if (
        this.data.plex.ip ||
        this.data.plex.machineId ||
        this.data.plex.libraries.length > 0
      ) {
        this.data.plexServers = [
          {
            id: randomUUID(),
            mediaServerType: MediaServerType.PLEX,
            ...this.data.plex,
          },
        ];
      }

      const legacyJellyfinServerIndex = this.getLegacyJellyfinServerIndex();
      if (legacyJellyfinServerIndex >= 0) {
        this.data.jellyfinServers[legacyJellyfinServerIndex] = {
          ...this.data.jellyfinServers[legacyJellyfinServerIndex],
          ...this.data.jellyfin,
          id: this.data.jellyfinServers[legacyJellyfinServerIndex].id,
          mediaServerType:
            this.data.jellyfinServers[legacyJellyfinServerIndex]
              .mediaServerType,
        };
      } else if (
        this.data.jellyfin.ip ||
        this.data.jellyfin.serverId ||
        this.data.jellyfin.libraries.length > 0
      ) {
        this.data.jellyfinServers = [
          {
            id: randomUUID(),
            mediaServerType:
              this.data.main.mediaServerType === MediaServerType.EMBY
                ? MediaServerType.EMBY
                : MediaServerType.JELLYFIN,
            ...this.data.jellyfin,
          },
        ];
      }
    }

    return (
      originalState !==
      JSON.stringify({
        main: this.data.main,
        plex: this.data.plex,
        jellyfin: this.data.jellyfin,
        plexServers: this.data.plexServers,
        jellyfinServers: this.data.jellyfinServers,
      })
    );
  }
}

let settings: Settings | undefined;

export const getSettings = (initialSettings?: AllSettings): Settings => {
  if (!settings) {
    settings = new Settings(initialSettings);
  }

  return settings;
};

export default Settings;

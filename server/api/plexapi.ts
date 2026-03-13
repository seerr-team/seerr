import ExternalAPI from '@server/api/externalapi';
import type { Library, PlexSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

interface PlexStatusResponse {
  MediaContainer: {
    machineIdentifier: string;
    friendlyName: string;
  };
}

export interface PlexLibraryItem {
  ratingKey: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  title: string;
  guid: string;
  parentGuid?: string;
  grandparentGuid?: string;
  addedAt: number;
  updatedAt: number;
  Guid?: {
    id: string;
  }[];
  type: 'movie' | 'show' | 'season' | 'episode';
  Media: Media[];
}

interface PlexLibraryResponse {
  MediaContainer: {
    totalSize: number;
    Metadata: PlexLibraryItem[];
  };
}

export interface PlexLibrary {
  type: 'show' | 'movie';
  key: string;
  title: string;
  agent: string;
}

interface PlexLibrariesResponse {
  MediaContainer: {
    Directory: PlexLibrary[];
  };
}

export interface PlexMetadata {
  ratingKey: string;
  parentRatingKey?: string;
  guid: string;
  type: 'movie' | 'show' | 'season';
  title: string;
  Guid: {
    id: string;
  }[];
  Children?: {
    size: 12;
    Metadata: PlexMetadata[];
  };
  index: number;
  parentIndex?: number;
  leafCount: number;
  viewedLeafCount: number;
  addedAt: number;
  updatedAt: number;
  Media: Media[];
}

interface Media {
  id: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  aspectRatio: number;
  audioChannels: number;
  audioCodec: string;
  videoCodec: string;
  videoResolution: string;
  container: string;
  videoFrameRate: string;
  videoProfile: string;
}

interface PlexMetadataResponse {
  MediaContainer: {
    Metadata: PlexMetadata[];
  };
}

class PlexAPI extends ExternalAPI {
  private readonly plexSettings: PlexSettings;
  private readonly plexServerId?: string;

  constructor({
    plexToken,
    plexSettings,
    plexServerId,
    timeout,
  }: {
    plexToken?: string | null;
    plexSettings?: PlexSettings;
    plexServerId?: string;
    timeout?: number;
  }) {
    const settings = getSettings();
    const settingsPlex = plexSettings ?? settings.plex;

    const protocol = settingsPlex.useSsl ? 'https' : 'http';
    const baseUrl = `${protocol}://${settingsPlex.ip}:${settingsPlex.port}`;

    super(
      baseUrl,
      {},
      {
        timeout,
        headers: {
          'X-Plex-Token': plexToken ?? '',
          'X-Plex-Client-Identifier': settings.clientId,
          'X-Plex-Product': 'Seerr',
          'X-Plex-Device-Name': 'Seerr',
          'X-Plex-Platform': 'Seerr',
        },
      }
    );

    this.plexSettings = settingsPlex;
    this.plexServerId = plexServerId;
  }

  public async getStatus(): Promise<PlexStatusResponse> {
    return await this.get('/');
  }

  public async getLibraries(): Promise<PlexLibrary[]> {
    const response = await this.get<PlexLibrariesResponse>('/library/sections');

    return response.MediaContainer.Directory;
  }

  public async syncLibraries(serverId?: string): Promise<void> {
    const settings = getSettings();
    const targetServerId = serverId ?? this.plexServerId;
    const existingLibraries =
      targetServerId !== undefined
        ? (settings.plexServers.find((server) => server.id === targetServerId)
            ?.libraries ?? [])
        : settings.plex.libraries;

    try {
      const libraries = await this.getLibraries();

      const newLibraries: Library[] = libraries
        // Remove libraries that are not movie or show
        .filter(
          (library) => library.type === 'movie' || library.type === 'show'
        )
        // Remove libraries that do not have a metadata agent set (usually personal video libraries)
        .filter((library) => library.agent !== 'com.plexapp.agents.none')
        .map((library) => {
          const existing = existingLibraries.find(
            (l) => l.id === library.key && l.name === library.title
          );

          return {
            id: library.key,
            name: library.title,
            enabled: existing?.enabled ?? false,
            type: library.type,
            lastScan: existing?.lastScan,
          };
        });

      if (targetServerId !== undefined) {
        const serverIndex = settings.plexServers.findIndex(
          (server) => server.id === targetServerId
        );

        if (serverIndex >= 0) {
          settings.updatePlexServer(targetServerId, (server) => ({
            ...server,
            libraries: newLibraries,
          }));
        }
      } else {
        settings.plex = {
          ...this.plexSettings,
          libraries: newLibraries,
        };
      }
    } catch (e) {
      logger.error('Failed to fetch Plex libraries', {
        label: 'Plex API',
        message: e.message,
      });

      if (targetServerId !== undefined) {
        const serverIndex = settings.plexServers.findIndex(
          (server) => server.id === targetServerId
        );

        if (serverIndex >= 0) {
          settings.updatePlexServer(targetServerId, (server) => ({
            ...server,
            libraries: [],
          }));
        }
      } else {
        settings.plex = {
          ...this.plexSettings,
          libraries: [],
        };
      }
    }

    await settings.save();
  }

  public async getLibraryContents(
    id: string,
    { offset = 0, size = 50 }: { offset?: number; size?: number } = {}
  ): Promise<{ totalSize: number; items: PlexLibraryItem[] }> {
    const response = await this.get<PlexLibraryResponse>(
      `/library/sections/${id}/all?includeGuids=1`,
      {
        headers: {
          'X-Plex-Container-Start': `${offset}`,
          'X-Plex-Container-Size': `${size}`,
        },
      }
    );

    return {
      totalSize: response.MediaContainer.totalSize,
      items: response.MediaContainer.Metadata ?? [],
    };
  }

  public async getMetadata(
    key: string,
    options: { includeChildren?: boolean } = {}
  ): Promise<PlexMetadata> {
    const response = await this.get<PlexMetadataResponse>(
      `/library/metadata/${key}${
        options.includeChildren ? '?includeChildren=1' : ''
      }`
    );

    return response.MediaContainer.Metadata[0];
  }

  public async getChildrenMetadata(key: string): Promise<PlexMetadata[]> {
    const response = await this.get<PlexMetadataResponse>(
      `/library/metadata/${key}/children`
    );

    return response.MediaContainer.Metadata;
  }

  public async getRecentlyAdded(
    id: string,
    options: { addedAt: number } = {
      addedAt: Date.now() - 1000 * 60 * 60,
    },
    mediaType: 'movie' | 'show'
  ): Promise<PlexLibraryItem[]> {
    const response = await this.get<PlexLibraryResponse>(
      `/library/sections/${id}/all?type=${
        mediaType === 'show' ? '4' : '1'
      }&sort=addedAt%3Adesc&addedAt>>=${Math.floor(options.addedAt / 1000)}`,
      {
        headers: {
          'X-Plex-Container-Start': '0',
          'X-Plex-Container-Size': '500',
        },
      }
    );

    return response.MediaContainer.Metadata;
  }
}

export default PlexAPI;

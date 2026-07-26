import ExternalAPI from '@server/api/externalapi';
import { ApiErrorCode } from '@server/constants/error';
import type { Library, PlexSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { ApiError } from '@server/types/error';

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

interface PlexLabelResponse {
  MediaContainer: {
    Metadata?: {
      librarySectionID?: number | string;
      Label?: {
        tag: string;
      }[];
    }[];
  };
}

class PlexAPI extends ExternalAPI {
  constructor({
    plexToken,
    plexSettings,
    timeout,
  }: {
    plexToken?: string | null;
    plexSettings?: PlexSettings;
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
  }

  public async getStatus(): Promise<PlexStatusResponse> {
    return await this.get('/');
  }

  public async getLibraries(): Promise<PlexLibrary[]> {
    const response = await this.get<PlexLibrariesResponse>('/library/sections');

    return response.MediaContainer.Directory;
  }

  public async syncLibraries(): Promise<void> {
    const settings = getSettings();

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
          const existing = settings.plex.libraries.find(
            (l) => l.id === library.key
          );

          return {
            id: library.key,
            name: library.title,
            enabled: existing?.enabled ?? false,
            type: library.type,
            lastScan: existing?.lastScan,
          };
        });

      settings.plex.libraries = newLibraries;
    } catch (e) {
      logger.error('Failed to fetch Plex libraries', {
        label: 'Plex API',
        message: e.message,
      });

      if (!e.response) {
        throw new ApiError(502, ApiErrorCode.ConnectionError);
      }

      throw new ApiError(e.response.status, ApiErrorCode.Unknown);
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

  /**
   * Returns the rating keys of every item in a library section carrying the
   * given label.
   *
   * Plex never returns labels in bulk library listings, whatever the requested
   * fields, but it does support filtering by label. Resolving one request per
   * label is therefore far cheaper than fetching metadata item by item.
   */
  public async getRatingKeysByLabel(
    sectionId: string,
    label: string
  ): Promise<string[]> {
    const ratingKeys: string[] = [];
    const size = 500;
    let offset = 0;
    let totalSize = 0;

    do {
      const response = await this.get<PlexLibraryResponse>(
        `/library/sections/${sectionId}/all?label=${encodeURIComponent(label)}`,
        {
          headers: {
            'X-Plex-Container-Start': `${offset}`,
            'X-Plex-Container-Size': `${size}`,
          },
        }
      );

      totalSize = response.MediaContainer.totalSize ?? 0;
      ratingKeys.push(
        ...(response.MediaContainer.Metadata ?? []).map(
          (item) => item.ratingKey
        )
      );
      offset += size;
    } while (offset < totalSize);

    return ratingKeys;
  }

  /**
   * Adds a label to a library item.
   *
   * Plex merges the labels sent with the ones already set, so the existing set
   * is never read back and replayed: two concurrent grants on the same item
   * cannot drop each other's label.
   */
  public async addLabel(
    ratingKey: string,
    type: 'movie' | 'show',
    label: string
  ): Promise<void> {
    const { sectionId, labels: existing } = await this.getItemLabels(ratingKey);

    if (!sectionId) {
      throw new Error(
        `Unable to resolve the library section of Plex item ${ratingKey}`
      );
    }

    if (existing.some((l) => l.toLowerCase() === label.toLowerCase())) {
      return;
    }

    const params = new URLSearchParams({
      type: type === 'show' ? '2' : '1',
      id: ratingKey,
      'label[0].tag.tag': label,
      'label.locked': '1',
    });

    await this.put(`/library/sections/${sectionId}/all?${params.toString()}`);
  }

  /**
   * Returns the labels currently set on a library item, along with the section
   * it belongs to, which is required to write labels back.
   */
  public async getItemLabels(
    ratingKey: string
  ): Promise<{ sectionId?: string; labels: string[] }> {
    const response = await this.get<PlexLabelResponse>(
      `/library/metadata/${ratingKey}`
    );

    const metadata = response.MediaContainer.Metadata?.[0];

    return {
      sectionId: metadata?.librarySectionID
        ? `${metadata.librarySectionID}`
        : undefined,
      labels: (metadata?.Label ?? []).map((label) => label.tag),
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
      `/library/sections/${id}/all?type=${mediaType === 'show' ? '4' : '1'}${
        // Shows are queried as episodes, whose guids the scanner never reads.
        mediaType === 'movie' ? '&includeGuids=1' : ''
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

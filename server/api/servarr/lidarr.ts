import logger from '@server/logger';
import ServarrBase from './base';

export interface LidarrImage {
  url: string;
  coverType: string;
}

export interface LidarrRating {
  votes: number;
  value: number;
}

export interface LidarrLink {
  url: string;
  name: string;
}

export interface LidarrAlbumOptions {
  [key: string]: unknown;
  title: string;
  disambiguation?: string;
  overview?: string;
  artistId: number;
  foreignAlbumId: string;
  monitored: boolean;
  anyReleaseOk: boolean;
  profileId: number;
  duration?: number;
  albumType: string;
  secondaryTypes: string[];
  mediumCount?: number;
  ratings?: LidarrRating;
  releaseDate?: string;
  releases: unknown[];
  genres: string[];
  media: unknown[];
  artist: {
    status: string;
    ended: boolean;
    artistName: string;
    foreignArtistId: string;
    tadbId?: number;
    discogsId?: number;
    overview?: string;
    artistType: string;
    disambiguation?: string;
    links: LidarrLink[];
    images: LidarrImage[];
    path: string;
    qualityProfileId: number;
    metadataProfileId: number;
    monitored: boolean;
    monitorNewItems: string;
    rootFolderPath: string;
    genres: string[];
    cleanName?: string;
    sortName?: string;
    tags: number[];
    added?: string;
    ratings?: LidarrRating;
    id: number;
  };
  images: LidarrImage[];
  links: LidarrLink[];
  addOptions: {
    searchForNewAlbum: boolean;
  };
}

export interface LidarrAlbum {
  id: number;
  mbId: string;
  title: string;
  monitored: boolean;
  artistId: number;
  foreignAlbumId: string;
  titleSlug: string;
  profileId: number;
  duration: number;
  albumType: string;
  statistics: {
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
}

export interface MetadataProfile {
  id: number;
  name: string;
}

class LidarrAPI extends ServarrBase<{ albumId: number }> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'lidarr', apiName: 'Lidarr' });
  }

  public getAlbums = async (): Promise<LidarrAlbum[]> => {
    try {
      const response = await this.axios.get<LidarrAlbum[]>('/album');

      return response.data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve albums: ${e.message}`, {
        cause: e,
      });
    }
  };

  public async getAlbumById(id: number): Promise<LidarrAlbum> {
    try {
      const response = await this.axios.get<LidarrAlbum>(`/album/${id}`);

      return response.data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve album by ID: ${e.message}`, {
        cause: e,
      });
    }
  }

  public async getAlbumByForeignAlbumId(mbid: string): Promise<LidarrAlbum> {
    try {
      const response = await this.axios.get<LidarrAlbum[]>('/album/lookup', {
        params: {
          term: `lidarr:${mbid}`,
        },
      });

      if (!response.data[0]) {
        throw new Error('Album not found');
      }

      return response.data[0];
    } catch (e) {
      logger.error('Error retrieving album by MusicBrainz ID', {
        label: 'Lidarr API',
        errorMessage: e.message,
        mbid,
      });
      throw new Error('Album not found', { cause: e });
    }
  }

  public async addAlbum(options: LidarrAlbumOptions): Promise<LidarrAlbum> {
    try {
      const album = await this.getAlbumByForeignAlbumId(options.foreignAlbumId);

      // If the album already exists in Lidarr, just update its monitored flag
      if (album.id) {
        const updatedAlbumResponse = await this.axios.put<LidarrAlbum>(
          `/album/${album.id}`,
          {
            ...album,
            monitored: options.monitored ?? album.monitored,
          }
        );

        if (updatedAlbumResponse.data.id) {
          logger.info('Updated existing album in Lidarr.', {
            label: 'Lidarr',
            albumId: updatedAlbumResponse.data.id,
            albumTitle: updatedAlbumResponse.data.title,
          });
          logger.debug('Lidarr update details', {
            label: 'Lidarr',
            album: updatedAlbumResponse.data,
          });

          if (options.addOptions?.searchForNewAlbum) {
            this.searchAlbum(updatedAlbumResponse.data.id);
          }

          return updatedAlbumResponse.data;
        } else {
          logger.error('Failed to update album in Lidarr', {
            label: 'Lidarr',
            options,
          });
          throw new Error('Failed to update album in Lidarr');
        }
      }

      const createdAlbumResponse = await this.axios.post<LidarrAlbum>(
        '/album',
        {
          ...options,
          monitored: options.monitored ?? true,
        }
      );

      if (createdAlbumResponse.data.id) {
        logger.info('Lidarr accepted request', { label: 'Lidarr' });
        logger.debug('Lidarr add details', {
          label: 'Lidarr',
          album: createdAlbumResponse.data,
        });
      } else {
        logger.error('Failed to add album to Lidarr', {
          label: 'Lidarr',
          options,
        });
        throw new Error('Failed to add album to Lidarr');
      }

      return createdAlbumResponse.data;
    } catch (e) {
      logger.error('Something went wrong while adding an album to Lidarr.', {
        label: 'Lidarr API',
        errorMessage: e.message,
        options,
        response: e?.response?.data,
      });
      throw new Error('Failed to add album', { cause: e });
    }
  }

  public removeAlbum = async (mbid: string): Promise<void> => {
    try {
      const { id, title } = await this.getAlbumByForeignAlbumId(mbid);
      await this.axios.delete(`/album/${id}`, {
        params: {
          deleteFiles: true,
          addImportExclusion: false,
        },
      });
      logger.info(`[Lidarr] Removed album ${title}`);
    } catch (e) {
      throw new Error(`[Lidarr] Failed to remove album: ${e.message}`, {
        cause: e,
      });
    }
  };

  public async searchAlbum(albumId: number): Promise<void> {
    logger.info('Executing album search command.', {
      label: 'Lidarr API',
      albumId,
    });

    try {
      await this.runCommand('AlbumSearch', { albumIds: [albumId] });
    } catch (e) {
      logger.error(
        'Something went wrong while executing Lidarr album search.',
        {
          label: 'Lidarr API',
          errorMessage: e.message,
          albumId,
        }
      );
    }
  }

  public async getMetadataProfiles(): Promise<MetadataProfile[]> {
    try {
      const data = await this.getRolling<MetadataProfile[]>(
        '/metadataprofile',
        undefined,
        3600
      );

      return data;
    } catch (e) {
      logger.error(
        'Something went wrong while retrieving Lidarr metadata profiles.',
        {
          label: 'Lidarr API',
          errorMessage: e.message,
        }
      );

      throw new Error('Failed to get metadata profiles', { cause: e });
    }
  }

  public clearCache = ({
    mbId,
    externalId,
    title,
  }: {
    mbId?: string | null;
    externalId?: number | null;
    title?: string | null;
  }) => {
    if (mbId) {
      this.removeCache('/album/lookup', {
        term: `lidarr:${mbId}`,
      });
    }
    if (externalId) {
      this.removeCache(`/album/${externalId}`);
    }
    if (title) {
      this.removeCache('/album/lookup', {
        term: title,
      });
    }
  };
}

export default LidarrAPI;

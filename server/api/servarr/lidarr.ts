import logger from '@server/logger';
import ServarrBase from './base';

interface LidarrMediaResult {
  id: number;
  mbId: string;
  media_type: string;
}

export interface LidarrArtistResult extends LidarrMediaResult {
  artist: {
    media_type: 'artist';
    artistName: string;
    overview: string;
    remotePoster?: string;
    artistType: string;
    genres: string[];
  };
}

export interface LidarrAlbumResult extends LidarrMediaResult {
  album: {
    media_type: 'music';
    title: string;
    foreignAlbumId: string;
    overview: string;
    releaseDate: string;
    albumType: string;
    genres: string[];
    images: LidarrImage[];
    artist: {
      artistName: string;
      overview: string;
    };
  };
}

export interface LidarrArtistDetails {
  id: number;
  foreignArtistId: string;
  status: string;
  ended: boolean;
  artistName: string;
  tadbId: number;
  discogsId: number;
  overview: string;
  artistType: string;
  disambiguation: string;
  links: LidarrLink[];
  nextAlbum: LidarrAlbumResult | null;
  lastAlbum: LidarrAlbumResult | null;
  images: LidarrImage[];
  qualityProfileId: number;
  profileId: number;
  metadataProfileId: number;
  monitored: boolean;
  monitorNewItems: string;
  genres: string[];
  tags: string[];
  added: string;
  ratings: LidarrRating;
  remotePoster?: string;
}

export interface LidarrAlbumDetails {
  id: number;
  mbId: string;
  foreignArtistId: string;
  hasFile: boolean;
  monitored: boolean;
  title: string;
  titleSlug: string;
  path: string;
  artistName: string;
  disambiguation: string;
  overview: string;
  artistId: number;
  foreignAlbumId: string;
  anyReleaseOk: boolean;
  profileId: number;
  qualityProfileId: number;
  duration: number;
  isAvailable: boolean;
  folderName: string;
  metadataProfileId: number;
  added: string;
  albumType: string;
  secondaryTypes: string[];
  mediumCount: number;
  ratings: LidarrRating;
  releaseDate: string;
  releases: {
    id: number;
    albumId: number;
    foreignReleaseId: string;
    title: string;
    status: string;
    duration: number;
    trackCount: number;
    media: any[];
    mediumCount: number;
    disambiguation: string;
    country: any[];
    label: any[];
    format: string;
    monitored: boolean;
  }[];
  genres: string[];
  media: {
    mediumNumber: number;
    mediumName: string;
    mediumFormat: string;
  }[];
  artist: LidarrArtistDetails & {
    artistName: string;
    nextAlbum: any | null;
    lastAlbum: any | null;
  };
  images: LidarrImage[];
  links: {
    url: string;
    name: string;
  }[];
  remoteCover?: string;
}

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

export interface LidarrRelease {
  id: number;
  albumId: number;
  foreignReleaseId: string;
  title: string;
  status: string;
  duration: number;
  trackCount: number;
  media: LidarrMedia[];
}

export interface LidarrMedia {
  mediumNumber: number;
  mediumFormat: string;
  mediumName: string;
}

export interface LidarrSearchResponse {
  page: number;
  total_results: number;
  total_pages: number;
  results: (LidarrArtistResult | LidarrAlbumResult)[];
}

export interface LidarrAlbumOptions {
  [key: string]: unknown;
  profileId: number;
  mbId: string;
  qualityProfileId: number;
  rootFolderPath: string;
  title: string;
  monitored: boolean;
  tags: string[];
  searchNow: boolean;
  artistId: number;
  artist: {
    id: number;
    foreignArtistId: string;
    artistName: string;
    qualityProfileId: number;
    metadataProfileId: number;
    rootFolderPath: string;
    monitored: boolean;
    monitorNewItems: string;
  };
}

export interface LidarrArtistOptions {
  [key: string]: unknown;
  artistName: string;
  qualityProfileId: number;
  profileId: number;
  rootFolderPath: string;
  foreignArtistId: string;
  monitored: boolean;
  tags: number[];
  searchNow: boolean;
  monitorNewItems: string;
  monitor: string;
  searchForMissingAlbums: boolean;
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

class LidarrAPI extends ServarrBase<{ albumId: number }> {
  protected apiKey: string;
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'lidarr', apiName: 'Lidarr' });
    this.apiKey = apiKey;
  }

  public async getAlbums(): Promise<LidarrAlbum[]> {
    try {
      const data = await this.get<LidarrAlbum[]>('/album');
      return data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve albums: ${e.message}`);
    }
  }

  public async getArtist({ id }: { id: number }): Promise<LidarrArtistDetails> {
    try {
      const data = await this.get<LidarrArtistDetails>(`/artist/${id}`);
      return data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve album: ${e.message}`);
    }
  }

  public async getAlbum({ id }: { id: number }): Promise<LidarrAlbum> {
    try {
      const data = await this.get<LidarrAlbum>(`/album/${id}`);
      return data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve album: ${e.message}`);
    }
  }

  public async getAlbumByMusicBrainzId(
    mbId: string
  ): Promise<LidarrAlbumDetails> {
    try {
      const data = await this.get<LidarrAlbumDetails[]>('/album/lookup', {
        term: `lidarr:${mbId}`,
      });

      if (!data[0]) {
        throw new Error('Album not found');
      }

      return data[0];
    } catch (e) {
      logger.error('Error retrieving album by foreign ID', {
        label: 'Lidarr API',
        errorMessage: e.message,
        mbId: mbId,
      });
      throw new Error('Album not found');
    }
  }

  public async removeAlbum(albumId: number): Promise<void> {
    try {
      await this.delete(`/album/${albumId}`, {
        deleteFiles: 'true',
        addImportExclusion: 'false',
      });
      logger.info(`[Lidarr] Removed album ${albumId}`);
    } catch (e) {
      throw new Error(`[Lidarr] Failed to remove album: ${e.message}`);
    }
  }

  public async getArtistByMusicBrainzId(
    mbId: string
  ): Promise<LidarrArtistDetails> {
    try {
      const data = await this.get<LidarrArtistDetails[]>('/artist/lookup', {
        term: `lidarr:${mbId}`,
      });

      if (!data[0]) {
        throw new Error('Artist not found');
      }

      return data[0];
    } catch (e) {
      logger.error('Error retrieving artist by foreign ID', {
        label: 'Lidarr API',
        errorMessage: e.message,
        mbId: mbId,
      });
      throw new Error('Artist not found');
    }
  }

  public async addAlbum(
    options: LidarrAlbumOptions
  ): Promise<LidarrAlbumDetails> {
    try {
      const data = await this.post<LidarrAlbumDetails>('/album', options);
      return data;
    } catch (e) {
      if (e.message.includes('This album has already been added')) {
        logger.info('Album already exists in Lidarr, monitoring it in Lidarr', {
          label: 'Lidarr',
          albumTitle: options.title,
          mbId: options.mbId,
        });
        throw e;
      }

      logger.error('Failed to add album to Lidarr', {
        label: 'Lidarr',
        options,
        errorMessage: e.message,
      });
      throw new Error(`[Lidarr] Failed to add album: ${e.message}`);
    }
  }

  public async addArtist(
    options: LidarrArtistOptions
  ): Promise<LidarrArtistDetails> {
    try {
      const data = await this.post<LidarrArtistDetails>('/artist', options);
      return data;
    } catch (e) {
      logger.error('Failed to add artist to Lidarr', {
        label: 'Lidarr',
        options,
        errorMessage: e.message,
      });
      throw new Error(`[Lidarr] Failed to add artist: ${e.message}`);
    }
  }

  public async searchMulti(searchTerm: string): Promise<LidarrSearchResponse> {
    try {
      const data = await this.get<
        {
          foreignId: string;
          artist?: {
            artistName: string;
            overview?: string;
            remotePoster?: string;
            artistType?: string;
            genres: string[];
            foreignArtistId: string;
          };
          album?: {
            title: string;
            foreignAlbumId: string;
            overview?: string;
            releaseDate?: string;
            albumType: string;
            genres: string[];
            images: LidarrImage[];
            artist: {
              artistName: string;
              overview?: string;
            };
            remoteCover?: string;
          };
          id: number;
        }[]
      >(
        '/search',
        {
          term: searchTerm,
        },
        undefined,
        {
          headers: {
            'X-Api-Key': this.apiKey,
          },
        }
      );

      if (!data) {
        throw new Error('No data received from Lidarr');
      }

      const results = data.map((item) => {
        if (item.album) {
          return {
            id: item.id,
            mbId: item.album.foreignAlbumId,
            media_type: 'music' as const,
            album: {
              media_type: 'music' as const,
              title: item.album.title,
              foreignAlbumId: item.album.foreignAlbumId,
              overview: item.album.overview || '',
              releaseDate: item.album.releaseDate || '',
              albumType: item.album.albumType,
              genres: item.album.genres,
              images: item.album.remoteCover
                ? [
                    {
                      url: item.album.remoteCover,
                      coverType: 'cover',
                    },
                  ]
                : item.album.images,
              artist: {
                artistName: item.album.artist.artistName,
                overview: item.album.artist.overview || '',
              },
            },
          } satisfies LidarrAlbumResult;
        }

        if (item.artist) {
          return {
            id: item.id,
            mbId: item.artist.foreignArtistId,
            media_type: 'artist' as const,
            artist: {
              media_type: 'artist' as const,
              artistName: item.artist.artistName,
              overview: item.artist.overview || '',
              remotePoster: item.artist.remotePoster,
              artistType: item.artist.artistType || '',
              genres: item.artist.genres,
            },
          } satisfies LidarrArtistResult;
        }

        throw new Error('Invalid search result type');
      });

      return {
        page: 1,
        total_pages: 1,
        total_results: results.length,
        results,
      };
    } catch (e) {
      logger.error('Failed to search Lidarr', {
        label: 'Lidarr API',
        errorMessage: e.message,
      });
      throw new Error(`[Lidarr] Failed to search: ${e.message}`);
    }
  }

  public async updateArtist(
    artist: LidarrArtistDetails
  ): Promise<LidarrArtistDetails> {
    try {
      const data = await this.put<LidarrArtistDetails>(`/artist/${artist.id}`, {
        ...artist,
      } as Record<string, unknown>);
      return data;
    } catch (e) {
      logger.error('Failed to update artist in Lidarr', {
        label: 'Lidarr',
        artistId: artist.id,
        errorMessage: e.message,
      });
      throw new Error(`[Lidarr] Failed to update artist: ${e.message}`);
    }
  }

  public async updateAlbum(album: LidarrAlbum): Promise<LidarrAlbumDetails> {
    try {
      const data = await this.put<LidarrAlbumDetails>(`/album/${album.id}`, {
        ...album,
      } as Record<string, unknown>);
      return data;
    } catch (e) {
      logger.error('Failed to update album in Lidarr', {
        label: 'Lidarr',
        albumId: album.id,
        errorMessage: e.message,
      });
      throw new Error(`[Lidarr] Failed to update album: ${e.message}`);
    }
  }

  public async searchAlbum(albumId: number): Promise<void> {
    logger.info('Executing album search command', {
      label: 'Lidarr API',
      albumId,
    });

    try {
      await this.post('/command', {
        name: 'AlbumSearch',
        albumIds: [albumId],
      });
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
}

export default LidarrAPI;

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
    disambiguation: string;
    duration: number;
    mediumCount: number;
    ratings: LidarrRating | undefined;
    links: never[];
    media_type: 'music';
    title: string;
    foreignAlbumId: string;
    overview: string;
    releaseDate: string;
    albumType: string;
    genres: string[];
    images: LidarrImage[];
    artist: {
      id: number;
      status: string;
      ended: boolean;
      foreignArtistId: string;
      tadbId: number;
      discogsId: number;
      artistType: string;
      disambiguation: string | undefined;
      links: never[];
      images: never[];
      genres: never[];
      cleanName: string | undefined;
      sortName: string | undefined;
      tags: never[];
      added: string;
      ratings: LidarrRating | undefined;
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
  cleanName?: string;
  sortName?: string;
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
  releases: any[];
  genres: string[];
  media: any[];
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

export interface SearchCommand extends Record<string, unknown> {
  name: 'AlbumSearch';
  albumIds: number[];
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

  public async getAlbum({ id }: { id: number }): Promise<LidarrAlbum> {
    try {
      const data = await this.get<LidarrAlbum>(`/album/${id}`);
      return data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve album: ${e.message}`);
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

  public async searchAlbum(mbid: string): Promise<LidarrAlbumResult[]> {
    try {
      const data = await this.get<LidarrAlbumResult[]>(`/search`, {
        term: `lidarr:${mbid}`,
      });
      return data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to search album: ${e.message}`);
    }
  }

  public async addAlbum(options: LidarrAlbumOptions): Promise<LidarrAlbum> {
    try {
      const existingAlbums = await this.get<LidarrAlbum[]>('/album', {
        foreignAlbumId: options.foreignAlbumId,
        includeAllArtistAlbums: 'true',
      });

      if (existingAlbums.length > 0 && existingAlbums[0].monitored) {
        logger.info(
          'Album is already monitored in Lidarr. Skipping add and returning success',
          {
            label: 'Lidarr',
          }
        );
        return existingAlbums[0];
      }

      const data = await this.post<LidarrAlbum>('/album', {
        ...options,
        monitored: true,
      });
      return data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to add album: ${e.message}`);
    }
  }

  public async searchAlbumByMusicBrainzId(
    mbid: string
  ): Promise<LidarrAlbumResult[]> {
    try {
      const data = await this.get<LidarrAlbumResult[]>('/search', {
        term: `lidarr:${mbid}`,
      });
      return data;
    } catch (e) {
      throw new Error(
        `[Lidarr] Failed to search album by MusicBrainz ID: ${e.message}`
      );
    }
  }

  public async searchOnAdd(albumId: number): Promise<void> {
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

import logger from '@server/logger';
import axios from 'axios';
import fs, { promises as fsp } from 'fs';
import path from 'path';
import xml2js from 'xml2js';

const UPDATE_INTERVAL_MSEC = 24 * 3600 * 1000; // how often to download new mapping in milliseconds
// originally at https://raw.githubusercontent.com/ScudLee/anime-lists/master/anime-list.xml
const MAPPING_URL =
  'https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list.xml';
const LOCAL_PATH = process.env.CONFIG_DIRECTORY
  ? `${process.env.CONFIG_DIRECTORY}/anime-list.xml`
  : path.join(__dirname, '../../config/anime-list.xml');

const mappingRegexp = new RegExp(/;[0-9]+-([0-9]+)/g);

// Anime-List xml files are community maintained mappings that Hama agent uses to map AniDB IDs to TVDB/TMDB IDs
// https://github.com/Anime-Lists/anime-lists/

interface AnimeMapping {
  $: {
    anidbseason: string;
    tvdbseason: string;
  };
  _: string;
}

interface Anime {
  $: {
    anidbid: number;
    tvdbid?: string;
    defaulttvdbseason?: string;
    tmdbid?: number;
    imdbid?: string;
  };
  'mapping-list'?: {
    mapping: AnimeMapping[];
  }[];
}

interface AnimeList {
  'anime-list': {
    anime: Anime[];
  };
}

export interface AnidbItem {
  tvdbId?: number;
  tmdbId?: number;
  imdbId?: string;
}

class AnimeListMapping {
  private syncing = false;

  private mapping: { [anidbId: number]: AnidbItem } = {};

  // mapping file modification date when it was loaded
  private mappingModified: Date | null = null;

  // each episode in season 0 from TVDB can map to movie
  private specials: { [tvdbId: number]: { [episode: number]: AnidbItem } } = {};

  public isLoaded = () => Object.keys(this.mapping).length !== 0;

  private loadFromFile = async () => {
    logger.info('Loading mapping file', { label: 'Anime-List Sync' });
    try {
      const mappingStat = await fsp.stat(LOCAL_PATH);
      const file = await fsp.readFile(LOCAL_PATH);
      const xml = (await xml2js.parseStringPromise(file)) as AnimeList;

      this.mapping = {};
      this.specials = {};
      for (const anime of xml['anime-list'].anime) {
        // tvdbId can be nonnumber, like 'movie' string
        let tvdbId: number | undefined;
        if (anime.$.tvdbid && !isNaN(Number(anime.$.tvdbid))) {
          tvdbId = Number(anime.$.tvdbid);
        } else {
          tvdbId = undefined;
        }

        let imdbIds: (string | undefined)[];
        if (anime.$.imdbid) {
          // if there are multiple imdb entries, then they map to different movies
          imdbIds = anime.$.imdbid.split(',');
        } else {
          // in case there is no imdbid, that's ok as there will be tmdbid
          imdbIds = [undefined];
        }

        const tmdbId = anime.$.tmdbid ? Number(anime.$.tmdbid) : undefined;
        const anidbId = Number(anime.$.anidbid);
        this.mapping[anidbId] = {
          // for season 0 ignore tvdbid, because this must be movie/OVA
          tvdbId: anime.$.defaulttvdbseason === '0' ? undefined : tvdbId,
          tmdbId: tmdbId,
          imdbId: imdbIds[0], // this is used for one AniDB -> one imdb movie mapping
        };

        if (tvdbId) {
          const mappingList = anime['mapping-list'];
          if (mappingList && mappingList.length != 0) {
            let imdbIndex = 0;
            for (const mapping of mappingList[0].mapping) {
              const text = mapping._;
              if (text && mapping.$.tvdbseason === '0') {
                let matches;
                while ((matches = mappingRegexp.exec(text)) !== null) {
                  const episode = Number(matches[1]);
                  if (!this.specials[tvdbId]) {
                    this.specials[tvdbId] = {};
                  }
                  // map next available imdbid to episode in s0
                  const imdbId =
                    imdbIndex > imdbIds.length ? undefined : imdbIds[imdbIndex];
                  if (tmdbId || imdbId) {
                    this.specials[tvdbId][episode] = {
                      tmdbId: tmdbId,
                      imdbId: imdbId,
                    };
                    imdbIndex++;
                  }
                }
              }
            }
          } else {
            // some movies do not have mapping-list, so map episode 1,2,3,..to movies
            // movies must have imdbId or tmdbId
            const hasImdb = imdbIds.length > 1 || imdbIds[0] !== undefined;
            if ((hasImdb || tmdbId) && anime.$.defaulttvdbseason === '0') {
              if (!this.specials[tvdbId]) {
                this.specials[tvdbId] = {};
              }
              // map each imdbid to episode in s0, episode index starts with 1
              for (let idx = 0; idx < imdbIds.length; idx++) {
                this.specials[tvdbId][idx + 1] = {
                  tmdbId: tmdbId,
                  imdbId: imdbIds[idx],
                };
              }
            }
          }
        }
      }
      this.mappingModified = mappingStat.mtime;
      logger.info(
        `Loaded ${
          Object.keys(this.mapping).length
        } AniDB items from mapping file`,
        { label: 'Anime-List Sync' }
      );
    } catch (e) {
      throw new Error(`Failed to load Anime-List mappings: ${e.message}`);
    }
  };

  private downloadFile = async () => {
    logger.info('Downloading latest mapping file', {
      label: 'Anime-List Sync',
    });
    try {
      const response = await axios.get(MAPPING_URL, {
        responseType: 'stream',
      });
      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(LOCAL_PATH);
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.pipe(writer);
      });
    } catch (e) {
      throw new Error(`Failed to download Anime-List mapping: ${e.message}`);
    }
  };

  public sync = async () => {
    // make sure only one sync runs at a time
    if (this.syncing) {
      return;
    }

    this.syncing = true;
    try {
      // check if local file is not "expired" yet
      if (fs.existsSync(LOCAL_PATH)) {
        const now = new Date();
        const stat = await fsp.stat(LOCAL_PATH);
        if (now.getTime() - stat.mtime.getTime() < UPDATE_INTERVAL_MSEC) {
          if (!this.isLoaded()) {
            // no need to download, but make sure file is loaded
            await this.loadFromFile();
          } else if (
            this.mappingModified &&
            stat.mtime.getTime() > this.mappingModified.getTime()
          ) {
            // if file has been modified externally since last load, reload it
            await this.loadFromFile();
          }
          return;
        }
      }
      await this.downloadFile();
      await this.loadFromFile();
    } finally {
      this.syncing = false;
    }
  };

  public getFromAnidbId = (anidbId: number): AnidbItem | undefined => {
    return this.mapping[anidbId];
  };

  public getSpecialEpisode = (
    tvdbId: number,
    episode: number
  ): AnidbItem | undefined => {
    const episodes = this.specials[tvdbId];
    return episodes ? episodes[episode] : undefined;
  };
}

const animeList = new AnimeListMapping();

export default animeList;

import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';

type IMDBRadarrProxyResponse = IMDBMovie[];

interface IMDBMovie {
  ImdbId: string;
  Overview: string;
  Title: string;
  OriginalTitle: string;
  TitleSlug: string;
  Ratings: Rating[];
  MovieRatings: MovieRatings;
  Runtime: number;
  Images: Image[];
  Genres: string[];
  Popularity: number;
  Premier: string;
  InCinema: string;
  PhysicalRelease: any;
  DigitalRelease: string;
  Year: number;
  AlternativeTitles: AlternativeTitle[];
  Translations: Translation[];
  Recommendations: Recommendation[];
  Credits: Credits;
  Studio: string;
  YoutubeTrailerId: string;
  Certifications: Certification[];
  Status: any;
  Collection: Collection;
  OriginalLanguage: string;
  Homepage: string;
  TmdbId: number;
}

interface Rating {
  Count: number;
  Value: number;
  Origin: string;
  Type: string;
}

interface MovieRatings {
  Tmdb: Tmdb;
  Imdb: Imdb;
  Metacritic: Metacritic;
  RottenTomatoes: RottenTomatoes;
}

interface Tmdb {
  Count: number;
  Value: number;
  Type: string;
}

interface Imdb {
  Count: number;
  Value: number;
  Type: string;
}

interface Metacritic {
  Count: number;
  Value: number;
  Type: string;
}

interface RottenTomatoes {
  Count: number;
  Value: number;
  Type: string;
}

interface Image {
  CoverType: string;
  Url: string;
}

interface AlternativeTitle {
  Title: string;
  Type: string;
  Language: string;
}

interface Translation {
  Title: string;
  Overview: string;
  Language: string;
}

interface Recommendation {
  TmdbId: number;
  Title: string;
}

interface Credits {
  Cast: Cast[];
  Crew: Crew[];
}

interface Cast {
  Name: string;
  Order: number;
  Character: string;
  TmdbId: number;
  CreditId: string;
  Images: Image2[];
}

interface Image2 {
  CoverType: string;
  Url: string;
}

interface Crew {
  Name: string;
  Job: string;
  Department: string;
  TmdbId: number;
  CreditId: string;
  Images: Image3[];
}

interface Image3 {
  CoverType: string;
  Url: string;
}

interface Certification {
  Country: string;
  Certification: string;
}

interface Collection {
  Name: string;
  Images: any;
  Overview: any;
  Translations: any;
  Parts: any;
  TmdbId: number;
}

export interface IMDBRating {
  title: string;
  url: string;
  criticsScore: number;
  criticsScoreCount: number;
}

/**
 * This is a best-effort API. The IMDB API is technically
 * private and getting access costs money/requires approval.
 *
 * Radarr hosts a public proxy that's in use by all Radarr instances.
 */
class IMDBRadarrProxy extends ExternalAPI {
  constructor() {
    super('https://api.radarr.video/v1', {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      nodeCache: cacheManager.getCache('imdb').data,
    });
  }

  /**
   * Ask the Radarr IMDB Proxy for the movie
   *
   * @param IMDBid Id of IMDB movie
   */
  public async getMovieRatings(IMDBid: string): Promise<IMDBRating | null> {
    try {
      const data = await this.get<IMDBRadarrProxyResponse>(
        `/movie/imdb/${IMDBid}`
      );

      if (
        !data?.length ||
        data[0].ImdbId !== IMDBid ||
        !data[0].MovieRatings.Imdb
      ) {
        return null;
      }

      return {
        title: data[0].Title,
        url: `https://www.imdb.com/title/${data[0].ImdbId}`,
        criticsScore: data[0].MovieRatings.Imdb.Value,
        criticsScoreCount: data[0].MovieRatings.Imdb.Count,
      };
    } catch (e) {
      throw new Error(
        `[IMDB RADARR PROXY API] Failed to retrieve movie ratings: ${e.message}`
      );
    }
  }
}

export default IMDBRadarrProxy;

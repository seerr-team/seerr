import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMetadataProvider } from '@server/api/metadata';
import TheMovieDb from '@server/api/themoviedb';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type { TmdbKeyword } from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { mapCollection } from '@server/models/Collection';
import { mapMovieDetails } from '@server/models/Movie';
import {
  mapCastCredits,
  mapCrewCredits,
  mapPersonDetails,
} from '@server/models/Person';
import { mapTvDetails } from '@server/models/Tv';

export function registerMediaDetailResources(server: McpServer): void {
  // Movie details resource
  server.registerResource(
    'movie_details',
    new ResourceTemplate('seerr://movie/{tmdbId}', { list: undefined }),
    {
      description: 'Get detailed information about a movie by its TMDB ID.',
      mimeType: 'application/json',
    },
    async (uri, { tmdbId }) => {
      try {
        const tmdb = new TheMovieDb();
        const movieId = Number(tmdbId);

        const tmdbMovie = await tmdb.getMovie({ movieId });
        const media = await Media.getMedia(tmdbMovie.id, MediaType.MOVIE);
        const data = mapMovieDetails(tmdbMovie, media ?? undefined);

        if (!data.overview) {
          const movieEnglish = await tmdb.getMovie({ movieId });
          data.overview = movieEnglish.overview;
        }

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP movie resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
          tmdbId,
        });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: (e as Error).message }),
            },
          ],
        };
      }
    }
  );

  // TV show details resource
  server.registerResource(
    'tv_details',
    new ResourceTemplate('seerr://tv/{tmdbId}', { list: undefined }),
    {
      description:
        'Get detailed information about a TV show by its TMDB ID. Automatically detects anime for enhanced metadata.',
      mimeType: 'application/json',
    },
    async (uri, { tmdbId }) => {
      try {
        const tmdb = new TheMovieDb();
        const tvId = Number(tmdbId);

        const tmdbTv = await tmdb.getTvShow({ tvId });
        const metadataProvider = tmdbTv.keywords.results.some(
          (keyword: TmdbKeyword) => keyword.id === ANIME_KEYWORD_ID
        )
          ? await getMetadataProvider('anime')
          : await getMetadataProvider('tv');

        const tv = await metadataProvider.getTvShow({ tvId });
        const media = await Media.getMedia(tv.id, MediaType.TV);
        const data = mapTvDetails(tv, media ?? undefined);

        if (!data.overview) {
          const tvEnglish = await metadataProvider.getTvShow({ tvId });
          data.overview = tvEnglish.overview;
        }

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP tv resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
          tmdbId,
        });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: (e as Error).message }),
            },
          ],
        };
      }
    }
  );

  // Person details resource
  server.registerResource(
    'person_details',
    new ResourceTemplate('seerr://person/{tmdbId}', { list: undefined }),
    {
      description:
        'Get detailed information about a person (actor, director, etc.) by their TMDB ID, including combined credits.',
      mimeType: 'application/json',
    },
    async (uri, { tmdbId }) => {
      try {
        const tmdb = new TheMovieDb();
        const personId = Number(tmdbId);

        const [person, combinedCredits] = await Promise.all([
          tmdb.getPerson({ personId }),
          tmdb.getPersonCombinedCredits({ personId }),
        ]);

        const castMedia = await Media.getRelatedMedia(
          undefined,
          combinedCredits.cast.map((result) => result.id)
        );
        const crewMedia = await Media.getRelatedMedia(
          undefined,
          combinedCredits.crew.map((result) => result.id)
        );

        const data = {
          ...mapPersonDetails(person),
          combinedCredits: {
            cast: combinedCredits.cast.map((result) =>
              mapCastCredits(
                result,
                castMedia.find((m) => m.tmdbId === result.id)
              )
            ),
            crew: combinedCredits.crew.map((result) =>
              mapCrewCredits(
                result,
                crewMedia.find((m) => m.tmdbId === result.id)
              )
            ),
          },
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP person resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
          tmdbId,
        });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: (e as Error).message }),
            },
          ],
        };
      }
    }
  );

  // Collection details resource
  server.registerResource(
    'collection_details',
    new ResourceTemplate('seerr://collection/{collectionId}', {
      list: undefined,
    }),
    {
      description:
        'Get details about a movie collection (e.g. a franchise) by its TMDB collection ID.',
      mimeType: 'application/json',
    },
    async (uri, { collectionId }) => {
      try {
        const tmdb = new TheMovieDb();
        const collection = await tmdb.getCollection({
          collectionId: Number(collectionId),
        });

        const media = await Media.getRelatedMedia(
          undefined,
          collection.parts.map((part) => part.id)
        );

        const data = mapCollection(collection, media);

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP collection resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
          collectionId,
        });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: (e as Error).message }),
            },
          ],
        };
      }
    }
  );
}

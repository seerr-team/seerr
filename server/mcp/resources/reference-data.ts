import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import TheMovieDb from '@server/api/themoviedb';
import logger from '@server/logger';

export function registerReferenceDataResources(server: McpServer): void {
  // Movie genres
  server.registerResource(
    'movie_genres',
    'seerr://genres/movie',
    {
      description: 'List of all movie genres from TMDB.',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const tmdb = new TheMovieDb();
        const genres = await tmdb.getMovieGenres();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(genres, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP movie_genres resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
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

  // TV genres
  server.registerResource(
    'tv_genres',
    'seerr://genres/tv',
    {
      description: 'List of all TV show genres from TMDB.',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const tmdb = new TheMovieDb();
        const genres = await tmdb.getTvGenres();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(genres, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP tv_genres resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
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

  // Languages
  server.registerResource(
    'languages',
    'seerr://languages',
    {
      description: 'List of all available languages from TMDB.',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const tmdb = new TheMovieDb();
        const languages = await tmdb.getLanguages();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(languages, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP languages resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
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

  // Regions
  server.registerResource(
    'regions',
    'seerr://regions',
    {
      description: 'List of all available regions/countries from TMDB.',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const tmdb = new TheMovieDb();
        const regions = await tmdb.getRegions();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(regions, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP regions resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
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

  // Movie certifications
  server.registerResource(
    'movie_certifications',
    'seerr://certifications/movie',
    {
      description: 'Movie content ratings/certifications by country.',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const tmdb = new TheMovieDb();
        const certifications = await tmdb.getMovieCertifications();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(certifications, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP movie_certifications resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
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

  // TV certifications
  server.registerResource(
    'tv_certifications',
    'seerr://certifications/tv',
    {
      description: 'TV content ratings/certifications by country.',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const tmdb = new TheMovieDb();
        const certifications = await tmdb.getTvCertifications();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(certifications, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP tv_certifications resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
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

  // Movie watch providers (by region)
  server.registerResource(
    'movie_watch_providers',
    new ResourceTemplate('seerr://watchproviders/movies/{region}', {
      list: undefined,
    }),
    {
      description:
        'Movie streaming/watch providers for a specific region (ISO 3166-1 code).',
      mimeType: 'application/json',
    },
    async (uri, { region }) => {
      try {
        const tmdb = new TheMovieDb();
        const providers = await tmdb.getMovieWatchProviders({
          watchRegion: region as string,
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(providers, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP movie_watch_providers resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
          region,
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

  // TV watch providers (by region)
  server.registerResource(
    'tv_watch_providers',
    new ResourceTemplate('seerr://watchproviders/tv/{region}', {
      list: undefined,
    }),
    {
      description:
        'TV streaming/watch providers for a specific region (ISO 3166-1 code).',
      mimeType: 'application/json',
    },
    async (uri, { region }) => {
      try {
        const tmdb = new TheMovieDb();
        const providers = await tmdb.getTvWatchProviders({
          watchRegion: region as string,
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(providers, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP tv_watch_providers resource failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
          region,
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

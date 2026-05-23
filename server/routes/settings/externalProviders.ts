import { getRepository } from '@server/datasource';
import ExternalProvider, {
  ExternalProviderAuthType,
  ExternalProviderIdType,
  ExternalProviderMediaType,
} from '@server/entity/ExternalProvider';
import { testExternalDiscoverProvider } from '@server/lib/externalDiscover';
import logger from '@server/logger';
import { Router } from 'express';

const externalProviderRoutes = Router();

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
};

const toNumber = (value: unknown, fallback: number): number => {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
};

/**
 * Providers
 */

externalProviderRoutes.post('/providers/test', async (req, res, next) => {
  try {
    const result = await testExternalDiscoverProvider({
      url: req.body.url,
      authType: req.body.authType,
      apiKey: req.body.apiKey,
      apiKeyHeader: req.body.apiKeyHeader,
      bearerToken: req.body.bearerToken,
      idType: req.body.idType,
      mediaType: req.body.mediaType,
      itemsPath: req.body.itemsPath,
      tmdbIdPath: req.body.tmdbIdPath,
      tvdbIdPath: req.body.tvdbIdPath,
      mediaTypePath: req.body.mediaTypePath,
      defaultMediaType: req.body.defaultMediaType,
    });

    if (!result.ok) {
      return next({
        status: 400,
        message:
          'Connection worked, but no valid TMDB or TVDB items could be detected.',
      });
    }

    return res.status(200).json(result);
  } catch (e) {
    logger.error('Something went wrong testing external provider.', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 500,
      message: 'Unable to connect to external provider.',
    });
  }
});

externalProviderRoutes.get('/providers', async (_req, res) => {
  const providerRepository = getRepository(ExternalProvider);

  const providers = await providerRepository.find({
    order: {
      id: 'ASC',
    },
  });

  return res.status(200).json(providers);
});

externalProviderRoutes.get('/providers/:providerId', async (req, res, next) => {
  const providerRepository = getRepository(ExternalProvider);

  try {
    const provider = await providerRepository.findOneOrFail({
      where: {
        id: Number(req.params.providerId),
      },
    });

    return res.status(200).json(provider);
  } catch (e) {
    logger.error('External provider not found.', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 404,
      message: 'External provider not found.',
    });
  }
});

externalProviderRoutes.post('/providers', async (req, res, next) => {
  const providerRepository = getRepository(ExternalProvider);

  try {
    const provider = new ExternalProvider({
      name: req.body.name,
      url: req.body.url,

      authType: req.body.authType ?? ExternalProviderAuthType.NONE,
      apiKey: req.body.apiKey || null,
      apiKeyHeader: req.body.apiKeyHeader || null,
      bearerToken: req.body.bearerToken || null,

      cacheMinutes: toNumber(req.body.cacheMinutes, 60),

      idType: req.body.idType ?? ExternalProviderIdType.TMDB,
      mediaType: req.body.mediaType ?? ExternalProviderMediaType.MIXED,

      itemsPath: req.body.itemsPath || null,
      tmdbIdPath: req.body.tmdbIdPath || null,
      tvdbIdPath: req.body.tvdbIdPath || null,
      mediaTypePath: req.body.mediaTypePath || null,
      defaultMediaType: req.body.defaultMediaType || null,

      enabled: toBoolean(req.body.enabled, true),
    });

    if (!provider.name || !provider.url) {
      return next({
        status: 400,
        message: 'Name and URL are required.',
      });
    }

    const savedProvider = await providerRepository.save(provider);

    return res.status(201).json(savedProvider);
  } catch (e) {
    logger.error('Something went wrong creating an external provider.', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 500,
      message: 'Unable to create external provider.',
    });
  }
});

externalProviderRoutes.put('/providers/:providerId', async (req, res, next) => {
  const providerRepository = getRepository(ExternalProvider);

  try {
    const provider = await providerRepository.findOneOrFail({
      where: {
        id: Number(req.params.providerId),
      },
    });

    provider.name = req.body.name ?? provider.name;
    provider.url = req.body.url ?? provider.url;

    provider.authType = req.body.authType ?? provider.authType;
    provider.apiKey = req.body.apiKey ?? provider.apiKey;
    provider.apiKeyHeader = req.body.apiKeyHeader ?? provider.apiKeyHeader;
    provider.bearerToken = req.body.bearerToken ?? provider.bearerToken;

    provider.cacheMinutes =
      req.body.cacheMinutes !== undefined
        ? toNumber(req.body.cacheMinutes, provider.cacheMinutes)
        : provider.cacheMinutes;

    provider.idType = req.body.idType ?? provider.idType;
    provider.mediaType = req.body.mediaType ?? provider.mediaType;

    provider.itemsPath = req.body.itemsPath ?? provider.itemsPath;
    provider.tmdbIdPath = req.body.tmdbIdPath ?? provider.tmdbIdPath;
    provider.tvdbIdPath = req.body.tvdbIdPath ?? provider.tvdbIdPath;
    provider.mediaTypePath = req.body.mediaTypePath ?? provider.mediaTypePath;
    provider.defaultMediaType =
      req.body.defaultMediaType ?? provider.defaultMediaType;

    provider.enabled = toBoolean(req.body.enabled, provider.enabled);

    const savedProvider = await providerRepository.save(provider);

    return res.status(200).json(savedProvider);
  } catch (e) {
    logger.error('Something went wrong updating an external provider.', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 404,
      message: 'External provider not found or cannot be updated.',
    });
  }
});

externalProviderRoutes.delete(
  '/providers/:providerId',
  async (req, res, next) => {
    const providerRepository = getRepository(ExternalProvider);

    try {
      const provider = await providerRepository.findOneOrFail({
        where: {
          id: Number(req.params.providerId),
        },
      });

      await providerRepository.remove(provider);

      return res.status(204).send();
    } catch (e) {
      logger.error('Something went wrong deleting an external provider.', {
        label: 'API',
        errorMessage: e instanceof Error ? e.message : String(e),
      });

      return next({
        status: 404,
        message: 'External provider not found or cannot be deleted.',
      });
    }
  }
);

export default externalProviderRoutes;

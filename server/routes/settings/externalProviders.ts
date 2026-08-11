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

const toPositiveInteger = (value: unknown): number | null => {
  const numberValue = Number(value);

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const hasBodyProperty = (body: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(body, key);

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue !== '' ? trimmedValue : null;
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

externalProviderRoutes.get('/providers', async (_req, res, next) => {
  const providerRepository = getRepository(ExternalProvider);

  try {
    const providers = await providerRepository.find({
      order: {
        id: 'ASC',
      },
    });

    return res.status(200).json(providers);
  } catch (e) {
    logger.error('Something went wrong retrieving external providers.', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 500,
      message: 'Unable to retrieve external providers.',
    });
  }
});

externalProviderRoutes.get('/providers/:providerId', async (req, res, next) => {
  const providerRepository = getRepository(ExternalProvider);
  const providerId = toPositiveInteger(req.params.providerId);

  if (!providerId) {
    return next({
      status: 400,
      message: 'Invalid external provider ID.',
    });
  }

  try {
    const provider = await providerRepository.findOne({
      where: {
        id: providerId,
      },
    });

    if (!provider) {
      return next({
        status: 404,
        message: 'External provider not found.',
      });
    }

    return res.status(200).json(provider);
  } catch (e) {
    logger.error('Something went wrong retrieving an external provider.', {
      label: 'API',
      providerId,
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 500,
      message: 'Unable to retrieve external provider.',
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
  const providerId = toPositiveInteger(req.params.providerId);
  const body = req.body as Record<string, unknown>;

  if (!providerId) {
    return next({
      status: 400,
      message: 'Invalid external provider ID.',
    });
  }

  try {
    const provider = await providerRepository.findOne({
      where: {
        id: providerId,
      },
    });

    if (!provider) {
      return next({
        status: 404,
        message: 'External provider not found.',
      });
    }

    provider.name = req.body.name ?? provider.name;
    provider.url = req.body.url ?? provider.url;

    provider.authType = req.body.authType ?? provider.authType;

    if (hasBodyProperty(body, 'apiKey')) {
      provider.apiKey = toNullableString(req.body.apiKey);
    }

    if (hasBodyProperty(body, 'apiKeyHeader')) {
      provider.apiKeyHeader = toNullableString(req.body.apiKeyHeader);
    }

    if (hasBodyProperty(body, 'bearerToken')) {
      provider.bearerToken = toNullableString(req.body.bearerToken);
    }

    if (provider.authType === ExternalProviderAuthType.NONE) {
      provider.apiKey = null;
      provider.apiKeyHeader = null;
      provider.bearerToken = null;
    }

    if (provider.authType === ExternalProviderAuthType.API_KEY) {
      provider.bearerToken = null;
    }

    if (provider.authType === ExternalProviderAuthType.BEARER) {
      provider.apiKey = null;
      provider.apiKeyHeader = null;
    }

    provider.cacheMinutes =
      req.body.cacheMinutes !== undefined
        ? toNumber(req.body.cacheMinutes, provider.cacheMinutes)
        : provider.cacheMinutes;

    provider.idType = req.body.idType ?? provider.idType;
    provider.mediaType = req.body.mediaType ?? provider.mediaType;

    if (hasBodyProperty(body, 'itemsPath')) {
      provider.itemsPath = toNullableString(req.body.itemsPath);
    }

    if (hasBodyProperty(body, 'tmdbIdPath')) {
      provider.tmdbIdPath = toNullableString(req.body.tmdbIdPath);
    }

    if (hasBodyProperty(body, 'tvdbIdPath')) {
      provider.tvdbIdPath = toNullableString(req.body.tvdbIdPath);
    }

    if (hasBodyProperty(body, 'mediaTypePath')) {
      provider.mediaTypePath = toNullableString(req.body.mediaTypePath);
    }

    if (hasBodyProperty(body, 'defaultMediaType')) {
      provider.defaultMediaType = toNullableString(req.body.defaultMediaType);
    }

    provider.enabled = toBoolean(req.body.enabled, provider.enabled);

    const savedProvider = await providerRepository.save(provider);

    return res.status(200).json(savedProvider);
  } catch (e) {
    logger.error('Something went wrong updating an external provider.', {
      label: 'API',
      providerId,
      errorMessage: e instanceof Error ? e.message : String(e),
    });

    return next({
      status: 500,
      message: 'Unable to update external provider.',
    });
  }
});

externalProviderRoutes.delete(
  '/providers/:providerId',
  async (req, res, next) => {
    const providerRepository = getRepository(ExternalProvider);
    const providerId = toPositiveInteger(req.params.providerId);

    if (!providerId) {
      return next({
        status: 400,
        message: 'Invalid external provider ID.',
      });
    }

    try {
      const provider = await providerRepository.findOne({
        where: {
          id: providerId,
        },
      });

      if (!provider) {
        return next({
          status: 404,
          message: 'External provider not found.',
        });
      }

      await providerRepository.remove(provider);

      return res.status(204).send();
    } catch (e) {
      logger.error('Something went wrong deleting an external provider.', {
        label: 'API',
        providerId,
        errorMessage: e instanceof Error ? e.message : String(e),
      });

      return next({
        status: 500,
        message: 'Unable to delete external provider.',
      });
    }
  }
);

export default externalProviderRoutes;

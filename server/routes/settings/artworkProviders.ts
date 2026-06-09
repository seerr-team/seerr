import CoverArtArchive, {
  COVER_ART_ARCHIVE_DEFAULT_MAX_REQUESTS,
  COVER_ART_ARCHIVE_DEFAULT_MAX_RPS,
} from '@server/api/coverartarchive';
import {
  getSettings,
  type ArtworkProvidersSettings,
} from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

function getTestResultString(testValue: number): string {
  // -1: never started — surfaces as "not tested" to stay within the documented
  // ['ok', 'failed', 'not tested'] enum.
  if (testValue === -1) return 'not tested';
  if (testValue === 0) return 'failed';
  return 'ok';
}

function coerceNumber(value: unknown, fallback: number, min = 1): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min) return fallback;
  return Math.floor(num);
}

function applyArtworkProvidersDefaults(
  settings: ArtworkProvidersSettings
): ArtworkProvidersSettings {
  return {
    coverArtArchive: {
      maxRPS: coerceNumber(
        settings.coverArtArchive.maxRPS,
        COVER_ART_ARCHIVE_DEFAULT_MAX_RPS
      ),
      maxRequests: coerceNumber(
        settings.coverArtArchive.maxRequests,
        COVER_ART_ARCHIVE_DEFAULT_MAX_REQUESTS
      ),
    },
  };
}

const artworkProvidersRoutes = Router();

artworkProvidersRoutes.get('/', (_req, res) => {
  const { artworkProviders } = getSettings();
  res.status(200).json(applyArtworkProvidersDefaults(artworkProviders));
});

artworkProvidersRoutes.put('/', async (req, res) => {
  const settings = getSettings();
  const body = req.body as Partial<ArtworkProvidersSettings>;

  const current = settings.artworkProviders;
  const merged: ArtworkProvidersSettings = {
    coverArtArchive: {
      ...current.coverArtArchive,
      ...(body.coverArtArchive ?? {}),
    },
  };

  const updated = applyArtworkProvidersDefaults(merged);

  settings.artworkProviders = updated;
  await settings.save();

  res.status(200).json({ success: true, ...updated });
});

artworkProvidersRoutes.post('/test', async (_req, res) => {
  let caaTest = -1;

  try {
    caaTest = 0;
    const caa = new CoverArtArchive();
    caaTest = (await caa.testConnection()) ? 1 : 0;
  } catch (e) {
    logger.error('Failed to test Cover Art Archive', {
      label: 'ArtworkProviders',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }

  const success = caaTest === 1;

  return res.status(success ? 200 : 500).json({
    success,
    tests: {
      coverArtArchive: getTestResultString(caaTest),
    },
  });
});

export default artworkProvidersRoutes;

import TheAudioDb, {
  THE_AUDIO_DB_DEFAULT_MAX_REQUESTS,
  THE_AUDIO_DB_DEFAULT_MAX_RPS,
} from '@server/api/theaudiodb';
import {
  getSettings,
  type ArtworkProvidersSettings,
} from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

function getTestResultString(testValue: number): string {
  // -1: never started; 2: skipped (no API key) — both surface as "not tested"
  // to stay within the documented ['ok', 'failed', 'not tested'] enum.
  if (testValue === -1 || testValue === 2) return 'not tested';
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
    theAudioDb: {
      apiKey: settings.theAudioDb.apiKey ?? '',
      maxRPS: coerceNumber(
        settings.theAudioDb.maxRPS,
        THE_AUDIO_DB_DEFAULT_MAX_RPS
      ),
      maxRequests: coerceNumber(
        settings.theAudioDb.maxRequests,
        THE_AUDIO_DB_DEFAULT_MAX_REQUESTS
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
    theAudioDb: {
      ...current.theAudioDb,
      ...(body.theAudioDb ?? {}),
    },
  };

  const updated = applyArtworkProvidersDefaults(merged);

  settings.artworkProviders = updated;
  await settings.save();

  res.status(200).json({ success: true, ...updated });
});

artworkProvidersRoutes.post('/test', async (_req, res) => {
  let tadbTest = -1;

  try {
    tadbTest = 0;
    const tadb = new TheAudioDb();
    if (!tadb.hasApiKey()) {
      tadbTest = 2;
    } else {
      tadbTest = (await tadb.testConnection()) ? 1 : 0;
    }
  } catch (e) {
    logger.error('Failed to test TheAudioDB', {
      label: 'ArtworkProviders',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }

  const success = tadbTest === 1 || tadbTest === 2;

  return res.status(success ? 200 : 500).json({
    success,
    tests: {
      theAudioDb: getTestResultString(tadbTest),
    },
  });
});

export default artworkProvidersRoutes;

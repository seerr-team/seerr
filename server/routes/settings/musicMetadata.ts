import ListenBrainzAPI from '@server/api/listenbrainz';
import { getSettings, type MusicMetadataSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

function getTestResultString(testValue: number): string {
  if (testValue === -1) return 'not tested';
  if (testValue === 0) return 'failed';
  return 'ok';
}

/**
 * Validate a user-supplied base URL before it is used to construct an
 * outbound HTTP client. This is the boundary check that prevents SSRF via
 * exotic protocol handlers, embedded credentials, or malformed inputs.
 * Returns the canonical URL string on success and throws an Error with a
 * human-readable message on failure.
 */
function sanitizeProviderBaseUrl(rawUrl: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL for ${field}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol for ${field}: ${parsed.protocol}`);
  }
  if (!parsed.hostname) {
    throw new Error(`Missing hostname for ${field}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Embedded credentials are not allowed for ${field}`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

function validateMusicMetadataUrls(settings: MusicMetadataSettings): void {
  sanitizeProviderBaseUrl(
    settings.listenbrainz.apiBaseUrl,
    'listenbrainz.apiBaseUrl'
  );
  sanitizeProviderBaseUrl(
    settings.listenbrainz.webBaseUrl,
    'listenbrainz.webBaseUrl'
  );
}

function applyMusicMetadataDefaults(
  settings: MusicMetadataSettings
): MusicMetadataSettings {
  return {
    listenbrainz: {
      apiBaseUrl:
        settings.listenbrainz.apiBaseUrl || 'https://api.listenbrainz.org',
      webBaseUrl:
        settings.listenbrainz.webBaseUrl || 'https://listenbrainz.org',
      userToken: settings.listenbrainz.userToken ?? '',
    },
  };
}

function mergeCandidateSettings(
  current: MusicMetadataSettings,
  body: Partial<MusicMetadataSettings> | undefined
): MusicMetadataSettings {
  const candidate = body ?? {};
  return applyMusicMetadataDefaults({
    listenbrainz: {
      ...current.listenbrainz,
      ...(candidate.listenbrainz ?? {}),
    },
  });
}

const musicMetadataRoutes = Router();

musicMetadataRoutes.get('/', (_req, res) => {
  const { musicMetadata } = getSettings();
  res.status(200).json(applyMusicMetadataDefaults(musicMetadata));
});

musicMetadataRoutes.put('/', async (req, res) => {
  const settings = getSettings();
  const body = req.body as Partial<MusicMetadataSettings>;

  const updated = mergeCandidateSettings(settings.musicMetadata, body);

  try {
    validateMusicMetadataUrls(updated);
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: e instanceof Error ? e.message : 'Invalid music metadata URL',
    });
  }

  settings.musicMetadata = updated;
  await settings.save();

  res.status(200).json({ success: true, ...updated });
});

musicMetadataRoutes.post('/test', async (req, res) => {
  const body = req.body as Partial<MusicMetadataSettings> | undefined;
  const candidate = mergeCandidateSettings(getSettings().musicMetadata, body);

  // Validate user-supplied URLs before constructing any HTTP client.
  // This is the SSRF boundary check: only http(s) URLs with a hostname
  // and no embedded credentials are allowed to be used as a base URL.
  try {
    validateMusicMetadataUrls(candidate);
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: e instanceof Error ? e.message : 'Invalid music metadata URL',
      tests: {
        listenbrainz: getTestResultString(-1),
      },
    });
  }

  let lbTest = -1;

  try {
    lbTest = 0;
    const lb = new ListenBrainzAPI(candidate.listenbrainz);
    await lb.getFreshReleases({ days: 1, count: 1 });
    lbTest = 1;
  } catch (e) {
    logger.error('Failed to test ListenBrainz', {
      label: 'MusicMetadata',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }

  const success = lbTest === 1;

  return res.status(success ? 200 : 500).json({
    success,
    tests: {
      listenbrainz: getTestResultString(lbTest),
    },
  });
});

export default musicMetadataRoutes;

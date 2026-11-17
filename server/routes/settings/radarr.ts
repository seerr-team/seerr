import RadarrAPI from '@server/api/servarr/radarr';
import type { RadarrSettings } from '@server/interfaces/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const radarrRoutes = Router();

radarrRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.radarr);
});

radarrRoutes.post('/', async (req, res) => {
  const settings = getSettings();

  const newRadarr = req.body as RadarrSettings;
  const lastItem = settings.radarr[settings.radarr.length - 1];
  newRadarr.id = lastItem ? lastItem.id + 1 : 0;

  // If we are setting this as the default, clear any previous defaults for the same type first
  // ex: if is4k is true, it will only remove defaults for other servers that have is4k set to true
  // and are the default
  if (req.body.isDefault) {
    settings.radarr
      .filter((radarrInstance) => radarrInstance.is4k === req.body.is4k)
      .forEach((radarrInstance) => {
        radarrInstance.isDefault = false;
      });
  }

  settings.radarr = [...settings.radarr, newRadarr];
  await settings.save();

  return res.status(201).json(newRadarr);
});

radarrRoutes.post<
  undefined,
  Record<string, unknown>,
  RadarrSettings & { tagLabel?: string }
>('/test', async (req, res, next) => {
  try {
    const radarr = new RadarrAPI({
      apiKey: req.body.apiKey,
      url: RadarrAPI.buildUrl(req.body, '/api/v3'),
    });

    const urlBase = await radarr
      .getSystemStatus()
      .then((value) => value.urlBase)
      .catch(() => req.body.baseUrl);
    const profiles = await radarr.getProfiles();
    const folders = await radarr.getRootFolders();
    const tags = await radarr.getTags();

    return res.status(200).json({
      profiles,
      rootFolders: folders.map((folder) => ({
        id: folder.id,
        path: folder.path,
      })),
      tags,
      urlBase,
    });
  } catch (e) {
    logger.error('Failed to test Radarr', {
      label: 'Radarr',
      message: e.message,
    });

    next({ status: 500, message: 'Failed to connect to Radarr' });
  }
});

radarrRoutes.put<{ id: string }, RadarrSettings, RadarrSettings>(
  '/:id',
  async (req, res, next) => {
    const settings = getSettings();

    const radarrIndex = settings.radarr.findIndex(
      (r) => r.id === Number(req.params.id)
    );

    if (radarrIndex === -1) {
      return next({ status: '404', message: 'Settings instance not found' });
    }

    // If we are setting this as the default, clear any previous defaults for the same type first
    // ex: if is4k is true, it will only remove defaults for other servers that have is4k set to true
    // and are the default
    if (req.body.isDefault) {
      settings.radarr
        .filter((radarrInstance) => radarrInstance.is4k === req.body.is4k)
        .forEach((radarrInstance) => {
          radarrInstance.isDefault = false;
        });
    }

    settings.radarr[radarrIndex] = {
      ...req.body,
      id: Number(req.params.id),
    } as RadarrSettings;
    await settings.save();

    return res.status(200).json(settings.radarr[radarrIndex]);
  }
);

radarrRoutes.get<{ id: string }>('/:id/profiles', async (req, res, next) => {
  const settings = getSettings();

  const radarrSettings = settings.radarr.find(
    (r) => r.id === Number(req.params.id)
  );

  if (!radarrSettings) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const radarr = new RadarrAPI({
    apiKey: radarrSettings.apiKey,
    url: RadarrAPI.buildUrl(radarrSettings, '/api/v3'),
  });

  const profiles = await radarr.getProfiles();

  return res.status(200).json(
    profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
    }))
  );
});

radarrRoutes.delete<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();

  const radarrIndex = settings.radarr.findIndex(
    (r) => r.id === Number(req.params.id)
  );

  if (radarrIndex === -1) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const removed = settings.radarr.splice(radarrIndex, 1);
  await settings.save();

  return res.status(200).json(removed[0]);
});

export default radarrRoutes;

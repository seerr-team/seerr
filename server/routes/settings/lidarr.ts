import LidarrAPI from '@server/api/servarr/lidarr';
import type { LidarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const lidarrRoutes = Router();

lidarrRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.lidarr);
});

lidarrRoutes.post('/', (req, res) => {
  const settings = getSettings();

  const newLidarr = req.body as LidarrSettings;
  const lastItem = settings.lidarr[settings.lidarr.length - 1];
  newLidarr.id = lastItem ? lastItem.id + 1 : 0;

  // If we are setting this as the default, clear any previous defaults for the same type first
  settings.lidarr = [...settings.lidarr, newLidarr];
  settings.save();

  return res.status(201).json(newLidarr);
});

lidarrRoutes.post<
  undefined,
  Record<string, unknown>,
  LidarrSettings & { tagLabel?: string }
>('/test', async (req, res, next) => {
  try {
    const lidarr = new LidarrAPI({
      apiKey: req.body.apiKey,
      url: LidarrAPI.buildUrl(req.body, '/api/v1'),
    });

    const urlBase = await lidarr
      .getSystemStatus()
      .then((value) => value.urlBase)
      .catch(() => req.body.baseUrl);
    const profiles = await lidarr.getProfiles();
    const folders = await lidarr.getRootFolders();
    const tags = await lidarr.getTags();

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
    logger.error('Failed to test Lidarr', {
      label: 'Lidarr',
      message: e.message,
    });

    next({ status: 500, message: 'Failed to connect to Lidarr' });
  }
});

lidarrRoutes.put<{ id: string }, LidarrSettings, LidarrSettings>(
  '/:id',
  (req, res, next) => {
    const settings = getSettings();

    const lidarrIndex = settings.lidarr.findIndex(
      (r) => r.id === Number(req.params.id)
    );

    if (lidarrIndex === -1) {
      return next({ status: '404', message: 'Settings instance not found' });
    }

    // If we are setting this as the default, clear any previous defaults for the same type first

    settings.lidarr[lidarrIndex] = {
      ...req.body,
      id: Number(req.params.id),
    } as LidarrSettings;
    settings.save();

    return res.status(200).json(settings.lidarr[lidarrIndex]);
  }
);

lidarrRoutes.get<{ id: string }>('/:id/profiles', async (req, res, next) => {
  const settings = getSettings();

  const lidarrSettings = settings.lidarr.find(
    (r) => r.id === Number(req.params.id)
  );

  if (!lidarrSettings) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const lidarr = new LidarrAPI({
    apiKey: lidarrSettings.apiKey,
    url: LidarrAPI.buildUrl(lidarrSettings, '/api/v1'),
  });

  const profiles = await lidarr.getProfiles();

  return res.status(200).json(
    profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
    }))
  );
});

lidarrRoutes.delete<{ id: string }>('/:id', (req, res, next) => {
  const settings = getSettings();

  const lidarrIndex = settings.lidarr.findIndex(
    (r) => r.id === Number(req.params.id)
  );

  if (lidarrIndex === -1) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const removed = settings.lidarr.splice(lidarrIndex, 1);
  settings.save();

  return res.status(200).json(removed[0]);
});

export default lidarrRoutes;

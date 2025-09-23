import ReadarrAPI from '@server/api/servarr/readarr';
import type { ReadarrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const readarrRoutes = Router();

readarrRoutes.get('/', (_req, res) => {
  const settings = getSettings();

  res.status(200).json(settings.readarr);
});

readarrRoutes.post('/', async (req, res) => {
  const settings = getSettings();

  const newReadarr = req.body as ReadarrSettings;
  const lastItem = settings.readarr[settings.readarr.length - 1];
  newReadarr.id = lastItem ? lastItem.id + 1 : 0;

  // If we are setting this as the default, clear any previous defaults for the same type first
  // ex: if isAudio is true, it will only remove defaults for other servers that have isAudio set to true
  // and are the default
  if (req.body.isDefault) {
    settings.readarr
      .filter((readarrInstance) => readarrInstance.isAudio === req.body.isAudio)
      .forEach((readarrInstance) => {
        readarrInstance.isDefault = false;
      });
  }

  settings.readarr = [...settings.readarr, newReadarr];
  await settings.save();

  return res.status(201).json(newReadarr);
});

readarrRoutes.post<
  undefined,
  Record<string, unknown>,
  ReadarrSettings & { tagLabel?: string }
>('/test', async (req, res, next) => {
  try {
    const readarr = new ReadarrAPI({
      apiKey: req.body.apiKey,
      url: ReadarrAPI.buildUrl(req.body, '/api/v1'),
    });

    const urlBase = await readarr
      .getSystemStatus()
      .then((value) => value.urlBase)
      .catch(() => req.body.baseUrl);
    const profiles = await readarr.getProfiles();
    const folders = await readarr.getRootFolders();
    const metadataProfiles = await readarr.getMetadataProfiles();
    const tags = await readarr.getTags();

    return res.status(200).json({
      profiles,
      rootFolders: folders.map((folder) => ({
        id: folder.id,
        path: folder.path,
      })),
      metadataProfiles,
      tags,
      urlBase,
    });
  } catch (e) {
    logger.error('Failed to test Readarr', {
      label: 'Readarr',
      message: e.message,
    });

    next({ status: 500, message: 'Failed to connect to Readarr' });
  }
});

readarrRoutes.put<{ id: string }, ReadarrSettings, ReadarrSettings>(
  '/:id',
  async (req, res, next) => {
    const settings = getSettings();

    const readarrIndex = settings.readarr.findIndex(
      (r) => r.id === Number(req.params.id)
    );

    if (readarrIndex === -1) {
      return next({ status: '404', message: 'Settings instance not found' });
    }

    // If we are setting this as the default, clear any previous defaults for the same type first
    // ex: if isAudio is true, it will only remove defaults for other servers that have isAudio set to true
    // and are the default
    if (req.body.isDefault) {
      settings.readarr
        .filter(
          (readarrInstance) => readarrInstance.isAudio === req.body.isAudio
        )
        .forEach((readarrInstance) => {
          readarrInstance.isDefault = false;
        });
    }

    settings.readarr[readarrIndex] = {
      ...req.body,
      id: Number(req.params.id),
    } as ReadarrSettings;
    await settings.save();

    return res.status(200).json(settings.readarr[readarrIndex]);
  }
);

readarrRoutes.get<{ id: string }>('/:id/profiles', async (req, res, next) => {
  const settings = getSettings();

  const readarrSettings = settings.readarr.find(
    (r) => r.id === Number(req.params.id)
  );

  if (!readarrSettings) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const readarr = new ReadarrAPI({
    apiKey: readarrSettings.apiKey,
    url: ReadarrAPI.buildUrl(readarrSettings, '/api/v1'),
  });

  const profiles = await readarr.getProfiles();

  return res.status(200).json(
    profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
    }))
  );
});

readarrRoutes.get<{ id: string }>(
  '/:id/metadataprofiles',
  async (req, res, next) => {
    const settings = getSettings();

    const readarrSettings = settings.readarr.find(
      (r) => r.id === Number(req.params.id)
    );

    if (!readarrSettings) {
      return next({ status: '404', message: 'Settings instance not found' });
    }

    const readarr = new ReadarrAPI({
      apiKey: readarrSettings.apiKey,
      url: ReadarrAPI.buildUrl(readarrSettings, '/api/v1'),
    });

    const metadataProfiles = await readarr.getMetadataProfiles();

    return res.status(200).json(
      metadataProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
      }))
    );
  }
);

readarrRoutes.delete<{ id: string }>('/:id', (req, res, next) => {
  const settings = getSettings();

  const readarrIndex = settings.readarr.findIndex(
    (r) => r.id === Number(req.params.id)
  );

  if (readarrIndex === -1) {
    return next({ status: '404', message: 'Settings instance not found' });
  }

  const removed = settings.readarr.splice(readarrIndex, 1);
  settings.save();

  return res.status(200).json(removed[0]);
});

export default readarrRoutes;

import type { RequestProfile } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';

const requestProfileRoutes = Router();

requestProfileRoutes.get('/', (_req, res) => {
  const settings = getSettings();
  res.status(200).json(settings.requestProfiles);
});

requestProfileRoutes.post('/', async (req, res) => {
  const settings = getSettings();
  const body = req.body as Omit<RequestProfile, 'id'>;
  const last = settings.requestProfiles[settings.requestProfiles.length - 1];
  const profile: RequestProfile = { ...body, id: last ? last.id + 1 : 0 };
  settings.requestProfiles = [...settings.requestProfiles, profile];
  await settings.save();
  return res.status(201).json(profile);
});

requestProfileRoutes.put<{ id: string }>(
  '/:id',
  async (req, res, next) => {
    const settings = getSettings();
    const id = Number(req.params.id);
    const existing = settings.requestProfiles.find((p) => p.id === id);
    if (!existing) {
      return next({ status: 404, message: 'Request profile not found.' });
    }
    const updated = { ...existing, ...req.body, id };
    settings.requestProfiles = settings.requestProfiles.map((p) =>
      p.id === id ? updated : p
    );
    await settings.save();
    return res.status(200).json(updated);
  }
);

requestProfileRoutes.delete<{ id: string }>(
  '/:id',
  async (req, res, next) => {
    const settings = getSettings();
    const id = Number(req.params.id);
    if (!settings.requestProfiles.find((p) => p.id === id)) {
      return next({ status: 404, message: 'Request profile not found.' });
    }
    settings.requestProfiles = settings.requestProfiles.filter(
      (p) => p.id !== id
    );
    await settings.save();
    return res.status(204).send();
  }
);

export default requestProfileRoutes;

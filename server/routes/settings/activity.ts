import type {
  ActivityAnnouncement,
  ActivitySettings,
} from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';
import { clamp } from 'lodash';

const activitySettingsRoutes = Router();

const sanitizeText = (value: string, maxLength: number) =>
  value.trim().slice(0, maxLength);

const sanitizeAnnouncements = (
  input: unknown
): ActivityAnnouncement[] | undefined => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const announcements: ActivityAnnouncement[] = [];

  for (const item of input.slice(0, 3)) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const unsafeItem = item as Partial<ActivityAnnouncement>;

    const body =
      typeof unsafeItem.body === 'string'
        ? sanitizeText(unsafeItem.body, 2000)
        : '';
    if (!body) {
      continue;
    }

    const title =
      typeof unsafeItem.title === 'string'
        ? sanitizeText(unsafeItem.title, 120)
        : '';

    const id =
      typeof unsafeItem.id === 'string' && unsafeItem.id.trim()
        ? sanitizeText(unsafeItem.id, 64)
        : `${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    announcements.push({ id, title, body });
  }

  return announcements;
};

activitySettingsRoutes.get<unknown, ActivitySettings>('/', (_req, res) => {
  const settings = getSettings();

  return res.status(200).json(settings.activity);
});

activitySettingsRoutes.post('/', async (req, res) => {
  const settings = getSettings();
  const body = req.body as Partial<ActivitySettings>;

  if (typeof body.enabled === 'boolean') {
    settings.activity.enabled = body.enabled;
  }

  if (typeof body.bannerUrl === 'string') {
    settings.activity.bannerUrl = body.bannerUrl.trim();
  }

  if (body.bannerUrl === null) {
    settings.activity.bannerUrl = '';
  }

  if (body.popularDays !== undefined) {
    const popularDays = Number(body.popularDays);

    if (Number.isFinite(popularDays)) {
      settings.activity.popularDays = clamp(Math.trunc(popularDays), 1, 365);
    }
  }

  if (typeof body.heroTagline === 'string') {
    settings.activity.heroTagline = sanitizeText(body.heroTagline, 120);
  }

  if (typeof body.heroTitle === 'string') {
    settings.activity.heroTitle = sanitizeText(body.heroTitle, 120);
  }

  if (typeof body.heroBody === 'string') {
    settings.activity.heroBody = sanitizeText(body.heroBody, 1000);
  }

  if (typeof body.announcementEnabled === 'boolean') {
    settings.activity.announcementEnabled = body.announcementEnabled;
  }

  const announcements = sanitizeAnnouncements(body.announcements);
  if (announcements) {
    settings.activity.announcements = announcements;
  }

  if (typeof body.feedbackEnabled === 'boolean') {
    settings.activity.feedbackEnabled = body.feedbackEnabled;
  }

  if (typeof body.feedbackWebhookUrl === 'string') {
    const webhookUrl = body.feedbackWebhookUrl.trim();

    if (!webhookUrl) {
      settings.activity.feedbackWebhookUrl = '';
    } else {
      try {
        const parsed = new URL(webhookUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ message: 'Invalid webhook URL' });
        }
      } catch {
        return res.status(400).json({ message: 'Invalid webhook URL' });
      }

      settings.activity.feedbackWebhookUrl = webhookUrl;
    }
  }

  if (body.feedbackWebhookUrl === null) {
    settings.activity.feedbackWebhookUrl = '';
  }

  await settings.save();

  return res.status(200).json(settings.activity);
});

export default activitySettingsRoutes;

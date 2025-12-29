import PlexAPI from '@server/api/plexapi';
import TautulliAPI from '@server/api/tautulli';
import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type {
  ActivityHistoryResponse,
  ActivityPopularResponse,
  ActivitySessionsResponse,
  ActivityStatusResponse,
} from '@server/interfaces/api/activityInterfaces';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { appDataPath, appDataPermissions } from '@server/utils/appDataVolume';
import axios from 'axios';
import { Router } from 'express';
import fs from 'fs/promises';
import https from 'https';
import { clamp } from 'lodash';
import path from 'path';

const activityRoutes = Router();

const wrapThumb = (thumb?: string | null) =>
  thumb ? `/api/v1/dashboard/poster?path=${encodeURIComponent(thumb)}` : null;

type FeedbackType = 'comment' | 'error' | 'collection';

interface ActivityFeedbackEntry {
  id: string;
  type: FeedbackType;
  message: string;
  createdAt: string;
  userEmail?: string;
  userName?: string;
}

const feedbackFilePath = path.join(appDataPath(), 'dashboard-feedback.json');

const readFeedback = async (): Promise<ActivityFeedbackEntry[]> => {
  try {
    const raw = await fs.readFile(feedbackFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      return [];
    }
    logger.debug('Failed to read dashboard feedback file', {
      label: 'Dashboard',
      errorMessage: e.message,
    });
    return [];
  }
};

const appendFeedback = async (entry: ActivityFeedbackEntry) => {
  if (!appDataPermissions()) {
    logger.warn('Insufficient permissions to write dashboard feedback file', {
      label: 'Dashboard',
    });
    return;
  }

  const all = await readFeedback();
  all.push(entry);
  try {
    await fs.writeFile(feedbackFilePath, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e: any) {
    logger.debug('Failed to write dashboard feedback file', {
      label: 'Dashboard',
      errorMessage: e.message,
    });
  }
};

const getAdminPlexToken = async (): Promise<string | null> => {
  const userRepository = getRepository(User);
  const admin = await userRepository.findOne({
    select: { id: true, plexToken: true },
    where: { id: 1 },
  });

  return admin?.plexToken ?? null;
};

activityRoutes.use((_req, res, next) => {
  const settings = getSettings();

  if (!settings.activity.enabled) {
    return res.status(404).json({
      status: 404,
      error: 'Activity is disabled',
    });
  }

  next();
});

activityRoutes.get<unknown, ActivityStatusResponse>(
  '/status',
  async (req, res) => {
    try {
      const settings = getSettings();

      if (settings.main.mediaServerType !== MediaServerType.PLEX) {
        return res.json({ online: false });
      }

      const plexSettings = settings.plex;
      const plexToken = await getAdminPlexToken();
      if (!plexSettings?.ip || !plexSettings?.port || !plexToken) {
        return res.json({ online: false });
      }

      const plex = new PlexAPI({
        plexToken,
        plexSettings,
      });

      const info = await plex.getStatus();
      const container = info?.MediaContainer ?? {};

      return res.json({
        online: true,
        serverName: container.friendlyName || settings.main.applicationTitle,
        version: container.version || 'Unknown',
      });
    } catch (e) {
      logger.error('Activity status check failed', {
        label: 'Activity',
        errorMessage: e.message,
      });
      return res.json({ online: false });
    }
  }
);

activityRoutes.get<unknown, ActivitySessionsResponse>(
  '/sessions',
  async (req, res) => {
    try {
      const settings = getSettings();

      if (!settings.tautulli?.apiKey) {
        return res.json({ streamCount: 0, sessions: [] });
      }

      const tautulli = new TautulliAPI(settings.tautulli);
      const activity = await tautulli.getActivity();

      const sessions = activity.sessions.map((session) => ({
        title: session.full_title || session.title || '',
        mediaType: session.media_type ?? 'unknown',
        thumb: wrapThumb(session.thumb),
        year: session.year ?? undefined,
        progressPercent: session.progress_percent ?? undefined,
        state: session.state ?? undefined,
        transcodeDecision: session.transcode_decision ?? undefined,
      }));

      return res.json({
        streamCount: activity.stream_count ?? sessions.length,
        sessions,
      });
    } catch (e) {
      logger.error('Activity sessions failed', {
        label: 'Activity',
        errorMessage: e.message,
      });
      return res.json({ streamCount: 0, sessions: [] });
    }
  }
);

activityRoutes.get<unknown, ActivityHistoryResponse>(
  '/history',
  async (req, res) => {
    try {
      const settings = getSettings();

      if (!settings.tautulli?.apiKey) {
        return res.json({ playsByDate: { categories: [], series: [] } });
      }

      const mode = (req.query.mode as string) === 'month' ? 'month' : 'week';
      const days = mode === 'week' ? 7 : 210;

      const tautulli = new TautulliAPI(settings.tautulli);
      const playsByDate = await tautulli.getPlaysByDate(days);

      return res.json({ playsByDate });
    } catch (e) {
      logger.error('Activity history failed', {
        label: 'Activity',
        errorMessage: e.message,
      });
      return res
        .status(500)
        .json({ playsByDate: { categories: [], series: [] } });
    }
  }
);

activityRoutes.get<unknown, ActivityPopularResponse>(
  '/popular',
  async (req, res) => {
    try {
      const settings = getSettings();

      if (!settings.tautulli?.apiKey) {
        return res.json({ movies: [], tv: [] });
      }

      const rawDays = Number(req.query.days);
      const days =
        Number.isFinite(rawDays) && rawDays > 0
          ? clamp(Math.trunc(rawDays), 1, 365)
          : settings.activity.popularDays;
      const tautulli = new TautulliAPI(settings.tautulli);
      const popular = await tautulli.getPopular(days);

      return res.json({
        movies: popular.movies.map((m) => ({
          title: m.title,
          year: m.year,
          plays: m.plays,
          thumb: wrapThumb(m.thumb),
        })),
        tv: popular.tv.map((t) => ({
          title: t.title,
          year: t.year,
          plays: t.plays,
          thumb: wrapThumb(t.thumb),
        })),
      });
    } catch (e) {
      logger.error('Activity popular failed', {
        label: 'Activity',
        errorMessage: e.message,
      });
      return res.status(500).json({ movies: [], tv: [] });
    }
  }
);

activityRoutes.get('/poster', async (req, res) => {
  try {
    const rawPath = req.query.path as string | undefined;
    if (!rawPath) {
      return res.status(400).send('Missing path');
    }

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch {
      return res.status(400).send('Invalid path');
    }
    const allowedPrefixes = [
      '/library/',
      '/:/',
      '/photo/:/',
      '/pms_image_proxy',
    ];
    if (!allowedPrefixes.some((prefix) => decodedPath.startsWith(prefix))) {
      return res.status(400).send('Invalid path');
    }

    const settings = getSettings();
    if (settings.main.mediaServerType !== MediaServerType.PLEX) {
      return res.status(400).send('Plex is not configured');
    }

    const plexSettings = settings.plex;
    const plexToken = await getAdminPlexToken();
    if (!plexSettings?.ip || !plexSettings?.port || !plexToken) {
      return res.status(404).send('Plex not configured');
    }

    const baseUrl = `${plexSettings.useSsl ? 'https' : 'http'}://${
      plexSettings.ip
    }:${plexSettings.port}`;

    const url = new URL(decodedPath, baseUrl);
    url.searchParams.set('X-Plex-Token', plexToken);

    const response = await axios.get(url.toString(), {
      responseType: 'stream',
      httpsAgent: plexSettings.useSsl
        ? new https.Agent({ keepAlive: true })
        : undefined,
      timeout: 15000,
    });

    res.setHeader(
      'Content-Type',
      response.headers['content-type'] || 'image/jpeg'
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    response.data.pipe(res);
  } catch (e) {
    logger.error('Activity poster proxy failed', {
      label: 'Activity',
      errorMessage: e.message,
    });
    return res.status(500).send();
  }
});

activityRoutes.post('/feedback', async (req, res) => {
  try {
    const settings = getSettings();
    if (!settings.activity.feedbackEnabled) {
      return res.status(404).json({ message: 'Feedback is disabled.' });
    }

    const { type, message } = req.body as {
      type?: FeedbackType;
      message?: string;
    };

    const feedbackType: FeedbackType = [
      'comment',
      'error',
      'collection',
    ].includes(type as FeedbackType)
      ? (type as FeedbackType)
      : 'comment';

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const entry: ActivityFeedbackEntry = {
      id: `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      type: feedbackType,
      message: message.trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
      userEmail: req.user?.email,
      userName: req.user?.displayName,
    };

    await appendFeedback(entry);

    const webhookUrl = settings.activity.feedbackWebhookUrl?.trim();
    if (webhookUrl) {
      try {
        await axios.post(
          webhookUrl,
          {
            type: entry.type,
            message: entry.message,
            createdAt: entry.createdAt,
            userEmail: entry.userEmail,
            userName: entry.userName,
          },
          { timeout: 5000 }
        );
      } catch (e: any) {
        logger.debug('Failed to send dashboard feedback webhook', {
          label: 'Dashboard',
          errorMessage: e.message,
        });
      }
    }

    return res.status(201).json({ id: entry.id });
  } catch (e: any) {
    logger.error('Dashboard feedback submission failed', {
      label: 'Dashboard',
      errorMessage: e.message,
    });
    return res.status(500).json({ message: 'Failed to submit feedback.' });
  }
});

activityRoutes.get(
  '/feedback',
  isAuthenticated(Permission.ADMIN),
  async (_req, res) => {
    const all = await readFeedback();
    const sorted = all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.status(200).json(sorted.slice(0, 100));
  }
);

export default activityRoutes;

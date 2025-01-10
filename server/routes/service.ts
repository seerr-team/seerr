import LidarrAPI from '@server/api/servarr/lidarr';
import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import TheMovieDb from '@server/api/themoviedb';
import type {
  ServiceCommonServer,
  ServiceCommonServerWithDetails,
} from '@server/interfaces/api/serviceInterfaces';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const serviceRoutes = Router();

serviceRoutes.get('/radarr', async (req, res) => {
  const settings = getSettings();

  const filteredRadarrServers: ServiceCommonServer[] = settings.radarr.map(
    (radarr) => ({
      id: radarr.id,
      name: radarr.name,
      is4k: radarr.is4k,
      isDefault: radarr.isDefault,
      activeDirectory: radarr.activeDirectory,
      activeProfileId: radarr.activeProfileId,
      activeTags: radarr.tags ?? [],
    })
  );

  return res.status(200).json(filteredRadarrServers);
});

serviceRoutes.get<{ radarrId: string }>(
  '/radarr/:radarrId',
  async (req, res, next) => {
    const settings = getSettings();

    const radarrSettings = settings.radarr.find(
      (radarr) => radarr.id === Number(req.params.radarrId)
    );

    if (!radarrSettings) {
      return next({
        status: 404,
        message: 'Radarr server with provided ID  does not exist.',
      });
    }

    const radarr = new RadarrAPI({
      apiKey: radarrSettings.apiKey,
      url: RadarrAPI.buildUrl(radarrSettings, '/api/v3'),
    });

    const profiles = await radarr.getProfiles();
    const rootFolders = await radarr.getRootFolders();
    const tags = await radarr.getTags();

    return res.status(200).json({
      server: {
        id: radarrSettings.id,
        name: radarrSettings.name,
        is4k: radarrSettings.is4k,
        isDefault: radarrSettings.isDefault,
        activeDirectory: radarrSettings.activeDirectory,
        activeProfileId: radarrSettings.activeProfileId,
        activeTags: radarrSettings.tags,
      },
      profiles: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
      })),
      rootFolders: rootFolders.map((folder) => ({
        id: folder.id,
        freeSpace: folder.freeSpace,
        path: folder.path,
        totalSpace: folder.totalSpace,
      })),
      tags,
    } as ServiceCommonServerWithDetails);
  }
);

serviceRoutes.get('/sonarr', async (req, res) => {
  const settings = getSettings();

  const filteredSonarrServers: ServiceCommonServer[] = settings.sonarr.map(
    (sonarr) => ({
      id: sonarr.id,
      name: sonarr.name,
      is4k: sonarr.is4k,
      isDefault: sonarr.isDefault,
      activeDirectory: sonarr.activeDirectory,
      activeProfileId: sonarr.activeProfileId,
      activeAnimeProfileId: sonarr.activeAnimeProfileId,
      activeAnimeDirectory: sonarr.activeAnimeDirectory,
      activeLanguageProfileId: sonarr.activeLanguageProfileId,
      activeAnimeLanguageProfileId: sonarr.activeAnimeLanguageProfileId,
      activeTags: [],
    })
  );

  return res.status(200).json(filteredSonarrServers);
});

serviceRoutes.get<{ sonarrId: string }>(
  '/sonarr/:sonarrId',
  async (req, res, next) => {
    const settings = getSettings();

    const sonarrSettings = settings.sonarr.find(
      (sonarr) => sonarr.id === Number(req.params.sonarrId)
    );

    if (!sonarrSettings) {
      return next({
        status: 404,
        message: 'Sonarr server with provided ID does not exist.',
      });
    }

    const sonarr = new SonarrAPI({
      apiKey: sonarrSettings.apiKey,
      url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
    });

    try {
      const systemStatus = await sonarr.getSystemStatus();
      const sonarrMajorVersion = Number(systemStatus.version.split('.')[0]);

      const profiles = await sonarr.getProfiles();
      const rootFolders = await sonarr.getRootFolders();
      const languageProfiles =
        sonarrMajorVersion <= 3 ? await sonarr.getLanguageProfiles() : null;
      const tags = await sonarr.getTags();

      return res.status(200).json({
        server: {
          id: sonarrSettings.id,
          name: sonarrSettings.name,
          is4k: sonarrSettings.is4k,
          isDefault: sonarrSettings.isDefault,
          activeDirectory: sonarrSettings.activeDirectory,
          activeProfileId: sonarrSettings.activeProfileId,
          activeAnimeProfileId: sonarrSettings.activeAnimeProfileId,
          activeAnimeDirectory: sonarrSettings.activeAnimeDirectory,
          activeLanguageProfileId: sonarrSettings.activeLanguageProfileId,
          activeAnimeLanguageProfileId:
            sonarrSettings.activeAnimeLanguageProfileId,
          activeTags: sonarrSettings.tags,
          activeAnimeTags: sonarrSettings.animeTags,
        },
        profiles: profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
        })),
        rootFolders: rootFolders.map((folder) => ({
          id: folder.id,
          freeSpace: folder.freeSpace,
          path: folder.path,
          totalSpace: folder.totalSpace,
        })),
        languageProfiles: languageProfiles,
        tags,
      } as ServiceCommonServerWithDetails);
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

serviceRoutes.get<{ tmdbId: string }>(
  '/sonarr/lookup/:tmdbId',
  async (req, res, next) => {
    const settings = getSettings();
    const tmdb = new TheMovieDb();

    const sonarrSettings = settings.sonarr[0];

    if (!sonarrSettings) {
      logger.error('No sonarr server has been setup', {
        label: 'Media Request',
      });
      return next({
        status: 404,
        message: 'No sonarr server has been setup',
      });
    }

    const sonarr = new SonarrAPI({
      apiKey: sonarrSettings.apiKey,
      url: SonarrAPI.buildUrl(sonarrSettings, '/api/v3'),
    });

    try {
      const tv = await tmdb.getTvShow({
        tvId: Number(req.params.tmdbId),
        language: 'en',
      });

      const response = await sonarr.getSeriesByTitle(tv.name);

      return res.status(200).json(response);
    } catch (e) {
      logger.error('Failed to fetch tvdb search results', {
        label: 'Media Request',
        message: e.message,
      });

      return next({
        status: 500,
        message: 'Something went wrong trying to fetch series information',
      });
    }
  }
);

serviceRoutes.get('/lidarr', async (req, res) => {
  const settings = getSettings();

  const filteredLidarrServers: ServiceCommonServer[] = settings.lidarr.map(
    (lidarr) => ({
      id: lidarr.id,
      name: lidarr.name,
      activeDirectory: lidarr.activeDirectory,
      activeProfileId: lidarr.activeProfileId,
      activeTags: lidarr.tags ?? [],
      isDefault: lidarr.isDefault,
    })
  );

  return res.status(200).json(filteredLidarrServers);
});

serviceRoutes.get<{ id: string }>('/lidarr/:id', async (req, res, next) => {
  const settings = getSettings();

  const lidarrSettings = settings.lidarr.find(
    (lidarr) => lidarr.id === Number(req.params.id)
  );

  if (!lidarrSettings) {
    return next({
      status: 404,
      message: 'Lidarr server not found.',
    });
  }

  const lidarr = new LidarrAPI({
    apiKey: lidarrSettings.apiKey,
    url: LidarrAPI.buildUrl(lidarrSettings, '/api/v1'),
  });

  try {
    const [profiles, rootFolders, tags] = await Promise.all([
      lidarr.getProfiles(),
      lidarr.getRootFolders(),
      lidarr.getTags(),
    ]);

    return res.status(200).json({
      server: {
        id: lidarrSettings.id,
        name: lidarrSettings.name,
        isDefault: lidarrSettings.isDefault,
        activeDirectory: lidarrSettings.activeDirectory,
        activeProfileId: lidarrSettings.activeProfileId,
      },
      profiles,
      rootFolders: rootFolders.map((folder) => ({
        id: folder.id,
        path: folder.path,
        freeSpace: folder.freeSpace,
        totalSpace: folder.totalSpace,
      })),
      tags,
    } as ServiceCommonServerWithDetails);
  } catch (e) {
    next({ status: 500, message: e.message });
  }
});

export default serviceRoutes;

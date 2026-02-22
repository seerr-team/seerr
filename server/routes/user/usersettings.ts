import JellyfinAPI from '@server/api/jellyfin';
import PlexTvAPI from '@server/api/plextv';
import { ApiErrorCode } from '@server/constants/error';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { UserSettings } from '@server/entity/UserSettings';
import type {
  UserSettingsGeneralResponse,
  UserSettingsNotificationsResponse,
} from '@server/interfaces/api/userSettingsInterfaces';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import { ApiError } from '@server/types/error';
import { getHostname } from '@server/utils/getHostname';
import {
  isOwnProfile,
  isOwnProfileOrAdmin,
} from '@server/utils/profileMiddleware';
import { Router } from 'express';
import net from 'net';
import { Not } from 'typeorm';
import { canMakePermissionsChange } from '.';

const userSettingsRoutes = Router({ mergeParams: true });

userSettingsRoutes.get<{ id: string }, UserSettingsGeneralResponse>(
  '/main',
  isOwnProfileOrAdmin(),
  async (req, res, next) => {
    const {
      main: { defaultQuotas },
    } = getSettings();
    const userRepository = getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!user) {
        return next({ status: 404, message: 'User not found.' });
      }

      return res.status(200).json({
        username: user.username,
        email: user.email,
        discordId: user.settings?.discordId,
        locale: user.settings?.locale,
        discoverRegion: user.settings?.discoverRegion,
        streamingRegion: user.settings?.streamingRegion,
        originalLanguage: user.settings?.originalLanguage,
        movieQuotaLimit: user.movieQuotaLimit,
        movieQuotaDays: user.movieQuotaDays,
        tvQuotaLimit: user.tvQuotaLimit,
        tvQuotaDays: user.tvQuotaDays,
        globalMovieQuotaDays: defaultQuotas.movie.quotaDays,
        globalMovieQuotaLimit: defaultQuotas.movie.quotaLimit,
        globalTvQuotaDays: defaultQuotas.tv.quotaDays,
        globalTvQuotaLimit: defaultQuotas.tv.quotaLimit,
        watchlistSyncMovies: user.settings?.watchlistSyncMovies,
        watchlistSyncTv: user.settings?.watchlistSyncTv,
      });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userSettingsRoutes.post<
  { id: string },
  UserSettingsGeneralResponse,
  UserSettingsGeneralResponse
>('/main', isOwnProfileOrAdmin(), async (req, res, next) => {
  const userRepository = getRepository(User);

  try {
    const user = await userRepository.findOne({
      where: { id: Number(req.params.id) },
    });

    if (!user) {
      return next({ status: 404, message: 'User not found.' });
    }

    // "Owner" user settings cannot be modified by other users
    if (user.id === 1 && req.user?.id !== 1) {
      return next({
        status: 403,
        message: "You do not have permission to modify this user's settings.",
      });
    }

    const oldEmail = user.email;
    user.username = req.body.username;
    if (user.userType !== UserType.PLEX) {
      user.email = req.body.email || user.jellyfinUsername || user.email;
    }

    const existingUser = await userRepository.findOne({
      where: { email: user.email, id: Not(user.id) },
    });

    if (oldEmail !== user.email && existingUser) {
      throw new ApiError(400, ApiErrorCode.InvalidEmail);
    }

    // Update quota values only if the user has the correct permissions
    if (
      !user.hasPermission(Permission.MANAGE_USERS) &&
      req.user?.id !== user.id
    ) {
      user.movieQuotaDays = req.body.movieQuotaDays;
      user.movieQuotaLimit = req.body.movieQuotaLimit;
      user.tvQuotaDays = req.body.tvQuotaDays;
      user.tvQuotaLimit = req.body.tvQuotaLimit;
    }

    if (!user.settings) {
      user.settings = new UserSettings({
        user: req.user,
        discordId: req.body.discordId,
        locale: req.body.locale,
        discoverRegion: req.body.discoverRegion,
        streamingRegion: req.body.streamingRegion,
        originalLanguage: req.body.originalLanguage,
        watchlistSyncMovies: req.body.watchlistSyncMovies,
        watchlistSyncTv: req.body.watchlistSyncTv,
      });
    } else {
      user.settings.discordId = req.body.discordId;
      user.settings.locale = req.body.locale;
      user.settings.discoverRegion = req.body.discoverRegion;
      user.settings.streamingRegion = req.body.streamingRegion;
      user.settings.originalLanguage = req.body.originalLanguage;
      user.settings.watchlistSyncMovies = req.body.watchlistSyncMovies;
      user.settings.watchlistSyncTv = req.body.watchlistSyncTv;
    }

    const savedUser = await userRepository.save(user);

    return res.status(200).json({
      username: savedUser.username,
      discordId: savedUser.settings?.discordId,
      locale: savedUser.settings?.locale,
      discoverRegion: savedUser.settings?.discoverRegion,
      streamingRegion: savedUser.settings?.streamingRegion,
      originalLanguage: savedUser.settings?.originalLanguage,
      watchlistSyncMovies: savedUser.settings?.watchlistSyncMovies,
      watchlistSyncTv: savedUser.settings?.watchlistSyncTv,
      email: savedUser.email,
    });
  } catch (e) {
    if (e.errorCode) {
      return next({
        status: e.statusCode,
        message: e.errorCode,
      });
    }
    return next({ status: 500, message: e.message });
  }
});

userSettingsRoutes.get<{ id: string }, { hasPassword: boolean }>(
  '/password',
  isOwnProfileOrAdmin(),
  async (req, res, next) => {
    const userRepository = getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
        select: ['id', 'password'],
      });

      if (!user) {
        return next({ status: 404, message: 'User not found.' });
      }

      return res.status(200).json({ hasPassword: !!user.password });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userSettingsRoutes.post<
  { id: string },
  null,
  { currentPassword?: string; newPassword: string }
>('/password', isOwnProfileOrAdmin(), async (req, res, next) => {
  const userRepository = getRepository(User);

  try {
    const user = await userRepository.findOne({
      where: { id: Number(req.params.id) },
    });

    const userWithPassword = await userRepository.findOne({
      select: ['id', 'password'],
      where: { id: Number(req.params.id) },
    });

    if (!user || !userWithPassword) {
      return next({ status: 404, message: 'User not found.' });
    }

    if (req.body.newPassword.length < 8) {
      return next({
        status: 400,
        message: 'Password must be at least 8 characters.',
      });
    }

    if (
      (user.id === 1 && req.user?.id !== 1) ||
      (user.hasPermission(Permission.ADMIN) &&
        user.id !== req.user?.id &&
        req.user?.id !== 1)
    ) {
      return next({
        status: 403,
        message: "You do not have permission to modify this user's password.",
      });
    }

    // If the user has the permission to manage users and they are not
    // editing themselves, we will just set the new password
    if (
      req.user?.hasPermission(Permission.MANAGE_USERS) &&
      req.user?.id !== user.id
    ) {
      await user.setPassword(req.body.newPassword);
      await userRepository.save(user);
      logger.debug('Password overriden by user.', {
        label: 'User Settings',
        userEmail: user.email,
        changingUser: req.user.email,
      });
      return res.status(204).send();
    }

    // If the user has a password, we need to check the currentPassword is correct
    if (
      user.password &&
      (!req.body.currentPassword ||
        !(await userWithPassword.passwordMatch(req.body.currentPassword)))
    ) {
      logger.debug(
        'Attempt to change password for user failed. Invalid current password provided.',
        { label: 'User Settings', userEmail: user.email }
      );
      return next({ status: 403, message: 'Current password is invalid.' });
    }

    await user.setPassword(req.body.newPassword);
    await userRepository.save(user);

    return res.status(204).send();
  } catch (e) {
    next({ status: 500, message: e.message });
  }
});

userSettingsRoutes.post<{ authToken: string }>(
  '/linked-accounts/plex',
  isOwnProfile(),
  async (req, res) => {
    const settings = getSettings();
    const userRepository = getRepository(User);

    if (!req.user) {
      return res.status(404).json({ code: ApiErrorCode.Unauthorized });
    }
    const isMainPlex = settings.main.mediaServerType === MediaServerType.PLEX;
    const plexForLinking = isMainPlex || settings.plex?.name ? true : false;
    if (!plexForLinking) {
      return res.status(400).json({
        message:
          'Plex is not the main server and Plex connection is not configured. Configure Plex in Settings for account linking.',
      });
    }

    // First we need to use this auth token to get the user's email from plex.tv
    const plextv = new PlexTvAPI(req.body.authToken);
    const account = await plextv.getUser();

    const user = req.user;
    const existingUser = await userRepository.findOne({
      where: { plexId: account.id },
    });
    if (existingUser) {
      if (existingUser.id === user.id) {
        user.plexId = account.id;
        user.plexUsername = account.username;
        user.plexToken = account.authToken;
        await userRepository.save(user);
        return res.status(204).send();
      }
      return res.status(422).json({
        message: 'This Plex account is already linked to a Seerr user',
      });
    }

    // Emails do not match
    if (user.email !== account.email) {
      return res.status(422).json({
        message:
          'This Plex account is registered under a different email address.',
      });
    }

    // valid plex user found, link to current user
    if (isMainPlex) {
      user.userType = UserType.PLEX;
    }
    user.plexId = account.id;
    user.plexUsername = account.username;
    user.plexToken = account.authToken;
    await userRepository.save(user);

    return res.status(204).send();
  }
);

userSettingsRoutes.delete<{ id: string }>(
  '/linked-accounts/plex',
  isOwnProfileOrAdmin(),
  async (req, res) => {
    const settings = getSettings();
    const userRepository = getRepository(User);

    const isMainPlex = settings.main.mediaServerType === MediaServerType.PLEX;
    const plexConfigured = isMainPlex || settings.plex?.name;
    if (!plexConfigured) {
      return res.status(400).json({
        message: 'Plex is not configured. Configure Plex in Settings first.',
      });
    }

    try {
      const user = await userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where({
          id: Number(req.params.id),
        })
        .getOne();

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      if (user.id === 1) {
        return res.status(400).json({
          message:
            'Cannot unlink media server accounts for the primary administrator.',
        });
      }

      if (!user.email || !user.password) {
        return res.status(400).json({
          message: 'User does not have a local email or password set.',
        });
      }

      user.userType = UserType.LOCAL;
      user.plexId = null;
      user.plexUsername = null;
      user.plexToken = null;
      await userRepository.save(user);

      return res.status(204).send();
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

userSettingsRoutes.post<{ username: string; password: string }>(
  '/linked-accounts/jellyfin',
  isOwnProfile(),
  async (req, res) => {
    const settings = getSettings();
    const userRepository = getRepository(User);

    if (!req.user) {
      return res.status(401).json({ code: ApiErrorCode.Unauthorized });
    }

    const isMainJellyfin =
      settings.main.mediaServerType === MediaServerType.JELLYFIN ||
      settings.main.mediaServerType === MediaServerType.EMBY;
    const jellyfinForLinking = settings.jellyfin;

    if (!isMainJellyfin && !jellyfinForLinking?.ip) {
      return res.status(400).json({
        message:
          'Jellyfin is not the main server and Jellyfin connection is not configured. Ask an admin to set Jellyfin in Settings (connection only) for account linking.',
      });
    }

    // Do not allow linking of an already linked account (by another user)
    const existingByUsername = await userRepository.findOne({
      where: { jellyfinUsername: req.body.username },
    });
    if (existingByUsername && existingByUsername.id !== req.user!.id) {
      return res.status(422).json({
        message: 'The specified account is already linked to a Seerr user',
      });
    }

    const hostname = isMainJellyfin
      ? getHostname()
      : getHostname(jellyfinForLinking);
    const deviceId = Buffer.from(
      req.user?.id === 1 ? 'BOT_seerr' : `BOT_seerr_${req.user.username ?? ''}`
    ).toString('base64');

    const jellyfinserver = new JellyfinAPI(hostname, undefined, deviceId);

    const ip = req.ip;
    let clientIp: string | undefined;
    if (ip) {
      if (net.isIPv4(ip)) {
        clientIp = ip;
      } else if (net.isIPv6(ip)) {
        clientIp = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
      }
    }

    try {
      const account = await jellyfinserver.login(
        req.body.username,
        req.body.password,
        clientIp
      );

      const user = req.user;
      const existingByUserId = await userRepository.findOne({
        where: { jellyfinUserId: account.User.Id },
      });

      if (existingByUserId) {
        if (existingByUserId.id === user.id) {
          if (isMainJellyfin) {
            user.userType =
              settings.main.mediaServerType === MediaServerType.EMBY
                ? UserType.EMBY
                : UserType.JELLYFIN;
          }
          user.jellyfinUserId = account.User.Id;
          user.jellyfinUsername = account.User.Name;
          user.jellyfinAuthToken = account.AccessToken;
          user.jellyfinDeviceId = deviceId;
          await userRepository.save(user);
          return res.status(204).send();
        }
        return res.status(422).json({
          message: 'The specified account is already linked to a Seerr user',
        });
      }

      if (isMainJellyfin) {
        user.userType =
          settings.main.mediaServerType === MediaServerType.EMBY
            ? UserType.EMBY
            : UserType.JELLYFIN;
      }
      user.jellyfinUserId = account.User.Id;
      user.jellyfinUsername = account.User.Name;
      user.jellyfinAuthToken = account.AccessToken;
      user.jellyfinDeviceId = deviceId;
      await userRepository.save(user);

      return res.status(204).send();
    } catch (e) {
      logger.error('Failed to link account to user.', {
        label: 'API',
        ip: req.ip,
        error: e,
      });
      if (
        e instanceof ApiError &&
        e.errorCode === ApiErrorCode.InvalidCredentials
      ) {
        return res.status(401).json({ code: e.errorCode });
      }

      return res.status(500).send();
    }
  }
);

userSettingsRoutes.delete<{ id: string }>(
  '/linked-accounts/jellyfin',
  isOwnProfileOrAdmin(),
  async (req, res) => {
    const settings = getSettings();
    const userRepository = getRepository(User);

    const isMainJellyfin =
      settings.main.mediaServerType === MediaServerType.JELLYFIN ||
      settings.main.mediaServerType === MediaServerType.EMBY;
    const jellyfinForLinking = settings.jellyfin;
    if (!isMainJellyfin && !jellyfinForLinking?.ip) {
      return res.status(400).json({
        message:
          'Jellyfin is not the main server and Jellyfin connection is not configured. Configure Jellyfin in Settings to allow unlinking.',
      });
    }

    try {
      const user = await userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where({
          id: Number(req.params.id),
        })
        .getOne();

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      if (user.id === 1) {
        return res.status(400).json({
          message:
            'Cannot unlink media server accounts for the primary administrator.',
        });
      }

      if (!user.email || !user.password) {
        return res.status(400).json({
          message: 'User does not have a local email or password set.',
        });
      }

      user.userType = UserType.LOCAL;
      user.jellyfinUserId = null;
      user.jellyfinUsername = null;
      user.jellyfinAuthToken = null;
      user.jellyfinDeviceId = null;
      await userRepository.save(user);

      return res.status(204).send();
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  }
);

userSettingsRoutes.get<{ id: string }, UserSettingsNotificationsResponse>(
  '/notifications',
  isOwnProfileOrAdmin(),
  async (req, res, next) => {
    const userRepository = getRepository(User);
    const settings = getSettings()?.notifications.agents;

    try {
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!user) {
        return next({ status: 404, message: 'User not found.' });
      }

      return res.status(200).json({
        emailEnabled: settings.email.enabled,
        pgpKey: user.settings?.pgpKey,
        discordEnabled:
          settings?.discord.enabled && settings.discord.options.enableMentions,
        discordEnabledTypes:
          settings?.discord.enabled && settings.discord.options.enableMentions
            ? settings.discord.types
            : 0,
        discordId: user.settings?.discordId,
        pushbulletAccessToken: user.settings?.pushbulletAccessToken,
        pushoverApplicationToken: user.settings?.pushoverApplicationToken,
        pushoverUserKey: user.settings?.pushoverUserKey,
        pushoverSound: user.settings?.pushoverSound,
        telegramEnabled: settings.telegram.enabled,
        telegramBotUsername: settings.telegram.options.botUsername,
        telegramChatId: user.settings?.telegramChatId,
        telegramMessageThreadId: user.settings?.telegramMessageThreadId,
        telegramSendSilently: user.settings?.telegramSendSilently,
        webPushEnabled: settings.webpush.enabled,
        notificationTypes: user.settings?.notificationTypes ?? {},
      });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userSettingsRoutes.post<{ id: string }, UserSettingsNotificationsResponse>(
  '/notifications',
  isOwnProfileOrAdmin(),
  async (req, res, next) => {
    const userRepository = getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!user) {
        return next({ status: 404, message: 'User not found.' });
      }

      // "Owner" user settings cannot be modified by other users
      if (user.id === 1 && req.user?.id !== 1) {
        return next({
          status: 403,
          message: "You do not have permission to modify this user's settings.",
        });
      }

      if (!user.settings) {
        user.settings = new UserSettings({
          user: req.user,
          pgpKey: req.body.pgpKey,
          discordId: req.body.discordId,
          pushbulletAccessToken: req.body.pushbulletAccessToken,
          pushoverApplicationToken: req.body.pushoverApplicationToken,
          pushoverUserKey: req.body.pushoverUserKey,
          telegramChatId: req.body.telegramChatId,
          telegramMessageThreadId: req.body.telegramMessageThreadId,
          telegramSendSilently: req.body.telegramSendSilently,
          notificationTypes: req.body.notificationTypes,
        });
      } else {
        user.settings.pgpKey = req.body.pgpKey;
        user.settings.discordId = req.body.discordId;
        user.settings.pushbulletAccessToken = req.body.pushbulletAccessToken;
        user.settings.pushoverApplicationToken =
          req.body.pushoverApplicationToken;
        user.settings.pushoverUserKey = req.body.pushoverUserKey;
        user.settings.pushoverSound = req.body.pushoverSound;
        user.settings.telegramChatId = req.body.telegramChatId;
        user.settings.telegramMessageThreadId =
          req.body.telegramMessageThreadId;
        user.settings.telegramSendSilently = req.body.telegramSendSilently;
        user.settings.notificationTypes = Object.assign(
          {},
          user.settings.notificationTypes,
          req.body.notificationTypes
        );
      }

      userRepository.save(user);

      return res.status(200).json({
        pgpKey: user.settings.pgpKey,
        discordId: user.settings.discordId,
        pushbulletAccessToken: user.settings.pushbulletAccessToken,
        pushoverApplicationToken: user.settings.pushoverApplicationToken,
        pushoverUserKey: user.settings.pushoverUserKey,
        pushoverSound: user.settings.pushoverSound,
        telegramChatId: user.settings.telegramChatId,
        telegramMessageThreadId: user.settings.telegramMessageThreadId,
        telegramSendSilently: user.settings.telegramSendSilently,
        notificationTypes: user.settings.notificationTypes,
      });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userSettingsRoutes.get<{ id: string }, { permissions?: number }>(
  '/permissions',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    const userRepository = getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!user) {
        return next({ status: 404, message: 'User not found.' });
      }

      return res.status(200).json({ permissions: user.permissions });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

userSettingsRoutes.post<
  { id: string },
  { permissions?: number },
  { permissions: number }
>(
  '/permissions',
  isAuthenticated(Permission.MANAGE_USERS),
  async (req, res, next) => {
    const userRepository = getRepository(User);

    try {
      const user = await userRepository.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!user) {
        return next({ status: 404, message: 'User not found.' });
      }

      // "Owner" user permissions cannot be modified, and users cannot set their own permissions
      if (user.id === 1 || req.user?.id === user.id) {
        return next({
          status: 403,
          message: 'You do not have permission to modify this user',
        });
      }

      if (!canMakePermissionsChange(req.body.permissions, req.user)) {
        return next({
          status: 403,
          message: 'You do not have permission to grant this level of access',
        });
      }
      user.permissions = req.body.permissions;

      await userRepository.save(user);

      return res.status(200).json({ permissions: user.permissions });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

export default userSettingsRoutes;

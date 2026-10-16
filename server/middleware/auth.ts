import { MediaServerType } from '@server/constants/server';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type {
  Permission,
  PermissionCheckOptions,
} from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';

export const checkUser: Middleware = async (req, _res, next) => {
  const settings = getSettings();
  let user: User | undefined | null;
  const apiKey = req.header('X-API-Key');

  if (apiKey) {
    let userId: number | null = null;
    const userRepository = getRepository(User);

    if (apiKey === settings.main.apiKey) {
      userId = 1; // Work on original administrator account

      // If a User ID is provided, we will act on that user's behalf
      if (req.header('X-API-User')) {
        userId = Number(req.header('X-API-User'));
      }

      if (userId) {
        user = await userRepository.findOne({ where: { id: userId } });
      }
    }
    // potentially provided user auth token
    else if (settings.main.mediaServerType === MediaServerType.JELLYFIN) {
      user = await userRepository.findOne({
        where: { jellyfinAuthToken: apiKey },
      });
    }
  } else if (req.session?.userId) {
    const userRepository = getRepository(User);

    user = await userRepository.findOne({
      where: { id: req.session.userId },
    });
  }

  if (user) {
    req.user = user;
  }

  req.locale = user?.settings?.locale
    ? user.settings.locale
    : settings.main.locale;

  next();
};

export const isAuthenticated = (
  permissions?: Permission | Permission[],
  options?: PermissionCheckOptions
): Middleware => {
  const authMiddleware: Middleware = (req, res, next) => {
    if (!req.user || !req.user.hasPermission(permissions ?? 0, options)) {
      res.status(403).json({
        status: 403,
        error: 'You do not have permission to access this endpoint',
      });
    } else {
      next();
    }
  };
  return authMiddleware;
};

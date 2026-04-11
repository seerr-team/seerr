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

  const userRepository = getRepository(User);
  let trustedProxy = false;

  // Check if the remoteSocketAddress we received the request
  // from is trusted!
  const socketAddress = req.socket.remoteAddress;

  if (socketAddress && socketAddress.indexOf('.') != -1) {
    trustedProxy =
      socketAddress == '127.0.0.1' ||
      settings.network.trustedProxies.v4.includes(socketAddress);
  } else if (socketAddress) {
    trustedProxy =
      socketAddress == '::1' ||
      settings.network.trustedProxies.v6.includes(socketAddress);
  }

  if (req.header('X-API-Key') === settings.main.apiKey) {
    let userId = 1; // Work on original administrator account

    // If a User ID is provided, we will act on that user's behalf
    if (req.header('X-API-User')) {
      userId = Number(req.header('X-API-User'));
    }

    user = await userRepository.findOne({ where: { id: userId } });
  } else if (req.session?.userId) {
    user = await userRepository.findOne({
      where: { id: req.session.userId },
    });
  } else if (
    settings.network.trustProxy &&
    settings.network.forwardAuth.enabled &&
    trustedProxy
  ) {
    const hasUserHeader = settings.network.forwardAuth.userHeader != '';
    const hasEmailHeader = settings.network.forwardAuth.emailHeader != '';
    const userValue =
      (hasUserHeader && req.header(settings.network.forwardAuth.userHeader)) ??
      '';
    const emailValue =
      (hasEmailHeader &&
        req.header(settings.network.forwardAuth.emailHeader)) ??
      '';

    let query: object[] = [];

    if (hasUserHeader && hasEmailHeader) {
      if (emailValue != '' && userValue != '') {
        // email & user header was specified so we must verify both
        query = [
          {
            jellyfinUsername: userValue,
            email: emailValue,
          },
          {
            plexUsername: userValue,
            email: emailValue,
          },
        ];
      }
    } else if (hasUserHeader && userValue != '') {
      query = [
        {
          jellyfinUsername: userValue,
        },
        {
          plexUsername: userValue,
        },
      ];
    } else if (hasEmailHeader && emailValue != '') {
      query = [
        {
          email: emailValue,
        },
      ];
    }

    if (query.length > 0) {
      user = await userRepository.findOne({
        where: query,
      });
    }
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

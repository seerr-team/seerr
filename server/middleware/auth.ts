import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import logger from '@server/logger';
import type {
  Permission,
  PermissionCheckOptions,
} from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import * as net from 'net';

export const checkUser: Middleware = async (req, _res, next) => {
  const settings = getSettings();
  let user: User | undefined | null;

  const userRepository = getRepository(User);
  let trustedProxy = false;

  // Check if the remoteSocketAddress we received the request
  // from is trusted!
  const socketAddress = req.socket.remoteAddress || '';
  const ipv4NormalizedSocketAddress = socketAddress.replace(/^::ffff:/, '');

  if (net.isIPv4(ipv4NormalizedSocketAddress)) {
    trustedProxy =
      ipv4NormalizedSocketAddress === '127.0.0.1' ||
      settings.network.trustedProxies.v4.includes(ipv4NormalizedSocketAddress);
  } else if (net.isIPv6(socketAddress)) {
    trustedProxy =
      socketAddress === '::1' ||
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
    let { userHeader, emailHeader } = settings.network.forwardAuth;
    userHeader = userHeader.toLowerCase();
    emailHeader = emailHeader.toLowerCase();

    const hasUserHeader = userHeader !== '';
    const hasEmailHeader = emailHeader !== '';
    const userValue = (hasUserHeader && req.header(userHeader)) ?? '';
    const emailValue = (hasEmailHeader && req.header(emailHeader)) ?? '';

    // Match case-insensitively. Jellyfin's AuthenticateByName lowercases the
    // username before storing (so `jellyfinUsername` is `tina`), while most
    // IDPs preserve the original case in property mappings (`Tina`). Without
    // this, every fresh deploy needs either per-user DB fix-ups or a manual
    // lowercasing expression in the IDP — surprising in both cases.
    const qb = userRepository.createQueryBuilder('user');

    if (hasUserHeader && hasEmailHeader) {
      // Both headers are configured, so BOTH must match. Do not fall through
      // to single-field matching.
      if (userValue !== '' && emailValue !== '') {
        qb.where(
          '(LOWER(user.jellyfinUsername) = LOWER(:user) OR LOWER(user.plexUsername) = LOWER(:user)) AND LOWER(user.email) = LOWER(:email)',
          { user: userValue, email: emailValue }
        );
        user = await qb.getOne();
      }
    } else if (hasUserHeader && userValue !== '') {
      qb.where(
        'LOWER(user.jellyfinUsername) = LOWER(:user) OR LOWER(user.plexUsername) = LOWER(:user)',
        { user: userValue }
      );
      user = await qb.getOne();
    } else if (hasEmailHeader && emailValue !== '') {
      qb.where('LOWER(user.email) = LOWER(:email)', { email: emailValue });
      user = await qb.getOne();
    }

    // Auto-provision: if forward-auth identifies a new user that isn't in the
    // DB, create one on the fly with the default permission set. Opt-in so
    // existing deploys are unaffected. The userType matches whichever media
    // server is configured (Plex/Jellyfin/Emby) so existing per-userType
    // logic (avatars, server-specific UI) keeps working; falls back to
    // LOCAL when no media server is configured.
    // Derive a username for provisioning. Prefer the user header when present,
    // otherwise fall back to the local-part of the email (everything before
    // '@'). This lets email-only setups (e.g. Cloudflare Access, which only
    // supplies Cf-Access-Authenticated-User-Email) provision a usable account.
    const emailLocalPart = emailValue ? emailValue.split('@')[0] : '';
    const provisionUsername = userValue || emailLocalPart;
    if (
      !user &&
      settings.network.forwardAuth.autoProvision &&
      provisionUsername
    ) {
      const mediaServerType = settings.main.mediaServerType;
      const newUserType =
        mediaServerType === MediaServerType.PLEX
          ? UserType.PLEX
          : mediaServerType === MediaServerType.JELLYFIN
            ? UserType.JELLYFIN
            : mediaServerType === MediaServerType.EMBY
              ? UserType.EMBY
              : UserType.LOCAL;

      try {
        user = new User({
          // Email is required NOT NULL — synthesise a stable placeholder when
          // the IDP doesn't provide one. Admin can edit it afterwards.
          email: emailValue || `${userValue}@forward-auth.local`,
          // Only populate the media-server username columns when an actual
          // user header was supplied — those are matched against the real
          // Plex/Jellyfin/Emby account on subsequent requests, so we must not
          // fill them with a guessed value derived from the email.
          plexUsername:
            newUserType === UserType.PLEX && userValue ? userValue : undefined,
          jellyfinUsername:
            (newUserType === UserType.JELLYFIN ||
              newUserType === UserType.EMBY) &&
              userValue
              ? userValue
              : undefined,
          // When the User Header is blank (email-only auth, e.g. Cloudflare
          // Access), use the local-part of the email as the username — this
          // drives `displayName` (see the User entity's @AfterLoad). When a
          // user header is present, leave this unset so media-server accounts
          // keep displaying via plex/jellyfinUsername as before.
          username: userValue ? undefined : emailLocalPart,
          permissions: settings.main.defaultPermissions,
          userType: newUserType,
          // Required NOT NULL column; resolved client-side via Gravatar/avatarproxy.
          avatar: '',
        });
        await userRepository.save(user);
        logger.info(
          `Auto-provisioned user via forward-auth: ${provisionUsername}`,
          { label: 'Auth', userId: user.id, userType: newUserType }
        );
      } catch (e) {
        logger.error(
          `Failed to auto-provision forward-auth user ${provisionUsername}`,
          { label: 'Auth', errorMessage: (e as Error).message }
        );
        user = null;
      }
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

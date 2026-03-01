import { Permission } from '@server/lib/permissions';

export const isOwnProfile = (): Middleware => {
  return (req, res, next) => {
    if (req.user?.id !== Number(req.params.id)) {
      return next({
        status: 403,
        message: "You do not have permission to view this user's settings.",
      });
    }
    next();
  };
};

export const isOwnProfileOrAdmin = (): Middleware => {
  const authMiddleware: Middleware = (req, res, next) => {
    if (
      !req.user?.hasPermission(Permission.MANAGE_USERS) &&
      req.user?.id !== Number(req.params.id)
    ) {
      return next({
        status: 403,
        message: "You do not have permission to view this user's settings.",
      });
    }

    next();
  };
  return authMiddleware;
};

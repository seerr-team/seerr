import { getSettings } from '@server/lib/settings';

export const addForwardAuthHeaders: Middleware = async (req, res, next) => {
  const settings = getSettings();

  if (settings.network.forwardAuth.enabled) {
    req.forwardAuth = {
      emailHeader: settings.network.forwardAuth.emailHeader,
      userHeader: settings.network.forwardAuth.userHeader,
    };
  }

  return next();
};

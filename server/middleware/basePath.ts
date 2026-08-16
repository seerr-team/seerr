import { isValidBasePath, normalizeBasePath } from '@server/utils/basePath';
import type { RequestHandler } from 'express';

const validateNetworkBasePath: RequestHandler = (req, _res, next) => {
  if (
    req.method !== 'POST' ||
    req.path !== '/network' ||
    !Object.prototype.hasOwnProperty.call(req.body ?? {}, 'basePath')
  ) {
    return next();
  }

  if (!isValidBasePath(req.body.basePath)) {
    return next({
      status: 400,
      message: 'Invalid URL base path.',
    });
  }

  req.body.basePath = normalizeBasePath(req.body.basePath);
  return next();
};

export default validateNetworkBasePath;

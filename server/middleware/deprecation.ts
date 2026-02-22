import logger from '@server/logger';
import type { NextFunction, Request, Response } from 'express';

interface DeprecationOptions {
  oldPath: string;
  newPath: string;
  sunsetDate?: string;
  documentationUrl?: string;
}

/**
 * Mark an API route as deprecated.
 * @see https://datatracker.ietf.org/doc/html/rfc8594
 */
export const deprecatedRoute = ({
  oldPath,
  newPath,
  sunsetDate,
  documentationUrl,
}: DeprecationOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.warn(
      `Deprecated API endpoint accessed: ${oldPath} => use ${newPath} instead`,
      {
        label: 'API Deprecation',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        path: req.originalUrl,
      }
    );

    res.setHeader('Deprecation', 'true');

    const links: string[] = [`<${newPath}>; rel="successor-version"`];
    if (documentationUrl) {
      links.push(`<${documentationUrl}>; rel="deprecation"`);
    }
    res.setHeader('Link', links.join(', '));

    if (sunsetDate) {
      res.setHeader('Sunset', new Date(sunsetDate).toUTCString());
    }

    next();
  };
};

export default deprecatedRoute;

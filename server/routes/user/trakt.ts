import { getRepository } from '@server/datasource';
import { TraktConnection } from '@server/entity/TraktConnection';
import { User } from '@server/entity/User';
import type {
  TraktAuthorizationResponse,
  TraktUserSettingsResponse,
} from '@server/interfaces/api/traktInterfaces';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import {
  isAllowedTraktOrigin,
  isTraktConfigured,
} from '@server/lib/trakt/config';
import { toConnectionResponse } from '@server/lib/trakt/connectionResponse';
import { TraktConnectionService } from '@server/lib/trakt/connectionService';
import { Router, type RequestHandler } from 'express';

const traktUserRoutes = Router({ mergeParams: true });

const isSelfOrTraktAdmin: RequestHandler = (req, _res, next) => {
  const targetUserId = Number(req.params.id);
  if (
    req.user?.id === targetUserId ||
    req.user?.hasPermission(Permission.ADMIN)
  ) {
    return next();
  }
  return next({
    status: 403,
    message: 'You do not have permission to do this.',
  });
};

traktUserRoutes.use(isSelfOrTraktAdmin);

traktUserRoutes.get<{ id: string }, TraktUserSettingsResponse>(
  '/',
  async (req, res, next) => {
    try {
      const targetExists = await getRepository(User).existsBy({
        id: Number(req.params.id),
      });
      if (!targetExists) {
        return next({ status: 404, message: 'User not found.' });
      }
      const connection = await getRepository(TraktConnection).findOneBy({
        userId: Number(req.params.id),
      });
      return res.status(200).json({
        applicationConfigured: isTraktConfigured(getSettings().trakt),
        connection: connection ? toConnectionResponse(connection) : null,
      });
    } catch {
      return next({
        status: 500,
        message: 'Unable to retrieve Trakt settings.',
      });
    }
  }
);

traktUserRoutes.post<{ id: string }, TraktAuthorizationResponse>(
  '/auth',
  async (req, res, next) => {
    const origin = req.get('origin');
    if (!origin || !isAllowedTraktOrigin(origin)) {
      return next({ status: 400, message: 'Invalid Trakt callback origin.' });
    }
    if (!req.user) {
      return next({ status: 401, message: 'Authentication required.' });
    }
    try {
      const response = await new TraktConnectionService().startAuthorization({
        actorUserId: req.user.id,
        targetUserId: Number(req.params.id),
        origin,
      });
      return res.status(200).json(response);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start Trakt authorization.';
      if (/missing/i.test(message)) {
        return next({ status: 404, message: 'User not found.' });
      }
      if (/not configured/i.test(message)) {
        return next({
          status: 400,
          message: 'Trakt application is not configured.',
        });
      }
      return next({
        status: 500,
        message: 'Unable to start Trakt authorization.',
      });
    }
  }
);

traktUserRoutes.delete<{ id: string }>('/', async (req, res, next) => {
  try {
    const result = await new TraktConnectionService().unlink(
      Number(req.params.id),
      req.user!.id
    );
    return res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to unlink Trakt account.';
    if (/not found/i.test(message)) {
      return next({ status: 404, message: 'Trakt connection not found.' });
    }
    return next({ status: 500, message: 'Unable to unlink Trakt account.' });
  }
});

export default traktUserRoutes;

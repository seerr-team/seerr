import { getRepository } from '@server/datasource';
import { TraktConnection } from '@server/entity/TraktConnection';
import type {
  TraktConnectionResponse,
  TraktPublicSettings,
  TraktSettingsUpdate,
} from '@server/interfaces/api/traktInterfaces';
import { getSettings } from '@server/lib/settings';
import { getSafeTraktSettings } from '@server/lib/trakt/config';
import { toConnectionResponse } from '@server/lib/trakt/connectionResponse';
import { TraktConnectionService } from '@server/lib/trakt/connectionService';
import { Router } from 'express';

const traktSettingsRoutes = Router();

interface TraktSettingsConflictResponse {
  message: string;
  code: 'confirm_reconnect_all_required';
}

traktSettingsRoutes.get<unknown, TraktPublicSettings>('/', (_req, res) =>
  res.status(200).json(getSafeTraktSettings(getSettings().trakt))
);

traktSettingsRoutes.put<
  unknown,
  TraktPublicSettings | TraktSettingsConflictResponse,
  TraktSettingsUpdate
>('/', async (req, res, next) => {
  try {
    if (!req.user) {
      return next({ status: 401, message: 'Authentication required.' });
    }
    if (typeof req.body.clientId !== 'string') {
      return next({ status: 400, message: 'Trakt client ID is required.' });
    }
    if (
      req.body.clientSecret !== undefined &&
      (typeof req.body.clientSecret !== 'string' ||
        req.body.clientSecret.length === 0)
    ) {
      return next({
        status: 400,
        message: 'Trakt client secret must not be empty.',
      });
    }
    const previousClientId = getSettings().trakt.clientId.trim();
    const clientIdChanged =
      previousClientId.length > 0 &&
      req.body.clientId.trim() !== previousClientId;
    if (clientIdChanged && req.body.confirmReconnectAll !== true) {
      return res.status(409).json({
        message: 'Confirm reconnect all is required.',
        code: 'confirm_reconnect_all_required',
      });
    }
    const result = await new TraktConnectionService().updateApplicationSettings(
      req.user.id,
      req.body
    );
    return res.status(200).json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      /confirm reconnect all is required/i.test(error.message)
    ) {
      return res.status(409).json({
        message: 'Confirm reconnect all is required.',
        code: 'confirm_reconnect_all_required',
      });
    }
    return next({
      status: 500,
      message: 'Unable to update Trakt settings.',
    });
  }
});

traktSettingsRoutes.get<unknown, TraktConnectionResponse[]>(
  '/connections',
  async (_req, res, next) => {
    try {
      const connections = await getRepository(TraktConnection).find({
        order: { userId: 'ASC' },
      });
      return res.status(200).json(connections.map(toConnectionResponse));
    } catch {
      return next({
        status: 500,
        message: 'Unable to list Trakt connections.',
      });
    }
  }
);

export default traktSettingsRoutes;

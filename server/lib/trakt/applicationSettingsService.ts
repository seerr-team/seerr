import type {
  TraktPublicSettings,
  TraktSettingsUpdate,
} from '@server/interfaces/api/traktInterfaces';
import cacheManager from '@server/lib/cache';
import { getSettings } from '@server/lib/settings';
import { getSafeTraktSettings } from '@server/lib/trakt/config';
import { traktConfigurationMutex } from '@server/lib/trakt/configurationMutex';
import { traktConnectionRepository } from '@server/lib/trakt/connectionRepository';
import { traktOAuthTransactionService } from '@server/lib/trakt/oauthTransactionService';
import logger from '@server/logger';

class TraktApplicationSettingsService {
  public updateApplicationSettings(
    actorUserId: number,
    update: TraktSettingsUpdate
  ): Promise<TraktPublicSettings> {
    return traktConfigurationMutex.run(async () => {
      if (typeof update.clientId !== 'string') {
        throw new Error('Trakt client ID is required');
      }
      if (
        update.clientSecret !== undefined &&
        update.clientSecret.length === 0
      ) {
        throw new Error('Trakt client secret must not be empty');
      }

      const settings = getSettings();
      const previous = { ...settings.trakt };
      const normalizedClientId = update.clientId.trim();
      const clientIdChanged =
        previous.clientId.trim().length > 0 &&
        normalizedClientId !== previous.clientId.trim();

      if (clientIdChanged && update.confirmReconnectAll !== true) {
        throw new Error('Confirm reconnect all is required');
      }

      let affectedConnectionCount = 0;
      if (clientIdChanged) {
        const now = new Date();
        await traktConnectionRepository.runInTransaction(async (manager) => {
          affectedConnectionCount =
            await traktConnectionRepository.invalidateAll(manager);
          await traktOAuthTransactionService.failActiveForClientIdChange(
            manager,
            now
          );
        });
        cacheManager.getCache('trakt-watch-status').flush();
      }

      try {
        settings.trakt = {
          clientId: normalizedClientId,
          ...(update.clientSecret !== undefined && {
            clientSecret: update.clientSecret,
          }),
        };
        await settings.save();
      } catch (error) {
        settings.trakt.clientId = previous.clientId;
        settings.trakt.clientSecret = previous.clientSecret;
        logger.error('Trakt application settings update failed', {
          label: 'Trakt',
          operation: 'application_settings_persist_failed',
          actorUserId,
          affectedConnectionCount,
          errorClass: error instanceof Error ? error.name : 'UnknownError',
        });
        throw error;
      }

      logger.info('Trakt application settings updated', {
        label: 'Trakt',
        operation: clientIdChanged
          ? 'application_client_id_changed'
          : 'application_settings_updated',
        actorUserId,
        affectedConnectionCount,
      });
      return getSafeTraktSettings(settings.trakt);
    });
  }
}

export const traktApplicationSettingsService =
  new TraktApplicationSettingsService();

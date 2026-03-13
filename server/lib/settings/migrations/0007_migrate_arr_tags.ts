import RadarrAPI from '@server/api/servarr/radarr';
import SonarrAPI from '@server/api/servarr/sonarr';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import type { AllSettings } from '@server/lib/settings';

const writeMigrationWarning = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeBaseUrl = (baseUrl?: string): string => {
  if (!baseUrl) {
    return '';
  }

  const trimmedBaseUrl = baseUrl.trim().replace(/^\/+/, '').replace(/\/+$/, '');

  return trimmedBaseUrl.length > 0 ? `/${trimmedBaseUrl}` : '';
};

const buildArrUrl = (settings: {
  hostname: string;
  port: number;
  useSsl?: boolean;
  baseUrl?: string;
}): string => {
  const normalizedBaseUrl = normalizeBaseUrl(settings.baseUrl);

  return `${settings.useSsl ? 'https' : 'http'}://${settings.hostname}:${
    settings.port
  }${normalizedBaseUrl}/api/v3`;
};

const migrationArrTags = async (settings: any): Promise<AllSettings> => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0007_migrate_arr_tags')
  ) {
    return settings;
  }

  const userRepository = getRepository(User);
  const users = await userRepository.find();

  let errorOccurred = false;

  for (const radarrSettings of settings.radarr || []) {
    if (!radarrSettings.tagRequests) {
      continue;
    }
    try {
      if (!radarrSettings.apiKey || !radarrSettings.hostname) {
        continue;
      }

      const radarr = new RadarrAPI({
        apiKey: radarrSettings.apiKey,
        url: buildArrUrl({
          hostname: radarrSettings.hostname,
          port: radarrSettings.port ?? 7878,
          useSsl: radarrSettings.useSsl,
          baseUrl: radarrSettings.baseUrl,
        }),
      });
      const radarrTags = await radarr.getTags();
      for (const user of users) {
        const userTag = radarrTags.find(
          (v) =>
            v.label.startsWith(user.id + ' - ') ||
            v.label.startsWith(user.id + '-')
        );
        if (!userTag) {
          continue;
        }
        await radarr.renameTag({
          id: userTag.id,
          label:
            user.id +
            '-' +
            user.displayName
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/gi, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, ''),
        });
      }
    } catch (error) {
      writeMigrationWarning(
        `Unable to rename Radarr tags to the new format. Please check your Radarr connection settings for the instance "${radarrSettings.name}". ${getErrorMessage(
          error
        )}`
      );
      errorOccurred = true;
    }
  }

  for (const sonarrSettings of settings.sonarr || []) {
    if (!sonarrSettings.tagRequests) {
      continue;
    }
    try {
      if (!sonarrSettings.apiKey || !sonarrSettings.hostname) {
        continue;
      }

      const sonarr = new SonarrAPI({
        apiKey: sonarrSettings.apiKey,
        url: buildArrUrl({
          hostname: sonarrSettings.hostname,
          port: sonarrSettings.port ?? 8989,
          useSsl: sonarrSettings.useSsl,
          baseUrl: sonarrSettings.baseUrl,
        }),
      });
      const sonarrTags = await sonarr.getTags();
      for (const user of users) {
        const userTag = sonarrTags.find(
          (v) =>
            v.label.startsWith(user.id + ' - ') ||
            v.label.startsWith(user.id + '-')
        );
        if (!userTag) {
          continue;
        }
        await sonarr.renameTag({
          id: userTag.id,
          label:
            user.id +
            '-' +
            user.displayName
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/gi, '')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, ''),
        });
      }
    } catch (error) {
      writeMigrationWarning(
        `Unable to rename Sonarr tags to the new format. Please check your Sonarr connection settings for the instance "${sonarrSettings.name}". ${getErrorMessage(
          error
        )}`
      );
      errorOccurred = true;
    }
  }

  if (!errorOccurred) {
    if (!Array.isArray(settings.migrations)) {
      settings.migrations = [];
    }
    settings.migrations.push('0007_migrate_arr_tags');
  }
  return settings;
};

export default migrationArrTags;

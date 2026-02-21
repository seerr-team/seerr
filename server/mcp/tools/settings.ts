import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { Notification } from '@server/lib/notifications';
import type { NotificationAgent } from '@server/lib/notifications/agents/agent';
import DiscordAgent from '@server/lib/notifications/agents/discord';
import EmailAgent from '@server/lib/notifications/agents/email';
import GotifyAgent from '@server/lib/notifications/agents/gotify';
import NtfyAgent from '@server/lib/notifications/agents/ntfy';
import PushbulletAgent from '@server/lib/notifications/agents/pushbullet';
import PushoverAgent from '@server/lib/notifications/agents/pushover';
import SlackAgent from '@server/lib/notifications/agents/slack';
import TelegramAgent from '@server/lib/notifications/agents/telegram';
import WebhookAgent from '@server/lib/notifications/agents/webhook';
import WebPushAgent from '@server/lib/notifications/agents/webpush';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import { getAppVersion } from '@server/utils/appVersion';
import { merge, omit } from 'lodash';
import { z } from 'zod';

export function registerSettingsTools(server: McpServer): void {
  server.registerTool(
    'get_settings',
    {
      title: 'Get Settings',
      description:
        'Get main application settings (title, URL, features, permissions, quotas). Requires ADMIN or MANAGE_SETTINGS permission.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const user = await resolveUser();
        if (
          !user ||
          !checkPermission(
            user,
            [Permission.ADMIN, Permission.MANAGE_SETTINGS],
            { type: 'or' }
          )
        ) {
          return permissionDenied('ADMIN or MANAGE_SETTINGS');
        }

        const settings = getSettings();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(omit(settings.main, 'apiKey'), null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_settings failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get settings failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'update_settings',
    {
      title: 'Update Settings',
      description:
        'Update main application settings. Provide only the fields to change. Requires ADMIN or MANAGE_SETTINGS permission.',
      inputSchema: {
        applicationTitle: z.string().optional().describe('Application title'),
        applicationUrl: z.string().optional().describe('Application URL'),
        hideAvailable: z
          .boolean()
          .optional()
          .describe('Hide available media from discover'),
        localLogin: z.boolean().optional().describe('Enable local login'),
        mediaServerLogin: z
          .boolean()
          .optional()
          .describe('Enable media server login'),
        newPlexLogin: z.boolean().optional().describe('Enable new Plex login'),
        discoverRegion: z
          .string()
          .optional()
          .describe('Default discover region (ISO 3166-1)'),
        streamingRegion: z
          .string()
          .optional()
          .describe('Default streaming region (ISO 3166-1)'),
        originalLanguage: z
          .string()
          .optional()
          .describe('Default original language filter'),
        partialRequestsEnabled: z
          .boolean()
          .optional()
          .describe('Enable partial series requests'),
        locale: z.string().optional().describe('Default display locale'),
        cacheImages: z.boolean().optional().describe('Enable image caching'),
      },
    },
    async (params) => {
      try {
        const user = await resolveUser();
        if (
          !user ||
          !checkPermission(
            user,
            [Permission.ADMIN, Permission.MANAGE_SETTINGS],
            { type: 'or' }
          )
        ) {
          return permissionDenied('ADMIN or MANAGE_SETTINGS');
        }

        const settings = getSettings();
        settings.main = merge(settings.main, params);
        await settings.save();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(omit(settings.main, 'apiKey'), null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP update_settings failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Update settings failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_services',
    {
      title: 'Get Services',
      description:
        'List configured Radarr and Sonarr instances. Requires ADMIN or MANAGE_SETTINGS permission.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const user = await resolveUser();
        if (
          !user ||
          !checkPermission(
            user,
            [Permission.ADMIN, Permission.MANAGE_SETTINGS],
            { type: 'or' }
          )
        ) {
          return permissionDenied('ADMIN or MANAGE_SETTINGS');
        }

        const settings = getSettings();

        const radarrServers = settings.radarr.map((r) => ({
          id: r.id,
          name: r.name,
          hostname: r.hostname,
          port: r.port,
          useSsl: r.useSsl,
          baseUrl: r.baseUrl,
          is4k: r.is4k,
          isDefault: r.isDefault,
          activeDirectory: r.activeDirectory,
          activeProfileId: r.activeProfileId,
          activeProfileName: r.activeProfileName,
          syncEnabled: r.syncEnabled,
        }));

        const sonarrServers = settings.sonarr.map((s) => ({
          id: s.id,
          name: s.name,
          hostname: s.hostname,
          port: s.port,
          useSsl: s.useSsl,
          baseUrl: s.baseUrl,
          is4k: s.is4k,
          isDefault: s.isDefault,
          activeDirectory: s.activeDirectory,
          activeProfileId: s.activeProfileId,
          activeProfileName: s.activeProfileName,
          syncEnabled: s.syncEnabled,
          enableSeasonFolders: s.enableSeasonFolders,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { radarr: radarrServers, sonarr: sonarrServers },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_services failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get services failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'test_notification',
    {
      title: 'Test Notification',
      description:
        'Send a test notification via the specified agent. Requires ADMIN or MANAGE_SETTINGS permission.',
      inputSchema: {
        agentType: z
          .enum([
            'discord',
            'email',
            'slack',
            'telegram',
            'pushover',
            'pushbullet',
            'ntfy',
            'gotify',
            'webhook',
            'webpush',
          ])
          .describe('Notification agent to test'),
      },
    },
    async ({ agentType }) => {
      try {
        const user = await resolveUser();
        if (
          !user ||
          !checkPermission(
            user,
            [Permission.ADMIN, Permission.MANAGE_SETTINGS],
            { type: 'or' }
          )
        ) {
          return permissionDenied('ADMIN or MANAGE_SETTINGS');
        }

        const agentMap: Record<string, NotificationAgent> = {
          discord: new DiscordAgent(),
          email: new EmailAgent(),
          slack: new SlackAgent(),
          telegram: new TelegramAgent(),
          pushover: new PushoverAgent(),
          pushbullet: new PushbulletAgent(),
          ntfy: new NtfyAgent(),
          gotify: new GotifyAgent(),
          webhook: new WebhookAgent(),
          webpush: new WebPushAgent(),
        };

        const agent = agentMap[agentType];
        const success = await agent.send(Notification.TEST_NOTIFICATION, {
          notifySystem: true,
          notifyAdmin: false,
          notifyUser: user,
          subject: 'Test Notification',
          message: 'Check check, 1, 2, 3. Are we coming in clear?',
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: success
                ? `Test notification sent successfully via ${agentType}.`
                : `Test notification failed for ${agentType}. Check agent configuration.`,
            },
          ],
          isError: !success,
        };
      } catch (e) {
        logger.error('MCP test_notification failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Test notification failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_about',
    {
      title: 'Get About',
      description:
        'Get application info: version, total media items, total requests, timezone.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const mediaRepository = getRepository(Media);
        const mediaRequestRepository = getRepository(MediaRequest);

        const totalMediaItems = await mediaRepository.count();
        const totalRequests = await mediaRequestRepository.count();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  version: getAppVersion(),
                  totalMediaItems,
                  totalRequests,
                  tz: process.env.TZ,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_about failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get about failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

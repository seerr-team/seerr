import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import GithubAPI from '@server/api/github';
import type { LogMessage } from '@server/interfaces/api/settingsInterfaces';
import { scheduledJobs } from '@server/job/schedule';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import {
  checkPermission,
  permissionDenied,
  resolveUser,
} from '@server/mcp/auth';
import { getAppVersion, getCommitTag } from '@server/utils/appVersion';
import restartFlag from '@server/utils/restartFlag';
import fs from 'fs/promises';
import { escapeRegExp, set } from 'lodash';
import path from 'path';
import { z } from 'zod';

const MAX_LOG_LINES = 10000;

export function registerSystemTools(server: McpServer): void {
  server.registerTool(
    'get_status',
    {
      title: 'Get Status',
      description:
        'Get server status: version, update availability, commits behind, restart required.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const githubApi = new GithubAPI();
        const currentVersion = getAppVersion();
        const commitTag = getCommitTag();
        let updateAvailable = false;
        let commitsBehind = 0;

        if (currentVersion.startsWith('develop-') && commitTag !== 'local') {
          const commits = await githubApi.getSeerrCommits();

          if (commits.length) {
            const filteredCommits = commits.filter(
              (commit) => !commit.commit.message.includes('[skip ci]')
            );
            if (filteredCommits[0].sha !== commitTag) {
              updateAvailable = true;
            }

            const commitIndex = filteredCommits.findIndex(
              (commit) => commit.sha === commitTag
            );

            if (updateAvailable) {
              commitsBehind = commitIndex;
            }
          }
        } else if (commitTag !== 'local') {
          const releases = await githubApi.getSeerrReleases();

          if (releases.length) {
            const latestVersion = releases[0];

            if (!latestVersion.name.includes(currentVersion)) {
              updateAvailable = true;
            }
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  version: currentVersion,
                  commitTag,
                  updateAvailable,
                  commitsBehind,
                  restartRequired: restartFlag.isSet(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_status failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Get status failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_jobs',
    {
      title: 'List Jobs',
      description:
        'List all scheduled jobs with next run time and running status. Requires ADMIN permission.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.ADMIN)) {
          return permissionDenied('ADMIN');
        }

        const jobs = scheduledJobs.map((job) => ({
          id: job.id,
          name: job.name,
          type: job.type,
          interval: job.interval,
          cronSchedule: job.cronSchedule,
          nextExecutionTime: job.job.nextInvocation(),
          running: job.running ? job.running() : false,
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP list_jobs failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `List jobs failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'run_job',
    {
      title: 'Run Job',
      description:
        'Manually trigger a scheduled job by ID. Requires ADMIN permission.',
      inputSchema: {
        jobId: z
          .string()
          .min(1)
          .describe('Job ID (e.g. plex-full-scan, radarr-scan, sonarr-scan)'),
      },
    },
    async ({ jobId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.ADMIN)) {
          return permissionDenied('ADMIN');
        }

        const scheduledJob = scheduledJobs.find((job) => job.id === jobId);

        if (!scheduledJob) {
          return {
            content: [{ type: 'text' as const, text: 'Job not found.' }],
            isError: true,
          };
        }

        scheduledJob.job.invoke();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  id: scheduledJob.id,
                  name: scheduledJob.name,
                  type: scheduledJob.type,
                  interval: scheduledJob.interval,
                  cronSchedule: scheduledJob.cronSchedule,
                  nextExecutionTime: scheduledJob.job.nextInvocation(),
                  running: scheduledJob.running
                    ? scheduledJob.running()
                    : false,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP run_job failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Run job failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'cancel_job',
    {
      title: 'Cancel Job',
      description: 'Cancel a currently running job. Requires ADMIN permission.',
      inputSchema: {
        jobId: z.string().min(1).describe('Job ID to cancel'),
      },
    },
    async ({ jobId }) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.ADMIN)) {
          return permissionDenied('ADMIN');
        }

        const scheduledJob = scheduledJobs.find((job) => job.id === jobId);

        if (!scheduledJob) {
          return {
            content: [{ type: 'text' as const, text: 'Job not found.' }],
            isError: true,
          };
        }

        if (scheduledJob.cancelFn) {
          scheduledJob.cancelFn();
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  id: scheduledJob.id,
                  name: scheduledJob.name,
                  running: scheduledJob.running
                    ? scheduledJob.running()
                    : false,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP cancel_job failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Cancel job failed: ${(e as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'get_logs',
    {
      title: 'Get Logs',
      description:
        'Retrieve application logs with pagination, filtering, and search. Requires ADMIN permission.',
      inputSchema: {
        take: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe('Number of log entries per page (default: 25, max: 100)'),
        skip: z
          .number()
          .min(0)
          .optional()
          .describe('Number of entries to skip'),
        filter: z
          .enum(['debug', 'info', 'warn', 'error'])
          .optional()
          .describe(
            'Minimum log level filter (cascading: debug includes all, error only errors)'
          ),
        search: z
          .string()
          .max(200)
          .optional()
          .describe('Search string to filter log messages'),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async (params) => {
      try {
        const user = await resolveUser();
        if (!user || !checkPermission(user, Permission.ADMIN)) {
          return permissionDenied('ADMIN');
        }

        const pageSize = params.take ?? 25;
        const skip = params.skip ?? 0;
        const search = params.search ?? '';
        const searchRegexp = new RegExp(escapeRegExp(search), 'i');

        let filter: string[] = [];
        switch (params.filter) {
          case 'debug':
            filter.push('debug');
          // falls through
          case 'info':
            filter.push('info');
          // falls through
          case 'warn':
            filter.push('warn');
          // falls through
          case 'error':
            filter.push('error');
            break;
          default:
            filter = ['debug', 'info', 'warn', 'error'];
        }

        const logFile = process.env.CONFIG_DIRECTORY
          ? `${process.env.CONFIG_DIRECTORY}/logs/.machinelogs.json`
          : path.join(__dirname, '../../../config/logs/.machinelogs.json');

        const logs: LogMessage[] = [];
        const logMessageProperties = [
          'timestamp',
          'level',
          'label',
          'message',
          'data',
        ];

        const deepValueStrings = (obj: Record<string, unknown>): string[] => {
          const values: string[] = [];
          for (const val of Object.values(obj)) {
            if (typeof val === 'string') {
              values.push(val);
            } else if (typeof val === 'number') {
              values.push(val.toString());
            } else if (val !== null && typeof val === 'object') {
              values.push(...deepValueStrings(val as Record<string, unknown>));
            }
          }
          return values;
        };

        // Read file asynchronously and limit lines processed
        const fileContent = await fs.readFile(logFile, 'utf-8');
        const lines = fileContent.split('\n');
        const linesToProcess = lines.slice(-MAX_LOG_LINES);

        for (const line of linesToProcess) {
          if (!line.length) continue;

          let logMessage: LogMessage;
          try {
            logMessage = JSON.parse(line);
          } catch {
            continue;
          }

          if (!filter.includes(logMessage.level)) {
            continue;
          }

          if (
            !Object.keys(logMessage).every((key) =>
              logMessageProperties.includes(key)
            )
          ) {
            Object.keys(logMessage)
              .filter((prop) => !logMessageProperties.includes(prop))
              .forEach((prop) => {
                set(
                  logMessage,
                  `data.${prop}`,
                  (logMessage as Record<string, unknown>)[prop]
                );
              });
          }

          if (search) {
            if (
              !searchRegexp.test(logMessage.label ?? '') &&
              !searchRegexp.test(logMessage.message) &&
              !deepValueStrings(logMessage.data ?? {}).some((val) =>
                searchRegexp.test(val)
              )
            ) {
              continue;
            }
          }

          logs.push(logMessage);
        }

        const displayedLogs = logs.reverse().slice(skip, skip + pageSize);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  pageInfo: {
                    pages: Math.ceil(logs.length / pageSize),
                    pageSize,
                    results: logs.length,
                    page: Math.ceil(skip / pageSize) + 1,
                  },
                  results: displayedLogs,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (e) {
        logger.error('MCP get_logs failed', {
          label: 'MCP',
          errorMessage: (e as Error).message,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Failed to retrieve logs.',
            },
          ],
          isError: true,
        };
      }
    }
  );
}

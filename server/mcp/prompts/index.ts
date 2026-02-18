import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'request_media',
    {
      title: 'Request Media',
      description:
        'Guided flow to search for and request a movie or TV show. Provide a query to search for, then review results and submit a request.',
      argsSchema: {
        query: z.string().describe('Movie or TV show title to search for'),
        mediaType: z
          .enum(['movie', 'tv'])
          .optional()
          .describe('Filter by media type (optional)'),
      },
    },
    async ({ query, mediaType }) => {
      const typeHint = mediaType
        ? `The user is looking for a ${mediaType === 'movie' ? 'movie' : 'TV show'}.`
        : 'The user has not specified whether this is a movie or TV show.';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `I want to request "${query}" to be added to my media library. ${typeHint}`,
            },
          },
          {
            role: 'assistant' as const,
            content: {
              type: 'text' as const,
              text: `I'll help you request "${query}". Let me search for it first.

Here's my plan:
1. Use the \`search_media\` tool to find matching results for "${query}"
2. Present the results so you can confirm which one you want
3. Check if it's already available or has an existing request using the media detail resource
4. Use the \`create_request\` tool to submit the request

Let me start by searching now.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'check_status',
    {
      title: 'Check Request Status',
      description:
        'Check the status of media requests with optional filtering by status or user.',
      argsSchema: {
        filter: z
          .enum(['all', 'pending', 'approved', 'processing', 'available'])
          .optional()
          .describe('Filter requests by status'),
        userId: z
          .string()
          .optional()
          .describe('Filter by user ID (leave empty for all users)'),
      },
    },
    async ({ filter, userId }) => {
      const filterDesc =
        filter && filter !== 'all' ? `with status "${filter}"` : '';
      const userDesc = userId ? `for user ${userId}` : '';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text:
                `Show me the current media requests ${filterDesc} ${userDesc}`.trim() +
                '.',
            },
          },
          {
            role: 'assistant' as const,
            content: {
              type: 'text' as const,
              text: `I'll check the request statuses for you. Here's my plan:

1. Use the \`list_requests\` tool to fetch requests${filter ? ` filtered by "${filter}"` : ''}${userId ? ` for user ${userId}` : ''}
2. Summarize the results with title, type, status, and request date
3. Use \`get_request_count\` for an overview of all request statistics

Let me fetch the data now.`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'report_issue',
    {
      title: 'Report Issue',
      description:
        'Guided flow to report an issue with a media item (video, audio, subtitles, or other problems).',
      argsSchema: {
        title: z
          .string()
          .optional()
          .describe('Title of the media item with the issue'),
        issueType: z
          .enum(['video', 'audio', 'subtitles', 'other'])
          .optional()
          .describe('Type of issue'),
      },
    },
    async ({ title, issueType }) => {
      const titlePart = title ? `with "${title}"` : 'with a media item';
      const typePart = issueType
        ? `The issue type is: ${issueType}.`
        : "I haven't specified the issue type yet.";

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `I want to report an issue ${titlePart}. ${typePart}`,
            },
          },
          {
            role: 'assistant' as const,
            content: {
              type: 'text' as const,
              text: `I'll help you report this issue. Here's my plan:

1. ${title ? `Search for "${title}" using \`search_media\` to find the correct media item` : 'Ask you for the media title, then search for it'}
2. ${issueType ? '' : 'Confirm the issue type (video, audio, subtitles, or other)\n3. '}Ask you to describe the problem in detail${issueType ? '' : '\n4. '}
${issueType ? '3' : '5'}. Use the \`create_issue\` tool to submit the report

${title ? 'Let me search for the media item now.' : "What is the title of the media item you're having issues with?"}`,
            },
          },
        ],
      };
    }
  );
}

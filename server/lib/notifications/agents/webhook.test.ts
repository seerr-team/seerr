import { Notification } from '@server/lib/notifications';
import WebhookAgent from '@server/lib/notifications/agents/webhook';
import type { NotificationAgentWebhook } from '@server/lib/settings';
import axios from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NotificationPayload } from './agent';

const encode = (template: string) => Buffer.from(template).toString('base64');

const makePayload = (
  overrides: Partial<NotificationPayload> = {}
): NotificationPayload =>
  ({
    subject: 'Test Subject',
    notifySystem: true,
    notifyAdmin: false,
    ...overrides,
  }) as NotificationPayload;

const makeSettings = (
  overrides: Partial<NotificationAgentWebhook['options']> = {}
): NotificationAgentWebhook => ({
  enabled: true,
  embedPoster: false,
  types: Notification.TEST_NOTIFICATION,
  options: {
    webhookUrl: 'https://example.com/webhook',
    jsonPayload: encode('{ "subject": {{ subject | json }} }'),
    ...overrides,
  },
});

describe('WebhookAgent', () => {
  describe('send', () => {
    it('returns true and posts the rendered payload', async (t) => {
      const post = t.mock.method(axios, 'post', async () => ({}));

      const agent = new WebhookAgent(makeSettings());
      const result = await agent.send(
        Notification.TEST_NOTIFICATION,
        makePayload({ subject: 'The "Best" Movie' })
      );

      assert.equal(result, true);
      assert.equal(post.mock.callCount(), 1);
      const [url, body] = post.mock.calls[0].arguments;
      assert.equal(url, 'https://example.com/webhook');
      assert.deepEqual(body, { subject: 'The "Best" Movie' });
    });

    it('returns false when the payload template fails to render', async (t) => {
      const post = t.mock.method(axios, 'post', async () => ({}));

      const agent = new WebhookAgent(
        makeSettings({ jsonPayload: encode('{% invalid %}') })
      );
      const result = await agent.send(
        Notification.TEST_NOTIFICATION,
        makePayload()
      );

      assert.equal(result, false);
      assert.equal(post.mock.callCount(), 0);
    });

    it('returns false when the rendered payload is not valid JSON', async (t) => {
      const post = t.mock.method(axios, 'post', async () => ({}));

      const agent = new WebhookAgent(
        makeSettings({ jsonPayload: encode('{ not json }') })
      );
      const result = await agent.send(
        Notification.TEST_NOTIFICATION,
        makePayload()
      );

      assert.equal(result, false);
      assert.equal(post.mock.callCount(), 0);
    });

    it('returns false when the webhook URL template fails to render', async (t) => {
      const post = t.mock.method(axios, 'post', async () => ({}));

      const agent = new WebhookAgent(
        makeSettings({
          webhookUrl: 'https://example.com/{% invalid %}',
          supportVariables: true,
        })
      );
      const result = await agent.send(
        Notification.TEST_NOTIFICATION,
        makePayload()
      );

      assert.equal(result, false);
      assert.equal(post.mock.callCount(), 0);
    });

    it('returns false when posting to the webhook URL fails', async (t) => {
      t.mock.method(axios, 'post', async () => {
        throw new Error('connect ECONNREFUSED');
      });

      const agent = new WebhookAgent(makeSettings());
      const result = await agent.send(
        Notification.TEST_NOTIFICATION,
        makePayload()
      );

      assert.equal(result, false);
    });
  });
});

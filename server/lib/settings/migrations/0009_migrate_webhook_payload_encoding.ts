import type { AllSettings } from '@server/lib/settings';

// The POST /settings/notifications/webhook route used to store the payload as
// base64(JSON.stringify(template)); it now stores base64(template). Unwrap the
// JSON envelope on existing settings so the stored value is the raw (Liquid)
// template string — otherwise the agent would decode a quoted JSON string
// literal and post a string body instead of the rendered object.
const migrateWebhookPayloadEncoding = (settings: any): AllSettings => {
  if (
    Array.isArray(settings.migrations) &&
    settings.migrations.includes('0009_migrate_webhook_payload_encoding')
  ) {
    return settings;
  }

  const options = settings.notifications?.agents?.webhook?.options;

  if (
    options &&
    typeof options.jsonPayload === 'string' &&
    options.jsonPayload
  ) {
    try {
      const decoded = Buffer.from(options.jsonPayload, 'base64').toString(
        'utf8'
      );
      const unwrapped = JSON.parse(decoded);

      // Only the old format decodes to a JSON string literal; the new format is
      // a raw template that isn't valid JSON, so JSON.parse throws and we skip.
      if (typeof unwrapped === 'string') {
        options.jsonPayload = Buffer.from(unwrapped).toString('base64');
      }
    } catch {
      // Already stored as a raw template (or not decodable) — leave as-is.
    }
  }

  if (!Array.isArray(settings.migrations)) {
    settings.migrations = [];
  }
  settings.migrations.push('0009_migrate_webhook_payload_encoding');

  return settings;
};

export default migrateWebhookPayloadEncoding;

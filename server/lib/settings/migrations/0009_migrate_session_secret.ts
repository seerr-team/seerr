import type { AllSettings } from '@server/lib/settings';
import { randomBytes } from 'crypto';

export default function migrateSessionSecret(
  settings: AllSettings
): AllSettings {
  if (settings.sessionSecret) {
    return settings;
  }
  return { ...settings, sessionSecret: randomBytes(32).toString('hex') };
}

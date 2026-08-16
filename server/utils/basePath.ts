import { appDataPath } from '@server/utils/appDataVolume';
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(appDataPath(), 'settings.json');
const BASE_PATH_PATTERN = /^(?:|\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)$/;

export const normalizeBasePath = (value?: string): string => {
  const normalized = value?.trim().replace(/^\/+|\/+$/g, '') ?? '';

  return normalized ? `/${normalized}` : '';
};

export const isValidBasePath = (value: unknown): value is string =>
  typeof value === 'string' &&
  BASE_PATH_PATTERN.test(value) &&
  !value.split('/').some((segment) => segment === '.' || segment === '..');

const getStoredBasePath = (): string => {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) as {
      network?: { basePath?: string };
    };

    return normalizeBasePath(settings.network?.basePath);
  } catch {
    return '';
  }
};

export const getRuntimeBasePath = (): string => {
  const hasEnvironmentOverride = Object.prototype.hasOwnProperty.call(
    process.env,
    'SEERR_BASE_PATH'
  );

  const basePath = normalizeBasePath(
    hasEnvironmentOverride ? process.env.SEERR_BASE_PATH : getStoredBasePath()
  );

  return isValidBasePath(basePath) ? basePath : '';
};

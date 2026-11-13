import { appDataPath } from '@server/utils/appDataVolume';
import fs from 'fs/promises';
import path from 'path';

export const CUSTOM_CSS_MAX_LENGTH = 512 * 1024;

export const getCustomCssPath = (): string =>
  path.join(appDataPath(), 'custom.css');

export const sanitizeCustomCss = (css: string): string =>
  css.replace(/<\/style/gi, '<\\/style');

export const readCustomCss = async (): Promise<string> => {
  try {
    return await fs.readFile(getCustomCssPath(), 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }
    throw e;
  }
};

export const writeCustomCss = async (css: string): Promise<void> => {
  const sanitized = sanitizeCustomCss(css);
  const filePath = getCustomCssPath();

  if (!sanitized.trim()) {
    try {
      await fs.unlink(filePath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
    return;
  }

  await fs.writeFile(filePath, sanitized, 'utf-8');
};

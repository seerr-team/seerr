import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

export function getPlexFilePaths(
  media: { Part?: { file: string }[] }[]
): string[] {
  return media.flatMap((m) => m.Part?.map((p) => p.file) ?? []);
}

export function isPathIgnored(filePaths: string[]): boolean {
  const patterns = getSettings().main.ignoredPathPatterns ?? [];
  if (patterns.length === 0 || filePaths.length === 0) return false;

  const normalized = filePaths.map((p) => p.replace(/\\/g, '/'));

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (normalized.some((fp) => regex.test(fp))) {
        return true;
      }
    } catch {
      logger.warn(
        `Invalid regex pattern in ignored path patterns: ${pattern}`,
        {
          label: 'MediaFilter',
        }
      );
    }
  }

  return false;
}

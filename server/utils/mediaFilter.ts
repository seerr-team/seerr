import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

let regexCache: Map<string, RegExp> = new Map();
const warnedPatterns: Set<string> = new Set();
let lastPatternsKey = '';

function getCompiledRegexes(patterns: string[]): Map<string, RegExp> {
  const key = patterns.join('\0');
  if (key === lastPatternsKey) return regexCache;

  regexCache = new Map();
  warnedPatterns.clear();
  lastPatternsKey = key;

  for (const pattern of patterns) {
    try {
      regexCache.set(pattern, new RegExp(pattern, 'i'));
    } catch {
      if (!warnedPatterns.has(pattern)) {
        warnedPatterns.add(pattern);
        logger.warn(
          `Invalid regex pattern in ignored path patterns: ${pattern}`,
          { label: 'MediaFilter' }
        );
      }
    }
  }

  return regexCache;
}

export function getPlexFilePaths(
  media: { Part?: { file: string }[] }[]
): string[] {
  return media.flatMap((m) => m.Part?.map((p) => p.file) ?? []);
}

export function isPathIgnored(filePaths: string[]): boolean {
  const patterns = getSettings().main.ignoredPathPatterns ?? [];
  if (patterns.length === 0 || filePaths.length === 0) return false;

  const normalized = filePaths.map((p) => p.replace(/\\/g, '/'));
  const compiledRegexes = getCompiledRegexes(patterns);

  for (const [, regex] of compiledRegexes) {
    if (normalized.some((fp) => regex.test(fp))) {
      return true;
    }
  }

  return false;
}

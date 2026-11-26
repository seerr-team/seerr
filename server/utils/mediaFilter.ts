import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { compileIgnoredPathPattern } from '@server/utils/ignoredPathPatterns';

let regexCache = new Map<string, RegExp>();
const warnedPatterns: Set<string> = new Set();
let lastPatternsKey = '';

function getCompiledRegexes(patterns: string[]): Map<string, RegExp> {
  const patternsKey = JSON.stringify(patterns);
  if (patternsKey === lastPatternsKey) return regexCache;

  regexCache = new Map<string, RegExp>();
  warnedPatterns.clear();
  lastPatternsKey = patternsKey;

  for (const pattern of patterns) {
    const regex = compileIgnoredPathPattern(pattern);

    if (regex) {
      regexCache.set(pattern, regex);
      continue;
    }

    if (!warnedPatterns.has(pattern)) {
      warnedPatterns.add(pattern);
      logger.warn(
        `Invalid or unsafe regex pattern in ignored path patterns: ${pattern}`,
        { label: 'MediaFilter' }
      );
    }
  }

  return regexCache;
}

export function getJellyfinFilePaths(
  mediaSources?: { Path: string }[]
): string[] {
  return (mediaSources?.map((ms) => ms.Path) ?? []).filter(
    (p): p is string => !!p
  );
}

export function getPlexFilePaths(
  media: { Part?: { file: string }[] }[]
): string[] {
  return media
    .flatMap((m) => m.Part?.map((p) => p.file) ?? [])
    .filter((fp): fp is string => !!fp);
}

function hasIgnoredPathPatterns(): boolean {
  return (getSettings().main.ignoredPathPatterns ?? []).length > 0;
}

export function getUnignoredJellyfinMediaSources<T extends { Path: string }>(
  mediaSources?: T[]
): T[] {
  if (!hasIgnoredPathPatterns()) {
    return mediaSources ?? [];
  }

  return (mediaSources ?? []).filter(
    (source) => !isPathIgnored(getJellyfinFilePaths([source]))
  );
}

export function getUnignoredPlexMedia<T extends { Part?: { file: string }[] }>(
  media: T[]
): T[] {
  if (!hasIgnoredPathPatterns()) {
    return media;
  }

  return media.filter(
    (mediaItem) => !isPathIgnored(getPlexFilePaths([mediaItem]))
  );
}

export function isPathIgnored(filePaths: string[]): boolean {
  const patterns = getSettings().main.ignoredPathPatterns ?? [];
  if (patterns.length === 0 || filePaths.length === 0) return false;

  const normalized = filePaths.map((p) => p.replace(/\\/g, '/'));
  const compiledRegexes = getCompiledRegexes(patterns);

  const regexList = Array.from(compiledRegexes.values());
  return normalized.every((fp) => regexList.some((regex) => regex.test(fp)));
}

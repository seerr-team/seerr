import safeRegex from 'safe-regex';

export function compileIgnoredPathPattern(pattern: string): RegExp | null {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return null;
  }

  try {
    const regex = new RegExp(pattern, 'i');

    return safeRegex(regex) ? regex : null;
  } catch {
    return null;
  }
}

export function sanitizeIgnoredPathPatterns(patterns: unknown[]): {
  cleaned: string[];
  rejected: string[];
} {
  const cleaned = new Set<string>();
  const rejected = new Set<string>();

  for (const pattern of patterns) {
    if (typeof pattern !== 'string') {
      rejected.add(String(pattern));
      continue;
    }

    const trimmed = pattern.trim();

    if (trimmed.length === 0) {
      continue;
    }

    (compileIgnoredPathPattern(trimmed) ? cleaned : rejected).add(trimmed);
  }

  return { cleaned: [...cleaned], rejected: [...rejected] };
}

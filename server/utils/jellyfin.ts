export function normalizeJellyfinGuid(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

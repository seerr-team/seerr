export function normalizeJellyfinGuid(
  value: string | null | undefined
): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/-/g, '').toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function jellyfinGuidsEqual(
  a?: string | null,
  b?: string | null
): boolean {
  const na = normalizeJellyfinGuid(a);
  const nb = normalizeJellyfinGuid(b);

  return !!na && na === nb;
}

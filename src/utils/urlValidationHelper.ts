export function isValidURL(value: unknown) {
  try {
    let url: URL;
    if (value === undefined || value === null || value === '') {
      return true;
    } else if (typeof value === 'string') {
      url = new URL(value);
    } else if (value instanceof URL) {
      url = value;
    } else {
      return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSafeRedirect(value: unknown): string {
  // exactly one leading slash, as "//host" and "/\host" are protocol-relative
  if (typeof value !== 'string' || !/^\/(?![/\\])/.test(value)) {
    return '/';
  }
  try {
    // tabs, backslashes and dot segments can still resolve to another host
    const url = new URL(value, 'http://localhost');
    return url.origin === 'http://localhost' && !url.pathname.startsWith('//')
      ? url.pathname + url.search + url.hash
      : '/';
  } catch {
    return '/';
  }
}

export function getLoginUrl(path?: string): string {
  return !path || path === '/'
    ? '/login'
    : `/login?redirect=${encodeURIComponent(path)}`;
}

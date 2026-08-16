export const normalizeBasePath = (value?: string): string => {
  const normalized = value?.trim().replace(/^\/+|\/+$/g, '') ?? '';

  return normalized ? `/${normalized}` : '';
};

const getRuntimeBasePath = (): string => {
  if (typeof window !== 'undefined') {
    return normalizeBasePath(window.__NEXT_DATA__?.assetPrefix);
  }

  return normalizeBasePath(process.env.SEERR_RUNTIME_BASE_PATH);
};

export const basePath = getRuntimeBasePath();

/**
 * Prefixes an application-local path with Seerr's configured runtime base path.
 * Absolute URLs, query-only URLs, and fragments are returned unchanged.
 */
export const withBasePath = (path: string): string => {
  if (!basePath || /^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (
    normalizedPath === basePath ||
    normalizedPath.startsWith(`${basePath}/`) ||
    normalizedPath.startsWith(`${basePath}?`) ||
    normalizedPath.startsWith(`${basePath}#`)
  ) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
};

/**
 * Removes Seerr's runtime base path from a browser-visible application URL.
 */
export const withoutBasePath = (path: string): string => {
  if (!basePath || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) {
    return path;
  }

  if (path === basePath) {
    return '/';
  }

  if (
    path.startsWith(`${basePath}/`) ||
    path.startsWith(`${basePath}?`) ||
    path.startsWith(`${basePath}#`)
  ) {
    const stripped = path.slice(basePath.length);
    return stripped || '/';
  }

  return path;
};

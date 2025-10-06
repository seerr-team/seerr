export const getBasedPath = (path: string) => {
  const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return path.startsWith('/') && path !== '/' ? `${API_BASE}${path}` : path;
};

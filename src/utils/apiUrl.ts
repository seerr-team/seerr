const API_BASE = '/api/v1';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

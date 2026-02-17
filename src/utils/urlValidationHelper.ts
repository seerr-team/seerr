export function isValidURL(value: unknown) {
  try {
    let url: URL;
    if (value === undefined || value === null || value === '') {
      return true;
    } else if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized === '') {
        return true;
      }
      url = new URL(normalized);
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

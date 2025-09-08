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

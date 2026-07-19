import axios from 'axios';

/**
 * Extracts a server-provided error message from an Axios error, falling
 * back to a caller-supplied default when the response has none (network
 * failure, unexpected error shape, etc).
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e) && e.response?.data?.message) {
    return e.response.data.message;
  }
  return fallback;
}

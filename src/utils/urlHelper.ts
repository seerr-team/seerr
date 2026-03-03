export function getHostAndPort(): string {
  let host = process.env.HOST || 'localhost';
  if (host.includes(':')) {
    // If host includes a colon, it's an IPv6 literal and needs to be placed in square brackets
    host = `[${host}]`;
  }

  const port = Number(process.env.PORT) || 5055;
  return `${host}:${port}`;
}

import logger from '@server/logger';
import http from 'node:http';
import https from 'node:https';
import { after, before } from 'node:test';

// supertest serves the app over a real loopback socket, so only external hosts
// can be refused
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

const blocked = new Set<string>();

function stripPort(host: string): string {
  const bracketed = host.match(/^\[(.+)\]/);
  if (bracketed) {
    return bracketed[1];
  }

  const parts = host.split(':');
  return parts.length === 2 ? parts[0] : host;
}

function hostnameOf(args: unknown[]): string {
  const [first, second] = args;
  const fromUrl =
    typeof first === 'string' || first instanceof URL
      ? new URL(String(first)).hostname
      : undefined;

  const options = (fromUrl !== undefined ? second : first) as
    | { hostname?: string; host?: string }
    | undefined;
  const fromOptions =
    typeof options === 'object' && options !== null
      ? (options.hostname ??
        (options.host ? stripPort(options.host) : undefined))
      : undefined;

  return stripPort(fromOptions ?? fromUrl ?? 'localhost');
}

function blockOutboundRequests(
  mod: typeof http | typeof https,
  scheme: string
) {
  // get() calls the module's internal request(), not the exported one
  for (const name of ['request', 'get'] as const) {
    const original = mod[name] as (...args: unknown[]) => unknown;

    mod[name] = ((...args: unknown[]) => {
      const hostname = hostnameOf(args);

      if (!LOOPBACK.has(hostname)) {
        const target = `${scheme}//${hostname}`;
        blocked.add(target);
        throw new Error(
          `Blocked outbound request to ${target}. Stub the API client this test uses, or set ALLOW_NETWORK=true.`
        );
      }

      return original(...args);
    }) as typeof mod.request;
  }
}

if (process.env.ALLOW_NETWORK != 'true') {
  blockOutboundRequests(http, 'http:');
  blockOutboundRequests(https, 'https:');
}

before(() => {
  if (process.env.VERBOSE != 'true') logger.silent = true;
});

after(() => {
  if (process.env.VERBOSE != 'true') logger.silent = false;

  // callers that swallow the error would otherwise leave the suite green
  if (blocked.size) {
    throw new Error(
      `Test reached the network: ${[...blocked].join(', ')}. Stub the API client this test uses.`
    );
  }
});

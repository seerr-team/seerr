import { basePath, withBasePath, withoutBasePath } from '@app/utils/basePath';
import type { NextRouter } from 'next/dist/client/router';
import NextSingletonRouter, {
  useRouter as useNextRouter,
} from 'next/dist/client/router';
import { useMemo } from 'react';

type RouteUrl = Parameters<NextRouter['push']>[0];

const mapRouteUrl = (
  url: RouteUrl,
  mapPath: (path: string) => string
): RouteUrl => {
  if (typeof url === 'string') {
    return mapPath(url);
  }

  if (
    url.protocol ||
    url.host ||
    url.hostname ||
    typeof url.pathname !== 'string'
  ) {
    return url;
  }

  return {
    ...url,
    pathname: mapPath(url.pathname),
  };
};

const internalizeUrl = (url: RouteUrl): RouteUrl =>
  mapRouteUrl(url, withoutBasePath);

const externalizeUrl = (url: RouteUrl): RouteUrl =>
  mapRouteUrl(url, withBasePath);

const wrappedRouters = new WeakMap<object, NextRouter>();

const wrapRouter = <T extends NextRouter>(router: T): T => {
  if (!basePath) {
    return router;
  }

  const existing = wrappedRouters.get(router);
  if (existing) {
    return existing as T;
  }

  const push: NextRouter['push'] = (url, as, options) =>
    router.push(internalizeUrl(url), externalizeUrl(as ?? url), options);

  const replace: NextRouter['replace'] = (url, as, options) =>
    router.replace(internalizeUrl(url), externalizeUrl(as ?? url), options);

  const prefetch: NextRouter['prefetch'] = (url, asPath, options) =>
    router.prefetch(
      withoutBasePath(url),
      asPath ? withBasePath(asPath) : withBasePath(url),
      options
    );

  const wrapped = new Proxy(router, {
    get(target, property) {
      if (property === 'asPath') {
        return withoutBasePath(target.asPath);
      }

      if (property === 'basePath') {
        return basePath;
      }

      if (property === 'push') {
        return push;
      }

      if (property === 'replace') {
        return replace;
      }

      if (property === 'prefetch') {
        return prefetch;
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as T;

  wrappedRouters.set(router, wrapped);
  return wrapped;
};

export const useRouter = (): NextRouter => {
  const router = useNextRouter();
  return useMemo(() => wrapRouter(router), [router]);
};

export default wrapRouter(NextSingletonRouter);

export { Router, withRouter } from 'next/dist/client/router';
export type {
  NextRouter,
  RouterEvent,
  SingletonRouter,
} from 'next/dist/client/router';

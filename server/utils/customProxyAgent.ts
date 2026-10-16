import type { ProxySettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import http from 'http';
import { HttpProxyAgent } from 'http-proxy-agent';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { Dispatcher } from 'undici';
import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici';

interface ProxyState {
  httpAgent: HttpProxyAgent<string>;
  httpsAgent: HttpsProxyAgent<string>;
  skipUrl: (url: string | URL) => boolean;
}

let proxyState: ProxyState | null = null;
let ipv4Agents: { httpAgent: http.Agent; httpsAgent: https.Agent } | null =
  null;

export function setForceIpv4First(enabled: boolean) {
  ipv4Agents = enabled
    ? {
        httpAgent: new http.Agent({ family: 4 }),
        httpsAgent: new https.Agent({ family: 4 }),
      }
    : null;
}

export function proxyRequestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  let url: URL | undefined;
  try {
    if (config.baseURL) {
      url = new URL(config.url ?? '', config.baseURL);
    } else if (config.url) {
      url = new URL(config.url);
    }
  } catch {
    url = undefined;
  }

  if (proxyState) {
    if (url && proxyState.skipUrl(url)) {
      config.httpAgent = ipv4Agents?.httpAgent ?? false;
      config.httpsAgent = ipv4Agents?.httpsAgent ?? false;
    } else {
      config.httpAgent = proxyState.httpAgent;
      config.httpsAgent = proxyState.httpsAgent;
    }
    config.proxy = false;
  } else if (ipv4Agents) {
    config.httpAgent = ipv4Agents.httpAgent;
    config.httpsAgent = ipv4Agents.httpsAgent;
  }

  return config;
}

// default instance only, axios.create() clients register this themselves
axios.interceptors.request.use(proxyRequestInterceptor);

export default async function createCustomProxyAgent(
  proxySettings: ProxySettings,
  forceIpv4First?: boolean
) {
  const defaultAgent = new Agent({
    keepAliveTimeout: 5000,
    connections: 50,
    connect: forceIpv4First ? { family: 4 } : undefined,
  });

  const skipUrl = (url: string | URL) => {
    const hostname =
      typeof url === 'string' ? new URL(url).hostname : url.hostname;

    if (proxySettings.bypassLocalAddresses && isLocalAddress(hostname)) {
      return true;
    }

    for (const address of proxySettings.bypassFilter.split(',')) {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) {
        continue;
      }

      if (trimmedAddress.startsWith('*')) {
        const domain = trimmedAddress.slice(1);
        if (hostname.endsWith(domain)) {
          return true;
        }
      } else if (hostname === trimmedAddress) {
        return true;
      }
    }

    return false;
  };

  const noProxyInterceptor = (
    dispatch: Dispatcher['dispatch']
  ): Dispatcher['dispatch'] => {
    return (opts, handler) => {
      return opts.origin && skipUrl(opts.origin)
        ? defaultAgent.dispatch(opts, handler)
        : dispatch(opts, handler);
    };
  };

  const token =
    proxySettings.user && proxySettings.password
      ? `Basic ${Buffer.from(
          `${proxySettings.user}:${proxySettings.password}`
        ).toString('base64')}`
      : undefined;

  try {
    const proxyUrl = `${proxySettings.useSsl ? 'https' : 'http'}://${
      proxySettings.hostname
    }:${proxySettings.port}`;
    const proxyAgent = new ProxyAgent({
      uri: proxyUrl,
      token,
      keepAliveTimeout: 5000,
      connections: 50,
      connect: forceIpv4First ? { family: 4 } : undefined,
    });

    setGlobalDispatcher(proxyAgent.compose(noProxyInterceptor));

    const agentOptions = {
      headers: token ? { 'proxy-authorization': token } : undefined,
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 5000,
      scheduling: 'lifo' as const,
      family: forceIpv4First ? 4 : undefined,
    };

    proxyState = {
      httpAgent: new HttpProxyAgent(proxyUrl, agentOptions),
      httpsAgent: new HttpsProxyAgent(proxyUrl, agentOptions),
      skipUrl,
    };
  } catch (e) {
    logger.error('Failed to connect to the proxy: ' + e.message, {
      label: 'Proxy',
    });
    setGlobalDispatcher(defaultAgent);
    proxyState = null;
    return;
  }

  try {
    await axios.head('https://www.google.com');
    logger.debug('HTTP(S) proxy connected successfully', { label: 'Proxy' });
  } catch (e) {
    logger.error(
      'Failed to connect to the proxy: ' + e.message + ': ' + e.cause,
      { label: 'Proxy' }
    );
  }
}

function isLocalAddress(hostname: string) {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return true;
  }

  const privateIpRanges = [
    /^10\./, // 10.x.x.x
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.x.x - 172.31.x.x
    /^192\.168\./, // 192.168.x.x
  ];
  if (privateIpRanges.some((regex) => regex.test(hostname))) {
    return true;
  }

  return false;
}

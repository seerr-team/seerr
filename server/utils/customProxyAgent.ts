import type { ProxySettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { Dispatcher } from 'undici';
import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici';

export let requestInterceptorFunction: (
  config: InternalAxiosRequestConfig
) => InternalAxiosRequestConfig;

export default async function createCustomProxyAgent(
  proxySettings: ProxySettings
) {
  const defaultAgent = new Agent({ keepAliveTimeout: 5000 });

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
    });

    setGlobalDispatcher(proxyAgent.compose(noProxyInterceptor));

    axios.defaults.httpAgent = new HttpProxyAgent(proxyUrl, {
      headers: token ? { 'proxy-authorization': token } : undefined,
    });
    axios.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl, {
      headers: token ? { 'proxy-authorization': token } : undefined,
    });

    requestInterceptorFunction = (config) => {
      const url = config.baseURL
        ? new URL(config.baseURL + (config.url || ''))
        : config.url;
      if (url && skipUrl(url)) {
        config.httpAgent = false;
        config.httpsAgent = false;
      }
      return config;
    };
    axios.interceptors.request.use(requestInterceptorFunction);
  } catch (e) {
    logger.error('Failed to connect to the proxy: ' + e.message, {
      label: 'Proxy',
    });
    setGlobalDispatcher(defaultAgent);
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
    setGlobalDispatcher(defaultAgent);
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

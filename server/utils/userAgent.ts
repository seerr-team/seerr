import { getAppVersion } from '@server/utils/appVersion';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

const USER_AGENT = `Seerr/${getAppVersion()}`;

export const getUserAgent = (): string => {
  return USER_AGENT;
};

export function userAgentRequestInterceptor(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  if (!config.headers.has('User-Agent')) {
    config.headers.set('User-Agent', getUserAgent());
  }

  return config;
}

// default instance only, axios.create() clients register this themselves
axios.interceptors.request.use(userAgentRequestInterceptor);

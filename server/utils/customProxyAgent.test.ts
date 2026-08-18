import ExternalAPI from '@server/api/externalapi';
import type { ProxySettings } from '@server/lib/settings';
import createCustomProxyAgent from '@server/utils/customProxyAgent';
import axios, {
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

class TestExternalAPI extends ExternalAPI {
  public constructor() {
    super('https://api.themoviedb.org/3', {}, {});
  }

  public async resolvedHttpsAgent(path = '/movie/123'): Promise<unknown> {
    let captured: InternalAxiosRequestConfig | undefined;
    this.axios.defaults.adapter = (config) => {
      captured = config;
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      } as AxiosResponse);
    };
    await this.axios.get(path);
    return captured?.httpsAgent;
  }
}

// constructed before any test configures the proxy, like BaseScanner.tmdb
const preProxyClient = new TestExternalAPI();

const proxySettings: ProxySettings = {
  enabled: true,
  hostname: 'proxy.test',
  port: 3128,
  useSsl: false,
  user: '',
  password: '',
  bypassFilter: '*.bypass.test',
  bypassLocalAddresses: true,
};

describe('proxy routing (construction-order independence)', () => {
  beforeEach(() => {
    mock.method(axios, 'head', async () => ({ status: 200 }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('routes a client constructed BEFORE the proxy was configured', async () => {
    await createCustomProxyAgent(proxySettings);
    const agent = await preProxyClient.resolvedHttpsAgent();
    assert.ok(
      agent instanceof HttpsProxyAgent,
      'client created before proxy setup must still route through the proxy'
    );
  });

  it('routes a client constructed AFTER the proxy was configured', async () => {
    await createCustomProxyAgent(proxySettings);
    const agent = await new TestExternalAPI().resolvedHttpsAgent();
    assert.ok(agent instanceof HttpsProxyAgent);
  });
});

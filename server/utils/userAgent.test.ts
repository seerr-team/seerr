import ExternalAPI from '@server/api/externalapi';
import { getUserAgent } from '@server/utils/userAgent';
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const captureRequest = (instance: AxiosInstance) => {
  const captured: { config?: InternalAxiosRequestConfig } = {};

  instance.defaults.adapter = (config) => {
    captured.config = config;
    return Promise.resolve({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    } as AxiosResponse);
  };

  return captured;
};

class TestExternalAPI extends ExternalAPI {
  public constructor() {
    super('https://api.themoviedb.org/3', {}, {});
  }

  public async sentUserAgent(
    config?: AxiosRequestConfig
  ): Promise<string | null | undefined> {
    const captured = captureRequest(this.axios);
    await this.axios.get('/movie/123', config);
    return captured.config?.headers.get('User-Agent') as string | null;
  }
}

describe('outbound user agent', () => {
  it('identifies the application by name and version', () => {
    assert.match(getUserAgent(), /^Seerr\/.+$/);
  });

  it('is sent by clients built on ExternalAPI', async () => {
    assert.equal(await new TestExternalAPI().sentUserAgent(), getUserAgent());
  });

  it('is sent on default axios calls', async () => {
    const previousAdapter = axios.defaults.adapter;
    const captured = captureRequest(axios);

    try {
      await axios.get('https://example.test/');
    } finally {
      axios.defaults.adapter = previousAdapter;
    }

    assert.equal(captured.config?.headers.get('User-Agent'), getUserAgent());
  });

  it('does not override a user agent set on the request', async () => {
    const sent = await new TestExternalAPI().sentUserAgent({
      headers: { 'user-agent': 'Custom/1.0' },
    });

    assert.equal(sent, 'Custom/1.0');
  });
});

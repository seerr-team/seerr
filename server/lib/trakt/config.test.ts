import { getSettings } from '@server/lib/settings';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAllowedTraktOrigins,
  getSafeTraktSettings,
  getTraktCallbackUrl,
  isAllowedTraktOrigin,
  isTraktConfigured,
} from './config';

// `NODE_ENV` is typed read-only, so assignment goes through Object.assign.
const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    Object.assign(process.env, { [key]: value });
  }
};

const withConfig = (
  config: {
    applicationUrl?: string;
    NODE_ENV?: string;
    TRAKT_DEV_ORIGIN?: string;
  },
  run: () => void
) => {
  const settings = getSettings();
  const previous = {
    applicationUrl: settings.main.applicationUrl,
    NODE_ENV: process.env.NODE_ENV,
    TRAKT_DEV_ORIGIN: process.env.TRAKT_DEV_ORIGIN,
  };

  settings.main.applicationUrl = config.applicationUrl ?? '';
  setEnv('NODE_ENV', config.NODE_ENV);
  setEnv('TRAKT_DEV_ORIGIN', config.TRAKT_DEV_ORIGIN);

  try {
    run();
  } finally {
    settings.main.applicationUrl = previous.applicationUrl;
    setEnv('NODE_ENV', previous.NODE_ENV);
    setEnv('TRAKT_DEV_ORIGIN', previous.TRAKT_DEV_ORIGIN);
  }
};

describe('Trakt configuration', () => {
  it('derives the callback and allowlist from the application URL', () => {
    withConfig({ applicationUrl: 'https://requests.example.com' }, () => {
      assert.deepEqual(getAllowedTraktOrigins(), [
        'https://requests.example.com',
      ]);
      assert.equal(isAllowedTraktOrigin('https://requests.example.com'), true);
      assert.equal(
        getTraktCallbackUrl(),
        'https://requests.example.com/api/v1/auth/trakt/callback'
      );
    });
  });

  it('reduces an application URL with a path to its origin', () => {
    withConfig({ applicationUrl: 'https://example.com/seerr/' }, () => {
      assert.deepEqual(getAllowedTraktOrigins(), ['https://example.com']);
      assert.equal(
        getTraktCallbackUrl(),
        'https://example.com/api/v1/auth/trakt/callback'
      );
    });
  });

  it('reports no origin or callback until an application URL is configured', () => {
    withConfig({ applicationUrl: '' }, () => {
      assert.deepEqual(getAllowedTraktOrigins(), []);
      assert.equal(isAllowedTraktOrigin('https://example.com'), false);
      assert.equal(getTraktCallbackUrl(), null);
    });
  });

  it('ignores an unparseable application URL rather than admitting it', () => {
    withConfig({ applicationUrl: 'not a url' }, () => {
      assert.deepEqual(getAllowedTraktOrigins(), []);
      assert.equal(getTraktCallbackUrl(), null);
    });
  });

  it('admits a development origin and returns the OAuth round-trip to it', () => {
    withConfig(
      {
        applicationUrl: 'https://requests.example.com',
        NODE_ENV: 'development',
        TRAKT_DEV_ORIGIN: 'http://localhost:5055/',
      },
      () => {
        assert.deepEqual(getAllowedTraktOrigins(), [
          'https://requests.example.com',
          'http://localhost:5055',
        ]);
        assert.equal(isAllowedTraktOrigin('http://localhost:5055'), true);
        assert.equal(
          getTraktCallbackUrl(),
          'http://localhost:5055/api/v1/auth/trakt/callback'
        );
      }
    );
  });

  it('ignores a development origin in production', () => {
    withConfig(
      {
        applicationUrl: 'https://requests.example.com',
        NODE_ENV: 'production',
        TRAKT_DEV_ORIGIN: 'http://localhost:5055',
      },
      () => {
        assert.deepEqual(getAllowedTraktOrigins(), [
          'https://requests.example.com',
        ]);
        assert.equal(isAllowedTraktOrigin('http://localhost:5055'), false);
        assert.equal(
          getTraktCallbackUrl(),
          'https://requests.example.com/api/v1/auth/trakt/callback'
        );
      }
    );
  });

  it('ignores a blank development origin outside production', () => {
    withConfig(
      {
        applicationUrl: 'https://requests.example.com',
        NODE_ENV: 'development',
        TRAKT_DEV_ORIGIN: '   ',
      },
      () => {
        assert.deepEqual(getAllowedTraktOrigins(), [
          'https://requests.example.com',
        ]);
        assert.equal(
          getTraktCallbackUrl(),
          'https://requests.example.com/api/v1/auth/trakt/callback'
        );
      }
    );
  });

  it('does not duplicate the origin when the development origin matches', () => {
    withConfig(
      {
        applicationUrl: 'https://requests.example.com',
        NODE_ENV: 'development',
        TRAKT_DEV_ORIGIN: 'https://requests.example.com',
      },
      () => {
        assert.deepEqual(getAllowedTraktOrigins(), [
          'https://requests.example.com',
        ]);
      }
    );
  });

  it('reports whether the client credentials are usable', () => {
    assert.equal(
      isTraktConfigured({ clientId: '', clientSecret: '' }),
      false,
      'empty credentials are not configured'
    );
    assert.equal(
      isTraktConfigured({ clientId: '   ', clientSecret: 'secret' }),
      false,
      'a blank client id is not configured'
    );
    assert.equal(
      isTraktConfigured({ clientId: 'client-id', clientSecret: '' }),
      false,
      'a missing secret is not configured'
    );
    assert.equal(
      isTraktConfigured({ clientId: 'client-id', clientSecret: 'secret' }),
      true
    );
  });

  it('redacts the secret and reports only whether it is configured', () => {
    withConfig({ applicationUrl: 'https://requests.example.com' }, () => {
      assert.deepEqual(
        getSafeTraktSettings({
          clientId: 'client-id',
          clientSecret: 'super-secret',
        }),
        {
          clientId: 'client-id',
          clientSecretConfigured: true,
          callbackUrl:
            'https://requests.example.com/api/v1/auth/trakt/callback',
        }
      );
    });
  });
});

import {
  discoverNetworksSchema,
  MAX_DISCOVER_NETWORKS,
} from '@server/constants/discover';
import { ApiErrorCode } from '@server/constants/error';
import {
  InvalidDiscoverNetworksError,
  sanitizeDiscoverNetworks,
  TooManyDiscoverNetworksError,
} from '@server/lib/discoverNetworks';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('sanitizeDiscoverNetworks', () => {
  it('stores an empty value as the built-in default', () => {
    assert.equal(sanitizeDiscoverNetworks(null), null);
    assert.equal(sanitizeDiscoverNetworks(''), null);
  });

  it('keeps a valid network list and drops duplicates', () => {
    const stored = sanitizeDiscoverNetworks(
      JSON.stringify([
        { id: 2697, name: ' AcornTV ', logoPath: '/logo.png' },
        { id: 2697, name: 'AcornTV again', logoPath: '/other.png' },
        { id: 4025, name: 'BritBox', logoPath: '/brit.png' },
      ])
    );

    assert.equal(
      stored,
      JSON.stringify([
        { id: 2697, name: 'AcornTV', logoPath: '/logo.png' },
        { id: 4025, name: 'BritBox', logoPath: '/brit.png' },
      ])
    );
  });

  it('rejects a list of more than 50 networks', () => {
    const networks = Array.from(
      { length: MAX_DISCOVER_NETWORKS + 1 },
      (_, index) => ({
        id: index + 1,
        name: `Network ${index + 1}`,
        logoPath: '/logo.png',
      })
    );

    assert.throws(
      () => sanitizeDiscoverNetworks(JSON.stringify(networks)),
      (error: unknown) => {
        assert.ok(error instanceof TooManyDiscoverNetworksError);
        assert.equal(error.message, ApiErrorCode.TooManyNetworks);
        return true;
      }
    );
  });

  it('keeps an empty list as an empty list, not the default', () => {
    assert.equal(sanitizeDiscoverNetworks('[]'), '[]');
  });

  it('accepts a real TMDB logo path', () => {
    const list = JSON.stringify([
      {
        id: 213,
        name: 'Netflix',
        logoPath: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.png',
      },
    ]);

    assert.equal(sanitizeDiscoverNetworks(list), list);
  });

  it('rejects logo paths that are not a single safe file name', () => {
    const invalidLogoPaths = [
      'logo.png',
      '/',
      '/.',
      '/..',
      '/.hidden.png',
      '/folder/logo.png',
      '/logo.png?x=1',
      `/${'a'.repeat(101)}`,
    ];

    for (const logoPath of invalidLogoPaths) {
      assert.throws(
        () =>
          sanitizeDiscoverNetworks(
            JSON.stringify([{ id: 1, name: 'Netflix', logoPath }])
          ),
        InvalidDiscoverNetworksError,
        `expected ${logoPath} to be rejected`
      );
    }
  });

  it('rejects networks with an invalid id or name', () => {
    const invalidNetworks = [
      { id: 0, name: 'Netflix', logoPath: '/logo.png' },
      { id: 1.5, name: 'Netflix', logoPath: '/logo.png' },
      { id: 1, name: '   ', logoPath: '/logo.png' },
      { id: 1, name: 'a'.repeat(201), logoPath: '/logo.png' },
    ];

    for (const network of invalidNetworks) {
      assert.throws(
        () => sanitizeDiscoverNetworks(JSON.stringify([network])),
        InvalidDiscoverNetworksError
      );
    }
  });

  it('uses the invalid list code for other errors', () => {
    assert.throws(
      () => sanitizeDiscoverNetworks('not-json'),
      (error: unknown) => {
        assert.ok(error instanceof InvalidDiscoverNetworksError);
        assert.ok(!(error instanceof TooManyDiscoverNetworksError));
        assert.equal(error.message, ApiErrorCode.InvalidNetworkList);
        return true;
      }
    );
  });

  it('gives the client the same trimmed, deduplicated list as the server', () => {
    const result = discoverNetworksSchema.safeParse([
      { id: 1, name: ' Netflix ', logoPath: '/logo.png' },
      { id: 1, name: 'Netflix again', logoPath: '/other.png' },
    ]);

    assert.ok(result.success);
    assert.deepEqual(result.data, [
      { id: 1, name: 'Netflix', logoPath: '/logo.png' },
    ]);
  });

  it('rejects a list that is not network data', () => {
    assert.throws(
      () => sanitizeDiscoverNetworks('not-json'),
      InvalidDiscoverNetworksError
    );
    assert.throws(
      () =>
        sanitizeDiscoverNetworks(
          JSON.stringify([{ id: 1, name: 'Netflix', logoPath: 'https://evil' }])
        ),
      InvalidDiscoverNetworksError
    );
  });

  it('counts the limit after deduplicating duplicate network ids', () => {
    const networks = [
      ...Array.from({ length: 50 }, (_, index) => ({
        id: index + 1,
        name: `Network ${index + 1}`,
        logoPath: '/logo.png',
      })),
      {
        id: 1,
        name: 'Duplicate Network',
        logoPath: '/duplicate.png',
      },
    ];

    const stored = sanitizeDiscoverNetworks(JSON.stringify(networks));

    assert.equal(
      stored,
      JSON.stringify(
        Array.from({ length: 50 }, (_, index) => ({
          id: index + 1,
          name: `Network ${index + 1}`,
          logoPath: '/logo.png',
        }))
      )
    );
  });

  it('rejects more than 50 unique networks even if duplicates are present', () => {
    const networks = [
      ...Array.from({ length: 50 }, (_, index) => ({
        id: index + 1,
        name: `Network ${index + 1}`,
        logoPath: '/logo.png',
      })),
      {
        id: 51,
        name: 'Network 51',
        logoPath: '/logo51.png',
      },
      {
        id: 51,
        name: 'Duplicate #51',
        logoPath: '/logo51-dup.png',
      },
    ];

    assert.throws(
      () => sanitizeDiscoverNetworks(JSON.stringify(networks)),
      TooManyDiscoverNetworksError
    );
  });
});

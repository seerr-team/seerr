import { resolveMonitorNewItems } from '@server/utils/sonarr';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('resolveMonitorNewItems', () => {
  it('preserves the all setting', () => {
    assert.equal(
      resolveMonitorNewItems({
        setting: 'all',
        requestedSeasons: [1],
        availableSeasons: [1, 2, 3],
      }),
      'all'
    );
  });

  it('preserves the none setting', () => {
    assert.equal(
      resolveMonitorNewItems({
        setting: 'none',
        requestedSeasons: [3],
        availableSeasons: [1, 2, 3],
      }),
      'none'
    );
  });

  it('does not monitor new seasons when the latest season is not requested', () => {
    assert.equal(
      resolveMonitorNewItems({
        setting: 'latest',
        requestedSeasons: [1, 2],
        availableSeasons: [0, 1, 2, 3],
      }),
      'none'
    );
  });

  it('monitors new seasons when the latest season is requested', () => {
    assert.equal(
      resolveMonitorNewItems({
        setting: 'latest',
        requestedSeasons: [1, 3],
        availableSeasons: [0, 1, 2, 3],
      }),
      'all'
    );
  });

  it('does not treat specials as the latest season', () => {
    assert.equal(
      resolveMonitorNewItems({
        setting: 'latest',
        requestedSeasons: [0],
        availableSeasons: [0, 1],
      }),
      'none'
    );
  });

  it('does not monitor new seasons when no regular seasons are available', () => {
    assert.equal(
      resolveMonitorNewItems({
        setting: 'latest',
        requestedSeasons: [0],
        availableSeasons: [0],
      }),
      'none'
    );
  });
});

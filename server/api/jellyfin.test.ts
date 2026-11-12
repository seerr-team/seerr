import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { AxiosInstance } from 'axios';

import JellyfinAPI from '@server/api/jellyfin';

function buildJellyfin(): JellyfinAPI {
  return new JellyfinAPI('http://localhost:8096');
}

function getAxios(jellyfin: JellyfinAPI): AxiosInstance {
  return (jellyfin as unknown as { axios: AxiosInstance }).axios;
}

describe('JellyfinAPI getEpisodes', () => {
  afterEach(() => mock.restoreAll());

  it('filters special and virtual episodes', async () => {
    const jellyfin = buildJellyfin();
    mock.method(getAxios(jellyfin), 'get', async () => ({
      data: {
        Items: [
          {
            Id: 'ep1',
            SeasonId: 'season-1',
            LocationType: 'FileSystem',
          },
          {
            Id: 'ep-special',
            SeasonId: 'season-0',
            LocationType: 'FileSystem',
          },
          {
            Id: 'ep2',
            SeasonId: 'season-1',
            LocationType: 'FileSystem',
          },
          {
            Id: 'ep-virtual',
            SeasonId: 'season-1',
            LocationType: 'Virtual',
          },
        ],
      },
    }));

    const episodes = await jellyfin.getEpisodes('test-series', 'season-1');
    assert.deepStrictEqual(
      episodes.map((episode) => episode.Id),
      ['ep1', 'ep2']
    );
  });

  it('keeps episodes without a SeasonId', async () => {
    const jellyfin = buildJellyfin();
    mock.method(getAxios(jellyfin), 'get', async () => ({
      data: {
        Items: [{ Id: 'ep1', LocationType: 'FileSystem' }],
      },
    }));

    const episodes = await jellyfin.getEpisodes('test-series', 'season-1');
    assert.deepStrictEqual(
      episodes.map((episode) => episode.Id),
      ['ep1']
    );
  });
});

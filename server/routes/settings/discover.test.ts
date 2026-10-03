import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DiscoverSliderType,
  MAX_DISCOVER_NETWORKS,
} from '@server/constants/discover';
import { ApiErrorCode } from '@server/constants/error';
import { getRepository } from '@server/datasource';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import discoverSettingRoutes from './discover';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/discover', discoverSettingRoutes);
  return app;
}

const app: Express = createApp();

setupTestDb();

const networkList = (length: number) =>
  Array.from({ length }, (_, index) => ({
    id: index + 1,
    name: `Network ${index + 1}`,
    logoPath: '/logo.png',
  }));

async function saveNetworksSlider() {
  return getRepository(DiscoverSlider).save(
    new DiscoverSlider({
      type: DiscoverSliderType.NETWORKS,
      isBuiltIn: true,
      enabled: true,
      order: 0,
    })
  );
}

describe('POST /discover network list', () => {
  it('returns the too many networks code for more than 50 networks', async () => {
    const slider = await saveNetworksSlider();

    const response = await request(app)
      .post('/discover')
      .send([
        {
          id: slider.id,
          enabled: true,
          data: JSON.stringify(networkList(MAX_DISCOVER_NETWORKS + 1)),
        },
      ]);

    assert.equal(response.status, 400);
    assert.equal(response.body.message, ApiErrorCode.TooManyNetworks);

    const stored = await getRepository(DiscoverSlider).findOneByOrFail({
      id: slider.id,
    });
    assert.equal(stored.data ?? null, null);
  });

  it('returns the invalid list code for other invalid network lists', async () => {
    const slider = await saveNetworksSlider();

    const response = await request(app)
      .post('/discover')
      .send([
        {
          id: slider.id,
          enabled: true,
          data: JSON.stringify([
            { id: 1, name: 'Netflix', logoPath: 'https://evil' },
          ]),
        },
      ]);

    assert.equal(response.status, 400);
    assert.equal(response.body.message, ApiErrorCode.InvalidNetworkList);
  });

  it('saves a custom list and clears it again with null', async () => {
    const slider = await saveNetworksSlider();
    const repository = getRepository(DiscoverSlider);
    const list = JSON.stringify(networkList(2));

    const saved = await request(app)
      .post('/discover')
      .send([{ id: slider.id, enabled: true, data: list }]);

    assert.equal(saved.status, 200);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider.id })).data,
      list
    );

    const cleared = await request(app)
      .put(`/discover/${slider.id}`)
      .send({ data: null });

    assert.equal(cleared.status, 200);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider.id })).data ?? null,
      null
    );
  });

  it('keeps an empty list and an empty value as different things', async () => {
    const slider = await saveNetworksSlider();
    const repository = getRepository(DiscoverSlider);

    const emptyList = await request(app)
      .post('/discover')
      .send([{ id: slider.id, enabled: true, data: '[]' }]);

    assert.equal(emptyList.status, 200);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider.id })).data,
      '[]'
    );

    const emptyValue = await request(app)
      .post('/discover')
      .send([{ id: slider.id, enabled: true, data: '' }]);

    assert.equal(emptyValue.status, 200);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider.id })).data ?? null,
      null
    );
  });

  it('keeps the existing list when a later save is rejected', async () => {
    const slider = await saveNetworksSlider();
    const repository = getRepository(DiscoverSlider);
    const list = JSON.stringify(networkList(2));

    await request(app)
      .post('/discover')
      .send([{ id: slider.id, enabled: true, data: list }]);

    const rejected = await request(app)
      .post('/discover')
      .send([
        {
          id: slider.id,
          enabled: true,
          data: JSON.stringify(networkList(MAX_DISCOVER_NETWORKS + 1)),
        },
      ]);

    assert.equal(rejected.status, 400);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider.id })).data,
      list
    );

    const rejectedPut = await request(app)
      .put(`/discover/${slider.id}`)
      .send({ data: 'not-json' });

    assert.equal(rejectedPut.status, 400);
    assert.equal(rejectedPut.body.message, ApiErrorCode.InvalidNetworkList);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider.id })).data,
      list
    );
  });

  it('returns the saved sliders from POST', async () => {
    const slider = await saveNetworksSlider();

    const response = await request(app)
      .post('/discover')
      .send([
        {
          id: slider.id,
          enabled: true,
          data: JSON.stringify([
            { id: 1, name: ' Netflix ', logoPath: '/logo.png' },
            { id: 1, name: 'Netflix again', logoPath: '/other.png' },
          ]),
        },
      ]);

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, slider.id);
    assert.equal(
      response.body[0].data,
      JSON.stringify([{ id: 1, name: 'Netflix', logoPath: '/logo.png' }])
    );
  });

  it('ignores data for built-in sliders that are not Networks', async () => {
    const repository = getRepository(DiscoverSlider);
    const slider = await repository.save(
      new DiscoverSlider({
        type: DiscoverSliderType.TRENDING,
        isBuiltIn: true,
        enabled: true,
        order: 0,
      })
    );

    const posted = await request(app)
      .post('/discover')
      .send([
        {
          id: slider.id,
          enabled: false,
          title: 'Changed',
          type: DiscoverSliderType.NETWORKS,
          data: JSON.stringify(networkList(2)),
        },
      ]);

    assert.equal(posted.status, 200);

    const put = await request(app)
      .put(`/discover/${slider.id}`)
      .send({ data: JSON.stringify(networkList(2)) });

    assert.equal(put.status, 200);

    const stored = await repository.findOneByOrFail({ id: slider.id });
    assert.equal(stored.type, DiscoverSliderType.TRENDING);
    assert.equal(stored.enabled, false);
    assert.equal(stored.data ?? null, null);
    assert.equal(stored.title ?? null, null);
  });

  it('does not persist earlier sliders when a later networks payload is invalid', async () => {
    const repository = getRepository(DiscoverSlider);

    const first = await repository.save(
      new DiscoverSlider({
        type: DiscoverSliderType.NETWORKS,
        isBuiltIn: true,
        enabled: true,
        order: 0,
        data: JSON.stringify([
          { id: 1, name: 'Netflix', logoPath: '/logo.png' },
        ]),
      })
    );

    const second = await repository.save(
      new DiscoverSlider({
        type: DiscoverSliderType.NETWORKS,
        isBuiltIn: true,
        enabled: true,
        order: 1,
        data: JSON.stringify([{ id: 2, name: 'HBO', logoPath: '/hbo.png' }]),
      })
    );

    const response = await request(app)
      .post('/discover')
      .send([
        {
          id: first.id,
          enabled: true,
          data: JSON.stringify([
            { id: 1, name: 'Updated Netflix', logoPath: '/logo.png' },
          ]),
        },
        {
          id: second.id,
          enabled: true,
          data: JSON.stringify([
            { id: 1, name: 'Bad Network', logoPath: 'https://evil' },
          ]),
        },
      ]);

    assert.equal(response.status, 400);
    assert.equal(response.body.message, ApiErrorCode.InvalidNetworkList);

    const freshFirst = await repository.findOneByOrFail({ id: first.id });
    const freshSecond = await repository.findOneByOrFail({ id: second.id });

    assert.equal(
      freshFirst.data,
      JSON.stringify([{ id: 1, name: 'Netflix', logoPath: '/logo.png' }])
    );
    assert.equal(
      freshSecond.data,
      JSON.stringify([{ id: 2, name: 'HBO', logoPath: '/hbo.png' }])
    );
  });

  it('saves all valid sliders in a batch together', async () => {
    const slider1 = await saveNetworksSlider();
    const slider2 = await saveNetworksSlider();

    const response = await request(app)
      .post('/discover')
      .send([
        { id: slider1.id, enabled: true, data: JSON.stringify(networkList(2)) },
        { id: slider2.id, enabled: true, data: JSON.stringify(networkList(3)) },
      ]);

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);

    const repository = getRepository(DiscoverSlider);
    assert.equal(
      (await repository.findOneByOrFail({ id: slider1.id })).data,
      JSON.stringify(networkList(2))
    );
    assert.equal(
      (await repository.findOneByOrFail({ id: slider2.id })).data,
      JSON.stringify(networkList(3))
    );
  });
});

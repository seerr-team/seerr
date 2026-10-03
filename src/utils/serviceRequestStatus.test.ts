import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type MediaServiceStatus from '@server/entity/MediaServiceStatus';
import type { ServiceCommonServer } from '@server/interfaces/api/serviceInterfaces';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getServiceStatusItems,
  getStandardServiceId,
  isCoveredByServiceStatus,
} from './serviceRequestStatus';

const server = (
  id: number,
  overrides: Partial<ServiceCommonServer> = {}
): ServiceCommonServer => ({
  id,
  name: `Radarr ${id}`,
  is4k: false,
  isDefault: false,
  activeProfileId: 1,
  activeDirectory: '/movies',
  activeTags: [],
  ...overrides,
});

const serviceStatus = (
  serviceId: number,
  status: MediaStatus,
  seasonStatuses: Record<number, MediaStatus> | null = null
) =>
  ({
    serviceId,
    serviceType: 'radarr',
    status,
    seasonStatuses,
    downloadStatus: [],
  }) as unknown as MediaServiceStatus;

const pendingRequest = (serverId: number) =>
  ({
    isServiceRequest: true,
    serverId,
    status: MediaRequestStatus.PENDING,
  }) as MediaRequest;

const itemIds = (items: ReturnType<typeof getServiceStatusItems>) =>
  items.map((item) => [item.server.id, item.status]);

describe('getServiceStatusItems', () => {
  it('ignores servers without a button label', () => {
    const items = getServiceStatusItems({
      services: [
        server(0, { isDefault: true }),
        server(1, { is4k: true, isDefault: true }),
      ],
      serviceStatuses: [
        serviceStatus(0, MediaStatus.AVAILABLE),
        serviceStatus(1, MediaStatus.AVAILABLE),
      ],
    });

    assert.deepStrictEqual(items, []);
  });

  it('returns labelled servers with a known status', () => {
    const items = getServiceStatusItems({
      services: [
        server(0, { buttonLabel: 'ITA' }),
        server(1, { buttonLabel: 'ENG' }),
        server(2),
      ],
      serviceStatuses: [
        serviceStatus(0, MediaStatus.AVAILABLE),
        serviceStatus(1, MediaStatus.UNKNOWN),
        serviceStatus(2, MediaStatus.AVAILABLE),
      ],
    });

    assert.deepStrictEqual(itemIds(items), [[0, MediaStatus.AVAILABLE]]);
  });

  it('adds pending service requests for labelled servers', () => {
    const items = getServiceStatusItems({
      services: [server(0, { buttonLabel: 'ITA' }), server(1)],
      requests: [pendingRequest(0), pendingRequest(1)],
    });

    assert.deepStrictEqual(itemIds(items), [[0, MediaStatus.PENDING]]);
  });

  it('uses season statuses when a season is given', () => {
    const items = getServiceStatusItems({
      services: [server(0, { buttonLabel: 'ITA' })],
      serviceStatuses: [
        serviceStatus(0, MediaStatus.PARTIALLY_AVAILABLE, {
          1: MediaStatus.AVAILABLE,
        }),
      ],
      requests: [pendingRequest(0)],
      seasonNumber: 1,
    });

    assert.deepStrictEqual(itemIds(items), [[0, MediaStatus.AVAILABLE]]);
  });
});

describe('standard status coverage', () => {
  const services = [
    server(0, { isDefault: true, buttonLabel: 'ITA' }),
    server(1, { buttonLabel: 'ENG' }),
    server(2, { is4k: true, isDefault: true }),
  ];

  it('treats the standard status as covered when its server has a service badge', () => {
    const items = getServiceStatusItems({
      services,
      serviceStatuses: [serviceStatus(0, MediaStatus.AVAILABLE)],
    });

    assert.strictEqual(
      isCoveredByServiceStatus(
        items,
        getStandardServiceId(services, {}, false)
      ),
      true
    );
    assert.strictEqual(
      isCoveredByServiceStatus(items, getStandardServiceId(services, {}, true)),
      false
    );
  });

  it('uses the server the media was sent to over the default one', () => {
    const items = getServiceStatusItems({
      services,
      serviceStatuses: [serviceStatus(0, MediaStatus.AVAILABLE)],
    });

    assert.strictEqual(
      isCoveredByServiceStatus(
        items,
        getStandardServiceId(services, { serviceId: 1 }, false)
      ),
      false
    );
  });
});

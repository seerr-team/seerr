import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type MediaServiceStatus from '@server/entity/MediaServiceStatus';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import type { ServiceCommonServer } from '@server/interfaces/api/serviceInterfaces';
import type { DownloadingItem } from '@server/lib/downloadtracker';

export const getLabelledServices = <T extends { buttonLabel?: string | null }>(
  services?: T[]
): T[] => (services ?? []).filter((service) => !!service.buttonLabel?.trim());

export interface ServiceStatusItem {
  server: ServiceCommonServer;
  status: MediaStatus;
  downloadItem: DownloadingItem[];
}

export const getServiceStatusItems = ({
  services,
  serviceStatuses,
  requests,
  seasonNumber,
}: {
  services?: ServiceCommonServer[];
  serviceStatuses?: MediaServiceStatus[];
  requests?: NonFunctionProperties<MediaRequest>[];
  seasonNumber?: number;
}): ServiceStatusItem[] => {
  const labelledServices = getLabelledServices(services);

  const items = (serviceStatuses ?? [])
    .map((ss): ServiceStatusItem | null => {
      const server = labelledServices.find((s) => s.id === ss.serviceId);
      if (!server) return null;
      const status =
        seasonNumber !== undefined
          ? ss.seasonStatuses?.[seasonNumber]
          : ss.status;
      if (
        status === undefined ||
        status === MediaStatus.UNKNOWN ||
        status === MediaStatus.DELETED
      ) {
        return null;
      }
      const downloadItem =
        seasonNumber === undefined ? (ss.downloadStatus ?? []) : [];
      return { server, status, downloadItem };
    })
    .filter((x): x is ServiceStatusItem => x !== null);

  if (seasonNumber === undefined) {
    for (const request of requests ?? []) {
      if (
        !request.isServiceRequest ||
        request.status !== MediaRequestStatus.PENDING ||
        items.some(({ server }) => server.id === request.serverId)
      ) {
        continue;
      }
      const server = labelledServices.find((s) => s.id === request.serverId);
      if (server) {
        items.push({ server, status: MediaStatus.PENDING, downloadItem: [] });
      }
    }
  }

  return items;
};

export const getStandardServiceId = (
  services: ServiceCommonServer[] | undefined,
  media: Pick<Media, 'serviceId' | 'serviceId4k'> | undefined,
  is4k: boolean
): number | undefined =>
  (is4k ? media?.serviceId4k : media?.serviceId) ??
  services?.find((s) => s.isDefault && s.is4k === is4k)?.id;

export const isCoveredByServiceStatus = (
  items: ServiceStatusItem[],
  serviceId: number | undefined
): boolean =>
  serviceId !== undefined &&
  items.some(({ server }) => server.id === serviceId);

export const getServiceSlotStatus = (
  request?: NonFunctionProperties<MediaRequest>
): { status?: MediaStatus; downloadItem?: DownloadingItem[] } => {
  if (!request?.isServiceRequest) {
    return {};
  }

  const serviceStatus = request.media.serviceStatuses?.find(
    (ss) => ss.serviceId === request.serverId
  );

  const status =
    serviceStatus && serviceStatus.status !== MediaStatus.UNKNOWN
      ? serviceStatus.status
      : request.status === MediaRequestStatus.COMPLETED
        ? MediaStatus.AVAILABLE
        : request.status === MediaRequestStatus.APPROVED
          ? MediaStatus.PROCESSING
          : MediaStatus.PENDING;

  return { status, downloadItem: serviceStatus?.downloadStatus ?? [] };
};

export const getMediaServiceStatus = (
  media: Media | undefined,
  serviceId: number
): { status: MediaStatus; downloadItem: DownloadingItem[] } => {
  const serviceStatus = media?.serviceStatuses?.find(
    (ss) => ss.serviceId === serviceId
  );

  if (
    serviceStatus &&
    serviceStatus.status !== MediaStatus.UNKNOWN &&
    serviceStatus.status !== MediaStatus.DELETED
  ) {
    return {
      status: serviceStatus.status,
      downloadItem: serviceStatus.downloadStatus ?? [],
    };
  }

  const request = media?.requests?.find(
    (r) =>
      r.isServiceRequest &&
      r.serverId === serviceId &&
      (r.status === MediaRequestStatus.PENDING ||
        r.status === MediaRequestStatus.APPROVED)
  );

  return {
    status: !request
      ? MediaStatus.UNKNOWN
      : request.status === MediaRequestStatus.PENDING
        ? MediaStatus.PENDING
        : MediaStatus.PROCESSING,
    downloadItem: [],
  };
};

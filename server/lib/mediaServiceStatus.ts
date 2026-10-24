import type { MediaStatus } from '@server/constants/media';
import type MediaServiceStatus from '@server/entity/MediaServiceStatus';
import type { Repository } from 'typeorm';

export interface MediaServiceStatusValues {
  mediaId: number;
  serviceId: number;
  serviceType: 'radarr' | 'sonarr';
  status: MediaStatus;
  externalServiceId?: number | null;
  externalServiceSlug?: string | null;
  seasonStatuses?: Record<number, MediaStatus> | null;
}

export async function upsertMediaServiceStatus(
  repo: Repository<MediaServiceStatus>,
  values: MediaServiceStatusValues,
  overwrite: (keyof MediaServiceStatusValues)[] = [
    'status',
    'externalServiceId',
    'externalServiceSlug',
  ]
): Promise<void> {
  await repo
    .createQueryBuilder()
    .insert()
    .values({
      ...values,
      externalServiceId: values.externalServiceId ?? null,
      externalServiceSlug: values.externalServiceSlug ?? null,
      seasonStatuses: values.seasonStatuses ?? null,
    })
    .orUpdate(overwrite as string[], ['mediaId', 'serviceId'])
    .updateEntity(false)
    .execute();
}

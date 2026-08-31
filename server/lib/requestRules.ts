import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type Season from '@server/entity/Season';

export function isRequestStillBlocking({
  requestStatus,
  isOwnRequest,
  targetAvailable,
}: {
  requestStatus: MediaRequestStatus;
  isOwnRequest: boolean;
  targetAvailable: boolean;
}): boolean {
  if (requestStatus === MediaRequestStatus.DECLINED) {
    return false;
  }
  if (requestStatus === MediaRequestStatus.COMPLETED) {
    return isOwnRequest && targetAvailable;
  }
  return isOwnRequest || !targetAvailable;
}

export function isSeasonNumberRequestable(
  seasonNumber: number,
  enableSpecialEpisodes: boolean
): boolean {
  return enableSpecialEpisodes || seasonNumber !== 0;
}
export function getBlockedSeasonNumbers({
  seasons,
  requests,
  userId,
  is4k,
  ignoreSeasonNumbers,
}: {
  seasons: Season[];
  requests: MediaRequest[];
  userId?: number;
  is4k: boolean;
  ignoreSeasonNumbers?: number[];
}): number[] {
  const availableSeasonNumbers = new Set(
    seasons
      .filter(
        (season) =>
          season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE
      )
      .map((season) => season.seasonNumber)
  );

  return requests
    .filter((request) => request.is4k === is4k)
    .reduce((blockedSeasons, request) => {
      return [
        ...blockedSeasons,
        ...request.seasons
          .filter(
            (season) => !ignoreSeasonNumbers?.includes(season.seasonNumber)
          )
          .map((sr) => sr.seasonNumber)
          .filter((seasonNumber) =>
            isRequestStillBlocking({
              requestStatus: request.status,
              isOwnRequest: request.requestedBy.id === userId,
              targetAvailable: availableSeasonNumbers.has(seasonNumber),
            })
          ),
      ];
    }, [] as number[]);
}

import type { SonarrSeries } from '@server/api/servarr/sonarr';
import type { SonarrSettings } from '@server/lib/settings';

export const resolveMonitorNewItems = ({
  setting,
  requestedSeasons,
  availableSeasons,
}: {
  setting: SonarrSettings['monitorNewItems'];
  requestedSeasons: number[];
  availableSeasons: number[];
}): SonarrSeries['monitorNewItems'] => {
  if (setting !== 'latest') {
    return setting;
  }

  const latestSeason = Math.max(
    ...availableSeasons.filter((seasonNumber) => seasonNumber > 0)
  );

  return Number.isFinite(latestSeason) &&
    requestedSeasons.includes(latestSeason)
    ? 'all'
    : 'none';
};

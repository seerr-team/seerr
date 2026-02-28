import { getSettings } from '@server/lib/settings';

export function isIgnoredEdition(editionTitle?: string): boolean {
  if (!editionTitle) return false;

  const ignoredEditions = getSettings().plex.ignoredEditions ?? [];
  return ignoredEditions.some(
    (e) => editionTitle.toLowerCase().trim() === e.toLowerCase().trim()
  );
}

export function isIgnoredEpisode(
  episodeTitle: string | undefined,
  seasonNumber: number,
  episodeNumber: number
): boolean {
  const settings = getSettings();
  const ignoredTitles = settings.plex.ignoredEpisodeTitles ?? [];
  const filterMode = settings.plex.ignoredEpisodeFilterMode ?? 'season';

  if (ignoredTitles.length === 0) return false;

  const titleMatch = ignoredTitles.some(
    (t) => episodeTitle?.toLowerCase().trim() === t.toLowerCase().trim()
  );
  if (!titleMatch) return false;

  if (filterMode === 'any') return true;
  if (filterMode === 'season') return seasonNumber === 0;
  if (filterMode === 'seasonAndEpisode')
    return seasonNumber === 0 && episodeNumber === 0;

  return false;
}

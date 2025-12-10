import type { NextApiRequest, NextApiResponse } from 'next';
import { getSonarrUpcoming } from '@app/lib/sonarr';
import { getRadarrUpcoming } from '@app/lib/radarr';



type Event = {
  title: string;
  start: string;
  type: 'tv' | 'movie';
  status: string;
  description?: string;
  episodeTitle?: string;
  episodeCode?: string;
  seriesId?: number;
  tmdbId?: number;
  fanart?: string;
  year?: number;
  seriesOverview?: string;
};

function groupTvEpisodes(episodes: Event[]): Event[] {
  const grouped: { [key: string]: Event[] } = {};

  for (const ep of episodes) {
    const dateOnly = ep.start.split('T')[0]; // Strip time
    const key = `${ep.title}_${dateOnly}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ep);
  }

  return Object.entries(grouped).map(([key, group]) => {
    if (group.length === 1) return group[0];

    const [title, date] = key.split('_');
    const parsedStart = new Date(date).toISOString();

    // Build range episodeCode (e.g. S03E01–E09 or S03E01–S04E02)
    const first = group[0];
    const last = group[group.length - 1];
    let episodeCode = '';

    const matchFirst = first.episodeCode?.match(/^S(\d+)E(\d+)$/);
    const matchLast = last.episodeCode?.match(/^S(\d+)E(\d+)$/);

    if (matchFirst && matchLast) {
      const s1 = matchFirst[1].padStart(2, '0');
      const e1 = matchFirst[2].padStart(2, '0');
      const s2 = matchLast[1].padStart(2, '0');
      const e2 = matchLast[2].padStart(2, '0');

      episodeCode = s1 === s2 ? `S${s1}E${e1}–E${e2}` : `S${s1}E${e1}–S${s2}E${e2}`;
    }

    return {
      title,
      start: parsedStart,
      type: 'tv',
      status: 'grouped',
      seriesId: first.seriesId,
      tmdbId: first.tmdbId,
      fanart: first.fanart,
      year: first.year,
      seriesOverview: first.seriesOverview,
      episodeCode,
      episodes: group.map((e) => ({
        episodeCode: e.episodeCode,
        episodeTitle: e.episodeTitle,
        status: e.status,
        description: e.description,
      })),
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[calendar API] Fetching Sonarr...');
    const sonarrData = await getSonarrUpcoming();
    console.log(`[calendar API] Sonarr returned ${sonarrData.length} events`);

    // ✅ Enrich with tmdbId from series if needed
    const enrichedSonarr = sonarrData.map((item) => ({
      ...item,
      tmdbId: item.tmdbId || item.series?.tmdbId || null,
    }));

    const groupedTv = groupTvEpisodes(enrichedSonarr);
    console.log(`[calendar API] Grouped to ${groupedTv.length} TV events`);

    console.log('[calendar API] Fetching Radarr...');
    const radarrData = await getRadarrUpcoming();
    console.log(`[calendar API] Radarr returned ${radarrData.length} events`);

    const events = [...groupedTv, ...radarrData];
    console.log(`[calendar API] Final events length: ${events.length}`);
    res.status(200).json(events);
  } catch (error: any) {
    console.error('[calendar API] Failed to load:', error.message || error);
    res.status(500).json({ error: 'Failed to load calendar data' });
  }
}

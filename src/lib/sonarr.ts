import axios from 'axios';
import fs from 'fs';
import path from 'path';

function loadSettings() {
  const filePath = path.resolve(process.cwd(), 'config/settings.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export async function getSonarrUpcoming() {
  const settings = loadSettings();

  const activeInstances = settings.sonarr.filter(
    (s: any) => s.isDefault || s.syncEnabled
  );

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);

  const end = new Date(today);
  end.setDate(end.getDate() + 60);

  const allResults = await Promise.all(
    activeInstances.map(async (instance: any) => {
      const scheme = instance.useSsl ? 'https' : 'http';
      const baseUrl = instance.baseUrl || '';
      const calendarUrl = `${scheme}://${instance.hostname}:${instance.port}${baseUrl}/api/v3/calendar?start=${start.toISOString()}&end=${end.toISOString()}`;

      const seriesUrl = `${scheme}://${instance.hostname}:${instance.port}${baseUrl}/api/v3/series`;

      const headers = {
        'X-Api-Key': instance.apiKey,
      };

      const [episodesResp, seriesResp] = await Promise.all([
        axios.get(calendarUrl, { headers }),
        axios.get(seriesUrl, { headers }),
      ]);

      const seriesMap = new Map();
      for (const series of seriesResp.data) {
        seriesMap.set(series.id, series);
      }

      return episodesResp.data.map((episode: any) => {
        const series = seriesMap.get(episode.seriesId);

return {
  title: series?.title || '',
  year: series?.year,
  episodeCode: `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`,
  episodeTitle: episode.title,
  start: episode.airDateUtc,
  status: episode.hasFile ? 'Available' : 'Requested',
  type: 'tv',
  tmdbId: series?.tmdbId || null, // ✅ fixed line
  fanart: series?.images?.find((img: any) => img.coverType === 'fanart')?.remoteUrl,
  seriesId: series?.id,
  seriesOverview: series?.overview || '',
  description: episode.overview || '',
};
      });
    })
  );

  return allResults.flat();
}

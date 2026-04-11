import ExternalAPI from '@server/api/externalapi';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import { JSDOM } from 'jsdom';

export interface FlixPatrolListItem {
  rank: number;
  title: string;
  flixpatrolUrl?: string;
  type: 'movie' | 'tv';
}

export interface FlixPatrolTitleDetails {
  title: string;
  year?: number;
}

export interface FlixPatrolPlatformData {
  date: string;
  movies: FlixPatrolListItem[];
  tvShows: FlixPatrolListItem[];
  overall: FlixPatrolListItem[];
}

class FlixPatrolAPI extends ExternalAPI {
  constructor() {
    super(
      'https://flixpatrol.com',
      {},
      {
        headers: {
          'Content-Type': undefined,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
        nodeCache: cacheManager.getCache('flixpatrol').data,
      }
    );
  }

  public async getPlatformTop10(
    platform: string,
    region = 'united-kingdom'
  ): Promise<FlixPatrolPlatformData> {
    const regionsToTry = region !== 'world' ? [region, 'world'] : ['world'];
    const datesToTry = [0, 1];

    for (const r of regionsToTry) {
      for (const daysBack of datesToTry) {
        const date = this.getDateString(daysBack);
        const endpoint = `/top10/${platform}/${r}/${date}/`;

        try {
          const html = await this.get<string>(endpoint);
          const parsed = this.parsePlatformChartHtml(html);

          if (parsed.movies.length > 0 || parsed.tvShows.length > 0) {
            return parsed;
          }
        } catch (error) {
          logger.warn('Failed to fetch FlixPatrol platform chart', {
            label: 'FlixPatrol API',
            platform,
            region: r,
            date,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    throw new Error(
      `Unable to retrieve FlixPatrol chart for ${platform} in ${region}`
    );
  }

  public async getTitleDetails(
    flixpatrolUrl?: string
  ): Promise<FlixPatrolTitleDetails | undefined> {
    if (!flixpatrolUrl) {
      return undefined;
    }

    const endpoint = this.toEndpoint(flixpatrolUrl);
    const html = await this.get<string>(endpoint);
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const jsonLd = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    )
      .map((node) => node.textContent?.trim())
      .find(Boolean);

    if (jsonLd) {
      try {
        const parsed = JSON.parse(jsonLd) as {
          name?: string;
          dateCreated?: string;
        };

        return {
          title:
            parsed.name?.trim() ||
            document.querySelector('h1')?.textContent?.trim() ||
            '',
          year: parsed.dateCreated
            ? Number(parsed.dateCreated.slice(0, 4))
            : undefined,
        };
      } catch (error) {
        logger.debug('Failed to parse FlixPatrol title JSON-LD', {
          label: 'FlixPatrol API',
          flixpatrolUrl,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const title = document.querySelector('h1')?.textContent?.trim();
    const pageText = document.body.textContent ?? '';
    const yearMatch = pageText.match(/\b(\d{4})\b/);

    return title
      ? {
          title,
          year: yearMatch ? Number(yearMatch[1]) : undefined,
        }
      : undefined;
  }

  private parsePlatformChartHtml(html: string): FlixPatrolPlatformData {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const title = document.querySelector('title')?.textContent ?? '';

    const isMoviesHeading = (text: string) =>
      (text.includes('top movies on') ||
        (text.includes('top 10 movies') && !text.includes('kids'))) &&
      !text.includes('by country');

    const isTvHeading = (text: string) =>
      (text.includes('top tv shows on') ||
        (text.includes('top 10 tv shows') && !text.includes('kids'))) &&
      !text.includes('by country');

    const isOverallHeading = (text: string) =>
      text.includes('top 10 overall') || text.includes('top 10 in ');

    const result: FlixPatrolPlatformData = {
      date: this.extractDateFromTitle(title),
      movies: [],
      tvShows: [],
      overall: [],
    };

    // Walk headings and tables in DOM order so each table is paired with
    // the heading immediately preceding it, not by position in a filtered list.
    // This handles platforms like Amazon Prime that have an "Overall" table
    // before the separate Movies/TV sections.
    type SectionType = 'movie' | 'tv' | 'overall' | null;
    let currentSection: SectionType = null;

    for (const el of document.querySelectorAll('h2, h3, table.card-table')) {
      if (el.tagName === 'H2' || el.tagName === 'H3') {
        const text = el.textContent?.toLowerCase() ?? '';
        if (isMoviesHeading(text)) {
          currentSection = 'movie';
        } else if (isTvHeading(text)) {
          currentSection = 'tv';
        } else if (isOverallHeading(text)) {
          currentSection = 'overall';
        } else {
          currentSection = null;
        }
      } else if (currentSection !== null) {
        // table.card-table — only consume tables with a reasonable row count
        if (el.querySelectorAll('tr').length > 20) {
          continue;
        }
        const items = this.parseCardTable(el);
        if (currentSection === 'movie') {
          result.movies = items.map((item) => ({
            ...item,
            type: 'movie' as const,
          }));
        } else if (currentSection === 'tv') {
          result.tvShows = items.map((item) => ({
            ...item,
            type: 'tv' as const,
          }));
        } else if (currentSection === 'overall') {
          result.overall = items;
        }
        // Each heading owns exactly one table
        currentSection = null;
      }
    }

    return result;
  }

  private parseCardTable(table: Element): FlixPatrolListItem[] {
    const items: (FlixPatrolListItem | null)[] = Array.from(
      table.querySelectorAll('tr')
    ).map((row, index) => {
      const cells = row.querySelectorAll('td');

      if (cells.length < 3) {
        return null;
      }

      const rankText = cells[0]?.textContent?.trim() ?? '';
      const rankMatch = rankText.match(/(\d+)/);

      // World format: title is an <a> in cells[1]
      // Country format: cells[1] is a trend indicator; title is plain text in cells[2]
      const titleLink = cells[1]?.querySelector('a');
      const title =
        titleLink?.textContent?.trim() || cells[2]?.textContent?.trim() || '';

      if (!title) {
        return null;
      }

      return {
        rank: rankMatch ? Number(rankMatch[1]) : index + 1,
        title,
        flixpatrolUrl: titleLink?.getAttribute('href') ?? undefined,
        type: 'movie' as const,
      };
    });

    return items.filter((item): item is FlixPatrolListItem => item !== null);
  }

  private extractDateFromTitle(title: string): string {
    const match = title.match(/on (.+?) • FlixPatrol/);

    return match ? match[1] : 'Unknown';
  }

  private getDateString(daysBack = 0): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysBack);

    return date.toISOString().slice(0, 10);
  }

  private toEndpoint(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    }

    return url.startsWith('/') ? url : `/${url}`;
  }
}

export default FlixPatrolAPI;

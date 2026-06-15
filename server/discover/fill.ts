import { PAGE_SIZE } from '@server/discover/planBuilder';
import { applyPostFilter } from '@server/discover/postFilter';
import type {
  HonestPage,
  ListResult,
  PostFilterSpec,
} from '@shared/discover/types';

interface TmdbPage<T> {
  results: T[];
  total_pages: number;
  total_results: number;
}

/**
 * Fetch TMDB discover pages and return a result whose pagination tells the
 * truth about what the user will actually see.
 *
 * When no post-filter is active (common case), exactly one TMDB call is made
 * and the response is honest.
 *
 * When a post-filter IS active (language exclude, TV country exclude), TMDB's
 * total_results is a pre-filter count. To fill the requested page with real
 * results we may need to over-fetch — up to `maxOverFetch` extra pages. This
 * is a bounded trade of correctness for calls.
 */
export async function fillPage<T extends ListResult>(
  fetch: (page: number) => Promise<TmdbPage<T>>,
  postFilter: PostFilterSpec,
  requestedPage: number,
  maxOverFetch = 3
): Promise<HonestPage<T>> {
  const hasPostFilter =
    !!postFilter.excludeLanguages?.length ||
    !!postFilter.excludeCountries?.length;

  if (!hasPostFilter) {
    const res = await fetch(requestedPage);
    return {
      page: requestedPage,
      totalPages: res.total_pages,
      totalResults: res.total_results,
      results: res.results,
      paginationIsEstimate: false,
    };
  }

  const collected: T[] = [];
  let tmdbPage = requestedPage;
  let extra = 0;
  let lastTotalPages = 0;
  let lastTotalResults = 0;
  let anyDropped = false;

  while (collected.length < PAGE_SIZE) {
    const res = await fetch(tmdbPage);
    lastTotalPages = res.total_pages;
    lastTotalResults = res.total_results;

    const { filtered, dropped } = applyPostFilter(res.results, postFilter);
    if (dropped > 0) anyDropped = true;
    collected.push(...filtered);

    if (extra >= maxOverFetch) break;
    if (tmdbPage >= res.total_pages) break;
    tmdbPage++;
    extra++;
  }

  return {
    page: requestedPage,
    totalPages: lastTotalPages,
    totalResults: lastTotalResults,
    results: collected.slice(0, PAGE_SIZE),
    paginationIsEstimate: anyDropped,
  };
}

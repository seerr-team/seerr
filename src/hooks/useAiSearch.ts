import { useUser } from '@app/hooks/useUser';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import axios from 'axios';
import useSWR from 'swr';

export interface AiSearchInterpretation {
  discoverParams: {
    genres?: string[];
    year_from?: number;
    year_to?: number;
    original_language?: string;
    sort_by?: string;
    min_rating?: number;
    keywords?: string[];
  };
  suggestedTitles: {
    title: string;
    year?: number;
    type: string;
    rationale: string;
  }[];
}

interface AiSearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: (MovieResult | TvResult | PersonResult)[];
  query: string;
  interpretation?: AiSearchInterpretation;
}

/**
 * Fetch AI-powered natural-language search results. Pass `null` as the query
 * to disable fetching (e.g. when AI mode is off).
 *
 * Unlike useDiscover, this is a single non-paginated POST (the LLM interprets
 * the whole query in one shot), so there is no infinite-scroll loading.
 *
 * The SWR key is a plain string (cache-scoped per query); the query is sent
 * via the POST body through a closure, avoiding SWR array-key serialization.
 */
const useAiSearch = (query: string | null) => {
  // Include the user id in the cache key so history-aware results aren't
  // shared across accounts.
  const { user } = useUser();
  const { data, error, isValidating } = useSWR<AiSearchResponse>(
    query ? `ai-search-${user?.id ?? 'anon'}-${query}` : null,
    async () => {
      const response = await axios.post('/api/v1/ai/search', {
        query,
        options: { includeHistory: true },
      });
      return response.data;
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    error,
    isLoading: !!query && !data && !error,
    isValidating,
  };
};

export default useAiSearch;

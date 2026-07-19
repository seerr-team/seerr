import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import useAiSearch, {
  type AiSearchInterpretation,
} from '@app/hooks/useAiSearch';
import useDiscover from '@app/hooks/useDiscover';
import defineMessages from '@app/utils/defineMessages';
import { SparklesIcon } from '@heroicons/react/24/solid';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import ErrorPage from 'next/error';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Search', {
  search: 'Search',
  searchresults: 'Search Results',
  aiSearch: 'AI Search',
  aiSearchTip:
    'Describe what you want to watch in natural language (e.g. "90s psychological thrillers")',
  aiInterpretation: 'AI interpretation',
  aiThinking: 'Asking the AI…',
  aiDisabled: 'AI search is disabled. Enable it in Settings → AI Settings.',
  aiError:
    'AI search failed. It may be disabled, or the AI provider is unreachable.',
  aiNoResults: 'No AI results for this query. Try rephrasing.',
  interpGenres: 'Genres',
  interpYears: 'Years',
  interpLanguage: 'Language',
  interpMinRating: 'Min Rating',
  interpKeywords: 'Keywords',
});

// Build a human-readable summary of how the AI parsed the query.
const formatInterpretation = (
  interp: AiSearchInterpretation | undefined,
  labels: {
    genres: string;
    years: string;
    language: string;
    minRating: string;
    keywords: string;
  }
): string | null => {
  if (!interp?.discoverParams) return null;
  const p = interp.discoverParams;
  const parts: string[] = [];
  if (p.genres?.length) parts.push(`${labels.genres}: ${p.genres.join(', ')}`);
  if (p.year_from || p.year_to) {
    parts.push(`${labels.years}: ${p.year_from ?? '…'}–${p.year_to ?? '…'}`);
  }
  if (p.original_language)
    parts.push(`${labels.language}: ${p.original_language}`);
  if (p.min_rating) parts.push(`${labels.minRating}: ${p.min_rating}`);
  if (p.keywords?.length)
    parts.push(`${labels.keywords}: ${p.keywords.join(', ')}`);
  return parts.length ? parts.join(' · ') : null;
};

const Search = () => {
  const intl = useIntl();
  const router = useRouter();
  const query = (router.query.query as string) ?? '';
  const [aiMode, setAiMode] = useState(false);

  // Regular keyword search (always wired up so toggling back is instant).
  const regular = useDiscover<MovieResult | TvResult | PersonResult>(
    '/api/v1/search',
    { query },
    { hideAvailable: false, hideBlocklisted: false }
  );

  // AI natural-language search (only fetches when AI mode is on).
  const ai = useAiSearch(aiMode && query.length > 0 ? query : null);

  const interpretation = formatInterpretation(ai.data?.interpretation, {
    genres: intl.formatMessage(messages.interpGenres),
    years: intl.formatMessage(messages.interpYears),
    language: intl.formatMessage(messages.interpLanguage),
    minRating: intl.formatMessage(messages.interpMinRating),
    keywords: intl.formatMessage(messages.interpKeywords),
  });

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.search)} />
      <div className="mb-5 mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Header>{intl.formatMessage(messages.searchresults)}</Header>
        <div className="flex items-center gap-2">
          <Button
            buttonType={aiMode ? 'primary' : 'default'}
            onClick={() => setAiMode((v) => !v)}
            title={intl.formatMessage(messages.aiSearchTip)}
          >
            <SparklesIcon className="h-5 w-5" />
            <span>{intl.formatMessage(messages.aiSearch)}</span>
          </Button>
        </div>
      </div>

      {aiMode ? (
        <>
          {ai.isLoading && (
            <div className="flex items-center justify-center gap-3 py-10 text-gray-400">
              <LoadingSpinner />
              <span>{intl.formatMessage(messages.aiThinking)}</span>
            </div>
          )}
          {ai.error && !ai.isLoading && (
            <div className="py-10 text-center text-gray-400">
              {intl.formatMessage(messages.aiError)}
            </div>
          )}
          {ai.data && (
            <>
              {interpretation && (
                <div className="mb-4 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-sm text-gray-300">
                  <span className="font-semibold text-indigo-300">
                    {intl.formatMessage(messages.aiInterpretation)}:
                  </span>{' '}
                  {interpretation}
                </div>
              )}
              <ListView
                items={ai.data.results}
                isEmpty={false}
                isLoading={false}
                isReachingEnd
                onScrollBottom={() => {}}
              />
              {ai.data.results.length === 0 && (
                <div className="py-6 text-center text-gray-400">
                  {intl.formatMessage(messages.aiNoResults)}
                </div>
              )}
            </>
          )}
        </>
      ) : regular.error ? (
        <ErrorPage statusCode={500} />
      ) : (
        <ListView
          items={regular.titles}
          isEmpty={regular.isEmpty}
          isLoading={
            regular.isLoadingInitialData ||
            (regular.isLoadingMore && (regular.titles?.length ?? 0) > 0)
          }
          isReachingEnd={regular.isReachingEnd}
          onScrollBottom={regular.fetchMore}
        />
      )}
    </>
  );
};

export default Search;

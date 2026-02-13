import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import useFilterByLanguages from '@app/hooks/useFilterByLanguages';
import Error from '@app/pages/_error';
import { FilterByLanguage } from '@app/types/filters';
import defineMessages from '@app/utils/defineMessages';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover', {
  trending: 'Trending',
});

const Trending = () => {
  const intl = useIntl();
  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<MovieResult | TvResult | PersonResult>(
    '/api/v1/discover/trending'
  );

  const filteredTitles = useFilterByLanguages({
    titles,
    movie: true,
    tv: true,
    key: FilterByLanguage.TRENDING,
  });

  if (error) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.trending)} />
      <div className="mb-5 mt-1">
        <Header>{intl.formatMessage(messages.trending)}</Header>
      </div>
      <ListView
        items={filteredTitles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData ||
          (isLoadingMore && (filteredTitles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default Trending;

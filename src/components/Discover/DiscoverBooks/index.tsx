import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import type { FilterOptions } from '@app/components/Discover/constants';
import { prepareFilterValues } from '@app/components/Discover/constants';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { BookResult } from '@server/models/Search';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverBooks', {
  discoverbooks: 'Books',
});

const DiscoverBooks = () => {
  const intl = useIntl();
  const router = useRouter();

  const preparedFilters = prepareFilterValues(router.query);

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<BookResult, unknown, FilterOptions>(
    '/api/v1/discover/books',
    preparedFilters
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  const title = intl.formatMessage(messages.discoverbooks);

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{title}</Header>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default DiscoverBooks;

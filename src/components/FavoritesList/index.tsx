import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import defineMessages from '@app/utils/defineMessages';
import type { FavoriteItem } from '@server/interfaces/api/discoverInterfaces';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.FavoritesList', {
  favorites: 'Favorites',
  emptyfavorites:
    'No favorites yet. Add media with the heart button on any movie or series page.',
});

const FavoritesList = () => {
  const intl = useIntl();

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    mutate,
  } = useDiscover<FavoriteItem>('/api/v1/favorites', undefined, {
    hideAvailable: false,
    hideBlocklisted: false,
  });

  useEffect(() => {
    mutate?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !titles?.length) {
    return null;
  }

  const title = intl.formatMessage(messages.favorites);

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-5 mt-8 flex items-center gap-3">
        <h2 className="truncate text-2xl font-bold leading-7 text-gray-100 sm:overflow-visible sm:text-4xl sm:leading-9">
          <span className="text-overseerr">{title}</span>
        </h2>
      </div>
      {isEmpty && (
        <div className="mt-64 w-full text-center text-2xl text-gray-400">
          {intl.formatMessage(messages.emptyfavorites)}
        </div>
      )}
      <ListView
        favoriteItems={isEmpty ? undefined : titles}
        isEmpty={false}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
        mutateParent={mutate}
      />
    </>
  );
};

export default FavoritesList;

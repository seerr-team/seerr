import Spinner from '@app/assets/spinner.svg';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { TrashIcon } from '@heroicons/react/24/solid';
import type { RecentSearchesItem } from '@server/interfaces/api/discoverInterfaces';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';

const messages = defineMessages('components.Discover.DiscoverHistory', {
  discoverhistory: 'Recent Searches',
  activefilters:
    '{count, plural, one {# Active Filter} other {# Active Filters}}',
  sortPopularityAsc: 'Popularity Ascending',
  sortPopularityDesc: 'Popularity Descending',
  sortFirstAirDateAsc: 'First Air Date Ascending',
  sortFirstAirDateDesc: 'First Air Date Descending',
  sortTmdbRatingAsc: 'TMDB Rating Ascending',
  sortTmdbRatingDesc: 'TMDB Rating Descending',
  sortTitleAsc: 'Title (A-Z) Ascending',
  sortTitleDesc: 'Title (Z-A) Descending',
  clearSearches: 'Clear Searches',
  searchesCleared: 'Recent searches cleared successfully!',
  recentSearchesError: 'Something went wrong. Please try again.',
  recentSearchesAleadyClear: 'Recent searches already cleared.',
});

const DiscoverRecentSearches = () => {
  const intl = useIntl();
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { addToast } = useToasts();

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    mutate,
  } = useDiscover<RecentSearchesItem>('/api/v1/discover/recentSearches');

  // Refresh data when component mounts to get latest updates
  useEffect(() => {
    if (mutate) {
      mutate();
    }
  }, [mutate]);

  if (error) {
    return <Error statusCode={500} />;
  }

  const title = intl.formatMessage(messages.discoverhistory);

  const onClickClearRecentSearchesBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await axios.delete(`/api/v1/recentsearches/`);

      addToast(
        <span>
          {intl.formatMessage(messages.searchesCleared, {
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'info', autoDismiss: true }
      );
    } catch (e) {
      if (e.status == 401) {
        addToast(intl.formatMessage(messages.recentSearchesAleadyClear), {
          appearance: 'warning',
          autoDismiss: true,
        });
      } else {
        addToast(intl.formatMessage(messages.recentSearchesError), {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    } finally {
      setIsUpdating(false);
      // Refresh the data after clearing to update the UI
      if (mutate) {
        mutate();
      }
    }
  };

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-4 flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{title}</Header>
        <div className="mt-2 flex flex-grow flex-col sm:flex-row lg:flex-grow-0">
          <div className="mb-2 flex flex-grow sm:mb-0 lg:flex-grow-0">
            <Button onClick={onClickClearRecentSearchesBtn} className="w-full">
              {isUpdating ? <Spinner /> : <TrashIcon />}
              <span>{intl.formatMessage(messages.clearSearches)}</span>
            </Button>
          </div>
        </div>
      </div>
      <ListView
        recentSearchItems={titles}
        isEmpty={isEmpty}
        isReachingEnd={isReachingEnd}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        onScrollBottom={fetchMore}
        mutateParent={mutate}
      />
    </>
  );
};

export default DiscoverRecentSearches;

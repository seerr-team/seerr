import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import { useUser } from '@app/hooks/useUser';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { WatchlistItem } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverWatchlist', {
  discoverwatchlist: 'Your Watchlist',
  watchlist: 'Plex Watchlist',
});

const DiscoverWatchlist = () => {
  const intl = useIntl();
  const router = useRouter();
  const { user } = useUser({
    id: Number(router.query.userId),
  });
  const { user: currentUser } = useUser();

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    mutate,
  } = useDiscover<WatchlistItem>(
    `/api/v1/${
      router.pathname.startsWith('/profile')
        ? `user/${currentUser?.id}`
        : router.query.userId
        ? `user/${router.query.userId}`
        : 'discover'
    }/watchlist`
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  const title = intl.formatMessage(
    router.query.userId ? messages.watchlist : messages.discoverwatchlist
  );

  return (
    <>
      <PageTitle
        title={[title, router.query.userId ? user?.displayName : '']}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            router.query.userId ? (
              <Link href={`/users/${user?.id}`} className="hover:underline">
                {user?.displayName}
              </Link>
            ) : (
              ''
            )
          }
        >
          {title}
        </Header>
      </div>
      <ListView
        plexItems={titles}
        isEmpty={isEmpty}
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

export default DiscoverWatchlist;

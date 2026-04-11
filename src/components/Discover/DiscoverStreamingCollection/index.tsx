import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { StreamingCollection } from '@server/interfaces/api/discoverInterfaces';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.Discover.DiscoverStreamingCollection',
  {
    loading: 'Loading Collection',
  }
);

interface DiscoverStreamingCollectionProps {
  mediaType: 'movie' | 'tv';
}

const DiscoverStreamingCollection = ({
  mediaType,
}: DiscoverStreamingCollectionProps) => {
  const router = useRouter();
  const intl = useIntl();

  const collectionId =
    typeof router.query.collectionId === 'string'
      ? router.query.collectionId
      : undefined;
  const endpoint = collectionId
    ? `/api/v1/discover/${
        mediaType === 'movie' ? 'movies' : 'tv'
      }/collection/${collectionId}`
    : null;
  const { data: collection, error } = useSWR<StreamingCollection>(endpoint);

  if (error) {
    const statusCode = error?.response?.status ?? 500;
    return <ErrorPage statusCode={statusCode} />;
  }

  const title = collection?.title ?? intl.formatMessage(messages.loading);

  return (
    <>
      <PageTitle title={title} />
      <div className="mb-5 mt-1">
        <Header>{title}</Header>
      </div>
      <ListView
        plexItems={collection?.items}
        isEmpty={!!collection && collection.items.length === 0}
        isLoading={!!collectionId && !collection}
        isReachingEnd
        onScrollBottom={() => undefined}
      />
    </>
  );
};

export default DiscoverStreamingCollection;

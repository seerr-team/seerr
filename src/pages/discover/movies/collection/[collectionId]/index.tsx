import DiscoverStreamingCollection from '@app/components/Discover/DiscoverStreamingCollection';
import type { NextPage } from 'next';

const DiscoverMovieCollectionPage: NextPage = () => {
  return <DiscoverStreamingCollection mediaType="movie" />;
};

export default DiscoverMovieCollectionPage;

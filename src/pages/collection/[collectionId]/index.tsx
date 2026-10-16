import CollectionDetails from '@app/components/CollectionDetails';
import { getHostAndPort } from '@app/utils/urlHelper';
import type { Collection } from '@server/models/Collection';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

interface CollectionPageProps {
  collection?: Collection;
}

const CollectionPage: NextPage<CollectionPageProps> = ({ collection }) => {
  return <CollectionDetails collection={collection} />;
};

export const getServerSideProps: GetServerSideProps<
  CollectionPageProps
> = async (ctx) => {
  const response = await axios.get<Collection>(
    `http://${getHostAndPort()}/api/v1/collection/${ctx.query.collectionId}`,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );

  return {
    props: {
      collection: response.data,
    },
  };
};

export default CollectionPage;

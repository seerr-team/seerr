import CollectionDetails from '@app/components/CollectionDetails';
import { withBasePath } from '@app/utils/basePath';
import { getHostAndPort } from '@app/utils/urlHelper';
import type { Collection } from '@server/models/Collection';
import axios from 'axios';
import type { NextPage } from 'next';

interface CollectionPageProps {
  collection?: Collection;
}

const CollectionPage: NextPage<CollectionPageProps> = ({ collection }) => {
  return <CollectionDetails collection={collection} />;
};

CollectionPage.getInitialProps = async (ctx) => {
  const apiPath = `/api/v1/collection/${ctx.query.collectionId}`;
  const response = await axios.get<Collection>(
    ctx.req ? `http://${getHostAndPort()}${withBasePath(apiPath)}` : apiPath,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );

  return {
    collection: response.data,
  };
};

export default CollectionPage;

import TvDetails from '@app/components/TvDetails';
import { withBasePath } from '@app/utils/basePath';
import { getHostAndPort } from '@app/utils/urlHelper';
import type { TvDetails as TvDetailsType } from '@server/models/Tv';
import axios from 'axios';
import type { NextPage } from 'next';

interface TvPageProps {
  tv?: TvDetailsType;
}

const TvPage: NextPage<TvPageProps> = ({ tv }) => {
  return <TvDetails tv={tv} />;
};

TvPage.getInitialProps = async (ctx) => {
  const apiPath = `/api/v1/tv/${ctx.query.tvId}`;
  const response = await axios.get<TvDetailsType>(
    ctx.req ? `http://${getHostAndPort()}${withBasePath(apiPath)}` : apiPath,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );

  return {
    tv: response.data,
  };
};

export default TvPage;

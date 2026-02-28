import TvDetails from '@app/components/TvDetails';
import type { TvDetails as TvDetailsType } from '@server/models/Tv';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

interface TvPageProps {
  tv?: TvDetailsType;
}

const TvPage: NextPage<TvPageProps> = ({ tv }) => {
  return <TvDetails tv={tv} />;
};

export const getServerSideProps: GetServerSideProps<TvPageProps> = async (
  ctx
) => {
  try {
    const response = await axios.get<TvDetailsType>(
      `http://${process.env.HOST || 'localhost'}:${
        process.env.PORT || 5055
      }/api/v1/tv/${ctx.query.tvId}`,
      {
        headers: ctx.req?.headers?.cookie
          ? { cookie: ctx.req.headers.cookie }
          : undefined,
      }
    );

    return {
      props: {
        tv: response.data,
      },
    };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      ctx.res.statusCode = 403;
      return { props: {} };
    }
    throw e;
  }
};

export default TvPage;

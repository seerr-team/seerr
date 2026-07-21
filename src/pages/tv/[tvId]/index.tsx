import TvDetails from '@app/components/TvDetails';
import { getAuthHeaders } from '@app/utils/serverSidePropsHelpers';
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
  const response = await axios.get<TvDetailsType>(
    `http://${process.env.HOST || 'localhost'}:${
      process.env.PORT || 5055
    }/api/v1/tv/${ctx.query.tvId}`,
    {
      headers: getAuthHeaders(ctx),
    }
  );

  return {
    props: {
      tv: response.data,
    },
  };
};

export default TvPage;

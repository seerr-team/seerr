import SeriesDetails from '@app/components/SeriesDetails';
import type { Series } from '@server/models/Series';
import type { GetServerSideProps, NextPage } from 'next';

interface SeriesPageProps {
  series?: Series;
}

const SeriesPage: NextPage<SeriesPageProps> = ({ series }) => {
  return <SeriesDetails series={series} />;
};

export const getServerSideProps: GetServerSideProps<SeriesPageProps> = async (
  ctx
) => {
  const res = await fetch(
    `http://localhost:${process.env.PORT || 5055}/api/v1/series/${
      ctx.query.seriesId
    }`,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );
  if (!res.ok) throw new Error();
  const series: Series = await res.json();

  return {
    props: {
      series,
    },
  };
};

export default SeriesPage;

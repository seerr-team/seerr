import MusicDetails from '@app/components/MusicDetails';
import type { MusicDetails as MusicDetailsType } from '@server/models/Music';
import type { GetServerSideProps, NextPage } from 'next';

interface MusicPageProps {
  music?: MusicDetailsType;
}

const MusicPage: NextPage<MusicPageProps> = ({ music }) => {
  return <MusicDetails music={music} />;
};

export const getServerSideProps: GetServerSideProps<MusicPageProps> = async (
  ctx
) => {
  const res = await fetch(
    `http://localhost:${process.env.PORT || 5055}/api/v1/music/${
      ctx.query.musicId
    }`,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );
  if (!res.ok) throw new Error();
  const music: MusicDetailsType = await res.json();

  return {
    props: {
      music,
    },
  };
};

export default MusicPage;

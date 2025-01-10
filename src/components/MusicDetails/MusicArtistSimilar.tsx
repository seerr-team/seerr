import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MusicDetails } from '@server/models/Music';
import type { ArtistResult } from '@server/models/Search';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MusicDetails', {
  similarArtists: 'Similar Artists',
});

const MusicArtistSimilar = () => {
  const intl = useIntl();
  const router = useRouter();
  const { data: musicData } = useSWR<MusicDetails>(
    `/api/v1/music/${router.query.musicId}`
  );

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
  } = useDiscover<ArtistResult & { id: number }>(
    `/api/v1/music/${router.query.musicId}/similar`
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.similarArtists),
          musicData?.artist.artistName,
        ]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link
              href={`/music/${musicData?.mbId}`}
              className="hover:underline"
            >
              {musicData?.artist.artistName}
            </Link>
          }
        >
          {intl.formatMessage(messages.similarArtists)}
        </Header>
      </div>
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isReachingEnd={isReachingEnd}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default MusicArtistSimilar;

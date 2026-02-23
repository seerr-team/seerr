import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import type { MusicDetails } from '@server/models/Music';
import type { AlbumResult } from '@server/models/Search';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MusicDetails', {
  discography: "{artistName}'s discography",
  byartist: 'by',
});

interface ReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  artistThumb?: string;
  posterPath?: string;
  mediaType: 'album';
  'artist-credit'?: { name: string }[];
  score?: number;
  mediaInfo?: {
    status?: number;
    downloadStatus?: unknown[];
    watchlists?: unknown[];
  };
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
}

interface ArtistResponse {
  artist: {
    releaseGroups: ReleaseGroup[];
    pagination: Pagination;
  };
}

const MusicArtistDiscography = () => {
  const intl = useIntl();
  const router = useRouter();
  const musicId = router.query.musicId as string;
  const [page, setPage] = useState(1);
  const [allReleaseGroups, setAllReleaseGroups] = useState<ReleaseGroup[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { data: musicData, error: musicError } = useSWR<MusicDetails>(
    musicId ? `/api/v1/music/${musicId}` : null
  );

  const refreshInterval = musicData
    ? refreshIntervalHelper(
        {
          downloadStatus: musicData.mediaInfo?.downloadStatus,
          downloadStatus4k: undefined,
        },
        15000
      )
    : 0;

  useSWR<MusicDetails>(musicId ? `/api/v1/music/${musicId}` : null, {
    refreshInterval,
    dedupingInterval: 0,
  });

  const { data: artistData, error: artistError } = useSWR<ArtistResponse>(
    musicId ? `/api/v1/music/${musicId}/artist?page=${page}&pageSize=20` : null
  );

  useEffect(() => {
    if (
      artistData?.artist?.releaseGroups &&
      artistData.artist.releaseGroups.length > 0
    ) {
      setAllReleaseGroups((prev) => {
        const uniqueIds = new Set(prev.map((item) => item.id));
        const newItems = artistData.artist.releaseGroups.filter(
          (item: ReleaseGroup) => !uniqueIds.has(item.id)
        );
        return [...prev, ...newItems];
      });

      const { pagination } = artistData.artist;
      setHasMore(pagination.page < pagination.totalPages);
      setIsLoadingMore(false);
    }
  }, [artistData]);

  const mainArtistName =
    musicData?.artist.name.split(/[&,]|\sfeat\./)[0].trim() ?? '';

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setPage((prevPage) => prevPage + 1);
    }
  };

  if (!musicData && !musicError) {
    return <LoadingSpinner />;
  }

  if (musicError || artistError) {
    return <Error statusCode={404} />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.discography, {
            artistName: mainArtistName,
          }),
          mainArtistName,
        ]}
      />
      <div className="mt-1 mb-5">
        <Header
          subtext={
            <Link
              href={`/music/${musicData?.mbId}`}
              className="hover:underline"
            >
              {`${musicData?.title} ${intl.formatMessage(
                messages.byartist
              )} ${mainArtistName}`}
            </Link>
          }
        >
          {intl.formatMessage(messages.discography, {
            artistName: mainArtistName,
          })}
        </Header>
      </div>
      <ListView
        items={allReleaseGroups as unknown as AlbumResult[]}
        isEmpty={allReleaseGroups.length === 0}
        isLoading={!artistData}
        onScrollBottom={loadMore}
      />
    </>
  );
};

export default MusicArtistDiscography;

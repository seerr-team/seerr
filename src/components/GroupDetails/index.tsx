import Ellipsis from '@app/assets/ellipsis.svg';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ImageFader from '@app/components/Common/ImageFader';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { ArtistDetailsType } from '@server/models/Artist';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import TruncateMarkup from 'react-truncate-markup';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

interface Album {
  id: string;
  title: string;
  type: string;
  releasedate: string;
  images: { Url: string }[];
  mediaInfo?: {
    status?: number;
    downloadStatus?: unknown[];
    watchlists?: unknown[];
  };
}

interface DiscographyResponse {
  page: number;
  pageInfo: {
    total: number;
    totalPages: number;
  };
  results: Album[];
}

const messages = defineMessages('components.GroupDetails', {
  type: 'Type: {type}',
  genres: 'Genres: {genres}',
  albums: 'Albums',
  singles: 'Singles',
  eps: 'EPs',
  other: 'Other',
  overview: 'Overview',
  status: 'Status: {status}',
  loadmore: 'Load More',
});

const GroupDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const [showBio, setShowBio] = useState(false);

  const {
    data: albumData,
    size: albumSize,
    setSize: setAlbumSize,
    isValidating: isLoadingAlbums,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      `/api/v1/group/${router.query.groupId}/discography?page=${
        index + 1
      }&type=Album`,
    { revalidateFirstPage: false }
  );

  const {
    data: singlesData,
    size: singlesSize,
    setSize: setSinglesSize,
    isValidating: isLoadingSingles,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      `/api/v1/group/${router.query.groupId}/discography?page=${
        index + 1
      }&type=Single`,
    { revalidateFirstPage: false }
  );

  const {
    data: epsData,
    size: epsSize,
    setSize: setEpsSize,
    isValidating: isLoadingEps,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      `/api/v1/group/${router.query.groupId}/discography?page=${
        index + 1
      }&type=EP`,
    { revalidateFirstPage: false }
  );

  const {
    data: otherData,
    size: otherSize,
    setSize: setOtherSize,
    isValidating: isLoadingOther,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      `/api/v1/group/${router.query.groupId}/discography?page=${
        index + 1
      }&type=Other`,
    { revalidateFirstPage: false }
  );

  const { data, error } = useSWR<ArtistDetailsType>(
    `/api/v1/group/${router.query.groupId}`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  const groupAttributes: string[] = [];

  if (data.type) {
    groupAttributes.push(
      intl.formatMessage(messages.type, {
        type: data.type,
      })
    );
  }

  if (data.genres?.length > 0) {
    groupAttributes.push(
      intl.formatMessage(messages.genres, {
        genres: data.genres.join(', '),
      })
    );
  }

  if (data.status) {
    const capitalizeFirstLetter = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

    groupAttributes.push(
      intl.formatMessage(messages.status, {
        status: capitalizeFirstLetter(data.status),
      })
    );
  }

  const renderAlbumSection = (
    title: string,
    albums: Album[],
    isLoading: boolean,
    isReachingEnd: boolean,
    onLoadMore: () => void
  ) => {
    if (!albums?.length && !isLoading) return null;

    return (
      <>
        <div className="slider-header">
          <div className="slider-title">
            <span>{title}</span>
          </div>
        </div>
        <ul className="cards-vertical">
          {albums?.map((album) => (
            <li key={`album-${album.id}`}>
              <TitleCard
                id={album.id}
                isAddedToWatchlist={album.mediaInfo?.watchlists?.length ?? 0}
                title={album.title}
                image={album.images?.[0]?.Url}
                year={album.releasedate}
                type={album.type}
                mediaType="album"
                status={album.mediaInfo?.status}
                inProgress={(album.mediaInfo?.downloadStatus ?? []).length > 0}
                canExpand
              />
            </li>
          ))}
          {isLoading &&
            [...Array(20)].map((_, index) => (
              <li key={`placeholder-${index}`}>
                <TitleCard.Placeholder canExpand />
              </li>
            ))}
        </ul>
        {!isReachingEnd && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={onLoadMore}
              disabled={isLoading}
              className="flex h-9 w-32 items-center justify-center"
            >
              {isLoading ? (
                <div className="h-5 w-5">
                  <LoadingSpinner />
                </div>
              ) : (
                intl.formatMessage(messages.loadmore)
              )}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <PageTitle title={data.name} />
      <div className="absolute top-0 left-0 right-0 z-0 h-96">
        <ImageFader
          isDarker
          backgroundImages={[
            ...(albumData?.flatMap((page) => page.results) ?? []),
            ...(singlesData?.flatMap((page) => page.results) ?? []),
            ...(epsData?.flatMap((page) => page.results) ?? []),
            ...(otherData?.flatMap((page) => page.results) ?? []),
          ]
            .filter((album) => album.images?.[0]?.Url)
            .map((album) => album.images[0].Url)
            .slice(0, 6)}
        />
      </div>
      <div className="relative z-10 mt-4 mb-8 flex flex-col items-center lg:flex-row lg:items-start">
        {data.images?.[0]?.Url && (
          <div className="relative mb-6 mr-0 h-36 w-36 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-gray-700 lg:mb-0 lg:mr-6 lg:h-44 lg:w-44">
            <CachedImage
              type="music"
              src={
                data.images.find((img) => img.CoverType === 'Poster')?.Url ??
                data.images[0]?.Url
              }
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
          </div>
        )}
        <div className="text-center text-gray-300 lg:text-left">
          <h1 className="text-3xl text-white lg:text-4xl">{data.name}</h1>
          <div className="mt-1 mb-2 space-y-1 text-xs text-white sm:text-sm lg:text-base">
            <div>{groupAttributes.join(' | ')}</div>
          </div>
          {data.overview && (
            <div className="relative text-left">
              <div
                className="group outline-none ring-0"
                onClick={() => setShowBio((show) => !show)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Space') {
                    setShowBio((show) => !show);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <TruncateMarkup
                  lines={showBio ? 200 : 6}
                  ellipsis={
                    <Ellipsis className="relative -top-0.5 ml-2 inline-block opacity-70 transition duration-300 group-hover:opacity-100" />
                  }
                >
                  <p className="pt-2 text-sm lg:text-base">{data.overview}</p>
                </TruncateMarkup>
              </div>
            </div>
          )}
        </div>
      </div>

      {renderAlbumSection(
        intl.formatMessage(messages.albums),
        albumData ? albumData.flatMap((page) => page.results) : [],
        isLoadingAlbums ?? false,
        (albumData?.[0]?.results.length === 0 ||
          (albumData &&
            albumData[albumData.length - 1]?.results.length < 20)) ??
          false,
        () => setAlbumSize(albumSize + 1)
      )}
      {renderAlbumSection(
        intl.formatMessage(messages.singles),
        singlesData ? singlesData.flatMap((page) => page.results) : [],
        isLoadingSingles ?? false,
        (singlesData?.[0]?.results.length === 0 ||
          (singlesData &&
            singlesData[singlesData.length - 1]?.results.length < 20)) ??
          false,
        () => setSinglesSize(singlesSize + 1)
      )}
      {renderAlbumSection(
        intl.formatMessage(messages.eps),
        epsData ? epsData.flatMap((page) => page.results) : [],
        isLoadingEps,
        (epsData?.[0]?.results.length === 0 ||
          (epsData && epsData[epsData.length - 1]?.results.length < 20)) ??
          false,
        () => setEpsSize(epsSize + 1)
      )}
      {renderAlbumSection(
        intl.formatMessage(messages.other),
        otherData ? otherData.flatMap((page) => page.results) : [],
        isLoadingOther,
        (otherData?.[0]?.results.length === 0 ||
          (otherData &&
            otherData[otherData.length - 1]?.results.length < 20)) ??
          false,
        () => setOtherSize(otherSize + 1)
      )}
    </>
  );
};

export default GroupDetails;

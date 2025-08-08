import BlacklistModal from '@app/components/BlacklistModal';
import Button from '@app/components/Common/Button';
import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import Slider from '@app/components/Slider';
import StatusBadge from '@app/components/StatusBadge';
import TitleCard from '@app/components/TitleCard';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import {
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import type { Collection } from '@server/models/Collection';
import axios from 'axios';
import { uniq } from 'lodash';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.CollectionDetails', {
  overview: 'Overview',
  numberofmovies: '{count} Movies',
  requestcollection: 'Request Collection',
  requestcollection4k: 'Request Collection in 4K',
});

interface CollectionDetailsProps {
  collection?: Collection;
}

const CollectionDetails = ({ collection }: CollectionDetailsProps) => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { hasPermission } = useUser();
  const [requestModal, setRequestModal] = useState(false);
  const [is4k, setIs4k] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [isBlacklistUpdating, setIsBlacklistUpdating] = useState(false);
  const { addToast } = useToasts();

  const returnCollectionDownloadItems = (data: Collection | undefined) => {
    const [downloadStatus, downloadStatus4k] = [
      data?.parts.flatMap((item) =>
        item.mediaInfo?.downloadStatus ? item.mediaInfo?.downloadStatus : []
      ),
      data?.parts.flatMap((item) =>
        item.mediaInfo?.downloadStatus4k ? item.mediaInfo?.downloadStatus4k : []
      ),
    ];

    return { downloadStatus, downloadStatus4k };
  };

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<Collection>(`/api/v1/collection/${router.query.collectionId}`, {
    fallbackData: collection,
    revalidateOnMount: true,
    refreshInterval: refreshIntervalHelper(
      returnCollectionDownloadItems(collection),
      15000
    ),
  });

  const { data: genres } =
    useSWR<{ id: number; name: string }[]>(`/api/v1/genres/movie`);

  const onClickHideItemBtn = async (): Promise<void> => {
    setIsBlacklistUpdating(true);

    try {
      await axios.post(`/api/v1/blacklist/collection/${data?.id}`);

      addToast(
        <span>
          {intl.formatMessage(globalMessages.blacklistSuccess, {
            title: data?.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } catch (e) {
      addToast(intl.formatMessage(globalMessages.blacklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    setIsBlacklistUpdating(false);
    setShowBlacklistModal(false);
  };

  const onClickUnblacklistBtn = async (): Promise<void> => {
    if (!data) return;

    setIsBlacklistUpdating(true);

    try {
      await axios.delete(`/api/v1/blacklist/collection/${data.id}`);

      addToast(
        <span>
          {intl.formatMessage(globalMessages.removeFromBlacklistSuccess, {
            title: data.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } catch (e) {
      addToast(intl.formatMessage(globalMessages.blacklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    setIsBlacklistUpdating(false);
  };

  const [downloadStatus, downloadStatus4k] = useMemo(() => {
    const downloadItems = returnCollectionDownloadItems(data);
    return [downloadItems.downloadStatus, downloadItems.downloadStatus4k];
  }, [data]);

  const [titles, titles4k] = useMemo(() => {
    return [
      data?.parts
        .filter((media) => (media.mediaInfo?.downloadStatus ?? []).length > 0)
        .map((title) => title.title),
      data?.parts
        .filter((media) => (media.mediaInfo?.downloadStatus4k ?? []).length > 0)
        .map((title) => title.title),
    ];
  }, [data?.parts]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  let collectionStatus = MediaStatus.UNKNOWN;
  let collectionStatus4k = MediaStatus.UNKNOWN;

  const blacklistedParts = data.parts.filter(
    (part) =>
      part.mediaInfo && part.mediaInfo.status === MediaStatus.BLACKLISTED
  );
  const isCollectionBlacklisted = blacklistedParts.length > 0;

  if (isCollectionBlacklisted) {
    collectionStatus = MediaStatus.BLACKLISTED;
  } else if (
    data.parts.every(
      (part) =>
        part.mediaInfo && part.mediaInfo.status === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatus = MediaStatus.AVAILABLE;
  } else if (
    data.parts.some(
      (part) =>
        part.mediaInfo && part.mediaInfo.status === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatus = MediaStatus.PARTIALLY_AVAILABLE;
  }

  if (
    data.parts.every(
      (part) =>
        part.mediaInfo && part.mediaInfo.status4k === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatus4k = MediaStatus.AVAILABLE;
  } else if (
    data.parts.some(
      (part) =>
        part.mediaInfo && part.mediaInfo.status4k === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatus4k = MediaStatus.PARTIALLY_AVAILABLE;
  }

  const hasRequestable =
    hasPermission([Permission.REQUEST, Permission.REQUEST_MOVIE], {
      type: 'or',
    }) &&
    data.parts.filter(
      (part) => !part.mediaInfo || part.mediaInfo.status === MediaStatus.UNKNOWN
    ).length > 0;

  const hasRequestable4k =
    settings.currentSettings.movie4kEnabled &&
    hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_MOVIE], {
      type: 'or',
    }) &&
    data.parts.filter(
      (part) =>
        !part.mediaInfo || part.mediaInfo.status4k === MediaStatus.UNKNOWN
    ).length > 0;

  const collectionAttributes: React.ReactNode[] = [];

  collectionAttributes.push(
    intl.formatMessage(messages.numberofmovies, {
      count: data.parts.length,
    })
  );

  if (genres && data.parts.some((part) => part.genreIds.length)) {
    collectionAttributes.push(
      uniq(
        data.parts.reduce(
          (genresList: number[], curr) => genresList.concat(curr.genreIds),
          []
        )
      )
        .map((genreId) => (
          <Link
            href={`/discover/movies/genre/${genreId}`}
            key={`genre-${genreId}`}
            className="hover:underline"
          >
            {genres.find((g) => g.id === genreId)?.name}
          </Link>
        ))
        .reduce((prev, curr) => (
          <>
            {intl.formatMessage(globalMessages.delimitedlist, {
              a: prev,
              b: curr,
            })}
          </>
        ))
    );
  }

  const blacklistVisibility = hasPermission(
    [Permission.MANAGE_BLACKLIST, Permission.VIEW_BLACKLIST],
    { type: 'or' }
  );

  return (
    <div
      className="media-page"
      style={{
        height: 493,
      }}
    >
      {data.backdropPath && (
        <div className="media-page-bg-image">
          <CachedImage
            type="tmdb"
            alt=""
            src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data.backdropPath}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 100%)',
            }}
          />
        </div>
      )}
      <PageTitle title={data.name} />
      <RequestModal
        tmdbId={data.id}
        show={requestModal}
        type="collection"
        is4k={is4k}
        onComplete={() => {
          revalidate();
          setRequestModal(false);
        }}
        onCancel={() => setRequestModal(false)}
      />
      <BlacklistModal
        tmdbId={data.id}
        type="collection"
        show={showBlacklistModal}
        onCancel={() => setShowBlacklistModal(false)}
        onComplete={onClickHideItemBtn}
        isUpdating={isBlacklistUpdating}
      />

      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="tmdb"
            src={
              data.posterPath
                ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.posterPath}`
                : '/images/jellyseerr_poster_not_found.png'
            }
            alt=""
            sizes="100vw"
            style={{ width: '100%', height: 'auto' }}
            width={600}
            height={900}
            priority
          />
        </div>
        <div className="media-title">
          <div className="media-status">
            <StatusBadge
              status={collectionStatus}
              downloadItem={downloadStatus}
              title={titles}
              inProgress={data.parts.some(
                (part) => (part.mediaInfo?.downloadStatus ?? []).length > 0
              )}
            />
            {settings.currentSettings.movie4kEnabled &&
              hasPermission(
                [Permission.REQUEST_4K, Permission.REQUEST_4K_MOVIE],
                {
                  type: 'or',
                }
              ) && (
                <StatusBadge
                  status={collectionStatus4k}
                  downloadItem={downloadStatus4k}
                  title={titles4k}
                  is4k
                  inProgress={data.parts.some(
                    (part) =>
                      (part.mediaInfo?.downloadStatus4k ?? []).length > 0
                  )}
                />
              )}
          </div>
          <h1>{data.name}</h1>
          <span className="media-attributes">
            {collectionAttributes.length > 0 &&
              collectionAttributes
                .map((t, k) => <span key={k}>{t}</span>)
                .reduce((prev, curr) => (
                  <>
                    {prev}
                    <span>|</span>
                    {curr}
                  </>
                ))}
          </span>
        </div>
        <div className="media-actions">
          {blacklistVisibility &&
            (isCollectionBlacklisted ? (
              <Tooltip
                content={
                  blacklistedParts.length === data.parts.length
                    ? intl.formatMessage(globalMessages.removefromBlacklist)
                    : intl.formatMessage(globalMessages.removefromBlacklist) +
                      ` (${blacklistedParts.length} movies)`
                }
              >
                <Button
                  buttonType="ghost"
                  className="z-40 mr-2"
                  buttonSize="md"
                  onClick={onClickUnblacklistBtn}
                  disabled={isBlacklistUpdating}
                >
                  <EyeIcon />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                content={intl.formatMessage(globalMessages.addToBlacklist)}
              >
                <Button
                  buttonType="ghost"
                  className="z-40 mr-2"
                  buttonSize="md"
                  onClick={() => setShowBlacklistModal(true)}
                  disabled={isBlacklistUpdating}
                >
                  <EyeSlashIcon />
                </Button>
              </Tooltip>
            ))}
          {(hasRequestable || hasRequestable4k) && (
            <ButtonWithDropdown
              buttonType="primary"
              onClick={() => {
                setRequestModal(true);
                setIs4k(!hasRequestable);
              }}
              text={
                <>
                  <ArrowDownTrayIcon />
                  <span>
                    {intl.formatMessage(
                      hasRequestable
                        ? messages.requestcollection
                        : messages.requestcollection4k
                    )}
                  </span>
                </>
              }
            >
              {hasRequestable && hasRequestable4k && (
                <ButtonWithDropdown.Item
                  buttonType="primary"
                  onClick={() => {
                    setRequestModal(true);
                    setIs4k(true);
                  }}
                >
                  <ArrowDownTrayIcon />
                  <span>
                    {intl.formatMessage(messages.requestcollection4k)}
                  </span>
                </ButtonWithDropdown.Item>
              )}
            </ButtonWithDropdown>
          )}
        </div>
      </div>
      {data.overview && (
        <div className="media-overview">
          <div className="flex-1">
            <h2>{intl.formatMessage(messages.overview)}</h2>
            <p>{data.overview}</p>
          </div>
        </div>
      )}
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(globalMessages.movies)}</span>
        </div>
      </div>
      <Slider
        sliderKey="collection-movies"
        isLoading={false}
        isEmpty={data.parts.length === 0}
        items={data.parts
          .filter((title) => {
            if (!blacklistVisibility)
              return title.mediaInfo?.status !== MediaStatus.BLACKLISTED;
            return title;
          })
          .map((title) => (
            <TitleCard
              key={`collection-movie-${title.id}`}
              id={title.id}
              isAddedToWatchlist={title.mediaInfo?.watchlists?.length ?? 0}
              image={title.posterPath}
              status={title.mediaInfo?.status}
              summary={title.overview}
              title={title.title}
              userScore={title.voteAverage}
              year={title.releaseDate}
              mediaType={title.mediaType}
            />
          ))}
      />
      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default CollectionDetails;

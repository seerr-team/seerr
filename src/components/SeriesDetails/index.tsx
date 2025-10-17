import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';
import CachedImage from '@app/components/Common/CachedImage';
import ImageFader from '@app/components/Common/ImageFader';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import RequestModal from '@app/components/RequestModal';
import StatusBadge from '@app/components/StatusBadge';
import TitleCard from '@app/components/TitleCard';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import type { Series } from '@server/models/Series';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.SeriesDetails', {
  overview: 'Overview',
  numberofbooks: '{count} Books',
  requestseries: 'Request Series',
  requestseriesaudio: 'Request Series in Audiobook',
});

interface SeriesDetailsProps {
  series?: Series;
}

const SeriesDetails = ({ series }: SeriesDetailsProps) => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { hasPermission } = useUser();
  const [requestModal, setRequestModal] = useState(false);
  const [isAudio, setIsAudio] = useState(false);

  const returnSeriesDownloadItems = (data: Series | undefined) => {
    const [downloadStatus, downloadStatusAlt] = [
      data?.books.flatMap((item) =>
        item.mediaInfo?.downloadStatus ? item.mediaInfo?.downloadStatus : []
      ),
      data?.books.flatMap((item) =>
        item.mediaInfo?.downloadStatusAlt
          ? item.mediaInfo?.downloadStatusAlt
          : []
      ),
    ];

    return { downloadStatus, downloadStatusAlt };
  };

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<Series>(`/api/v1/series/${router.query.seriesId}`, {
    fallbackData: series,
    revalidateOnMount: true,
    refreshInterval: refreshIntervalHelper(
      returnSeriesDownloadItems(series),
      15000
    ),
  });

  const [downloadStatus, downloadStatusAudio] = useMemo(() => {
    const downloadItems = returnSeriesDownloadItems(data);
    return [downloadItems.downloadStatus, downloadItems.downloadStatusAlt];
  }, [data]);

  const [titles, titlesAudio] = useMemo(() => {
    return [
      data?.books
        .filter((book) => (book.mediaInfo?.downloadStatus ?? []).length > 0)
        .map((title) => title.title),
      data?.books
        .filter((book) => (book.mediaInfo?.downloadStatusAlt ?? []).length > 0)
        .map((title) => title.title),
    ];
  }, [data?.books]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  let collectionStatus = MediaStatus.UNKNOWN;
  let collectionStatusAudio = MediaStatus.UNKNOWN;

  if (
    data.books.every(
      (book) =>
        book.mediaInfo && book.mediaInfo.status === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatus = MediaStatus.AVAILABLE;
  } else if (
    data.books.some(
      (book) =>
        book.mediaInfo && book.mediaInfo.status === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatus = MediaStatus.PARTIALLY_AVAILABLE;
  }

  if (
    data.books.every(
      (book) =>
        book.mediaInfo && book.mediaInfo.statusAlt === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatusAudio = MediaStatus.AVAILABLE;
  } else if (
    data.books.some(
      (book) =>
        book.mediaInfo && book.mediaInfo.statusAlt === MediaStatus.AVAILABLE
    )
  ) {
    collectionStatusAudio = MediaStatus.PARTIALLY_AVAILABLE;
  }

  const hasRequestable =
    hasPermission([Permission.REQUEST, Permission.REQUEST_BOOK], {
      type: 'or',
    }) &&
    data.books.filter(
      (book) => !book.mediaInfo || book.mediaInfo.status === MediaStatus.UNKNOWN
    ).length > 0;

  const hasRequestableAudio =
    settings.currentSettings.bookAudioEnabled &&
    hasPermission([Permission.REQUEST_ALT, Permission.REQUEST_AUDIO_BOOK], {
      type: 'or',
    }) &&
    data.books.filter(
      (book) =>
        !book.mediaInfo || book.mediaInfo.statusAlt === MediaStatus.UNKNOWN
    ).length > 0;

  const collectionAttributes: React.ReactNode[] = [];

  collectionAttributes.push(
    intl.formatMessage(messages.numberofbooks, {
      count: data.books.length,
    })
  );

  return (
    <div
      className="media-page"
      style={{
        height: 493,
      }}
    >
      {data.books && (
        <div className="media-page-bg-image">
          <ImageFader
            isDarker
            cache={'hardcover'}
            backgroundImages={(
              [
                ...new Set(
                  (data.books ?? [])
                    .filter((media) => media.backdropPath)
                    .map((media) => media.backdropPath)
                ),
              ] as string[]
            ).slice(0, 6)}
          />
        </div>
      )}
      <PageTitle title={data.name} />
      <RequestModal
        mediaId={data.id}
        show={requestModal}
        type="series"
        isAlt={isAudio}
        onComplete={() => {
          revalidate();
          setRequestModal(false);
        }}
        onCancel={() => setRequestModal(false)}
      />
      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="hardcover"
            src={
              data.posterPath
                ? data.posterPath
                : `https://assets.hardcover.app/static/covers/cover${
                    (data.id % 9) + 1
                  }.png`
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
              inProgress={data.books.some(
                (book) => (book.mediaInfo?.downloadStatus ?? []).length > 0
              )}
            />
            {settings.currentSettings.bookAudioEnabled &&
              hasPermission(
                [Permission.REQUEST_ALT, Permission.REQUEST_AUDIO_BOOK],
                {
                  type: 'or',
                }
              ) && (
                <StatusBadge
                  status={collectionStatusAudio}
                  downloadItem={downloadStatusAudio}
                  title={titlesAudio}
                  isAlt
                  inProgress={data.books.some(
                    (book) =>
                      (book.mediaInfo?.downloadStatusAlt ?? []).length > 0
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
          {(hasRequestable || hasRequestableAudio) && (
            <ButtonWithDropdown
              buttonType="primary"
              onClick={() => {
                setRequestModal(true);
                setIsAudio(!hasRequestable);
              }}
              text={
                <>
                  <ArrowDownTrayIcon />
                  <span>
                    {intl.formatMessage(
                      hasRequestable
                        ? messages.requestseries
                        : messages.requestseriesaudio
                    )}
                  </span>
                </>
              }
            >
              {hasRequestable && hasRequestableAudio && (
                <ButtonWithDropdown.Item
                  buttonType="primary"
                  onClick={() => {
                    setRequestModal(true);
                    setIsAudio(true);
                  }}
                >
                  <ArrowDownTrayIcon />
                  <span>{intl.formatMessage(messages.requestseriesaudio)}</span>
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
          <span>{intl.formatMessage(globalMessages.books)}</span>
        </div>
      </div>
      <ul className="cards-vertical">
        {data.books?.map((book, index) => {
          return (
            <li key={`list-cast-item-${book.id}-${index}`}>
              <TitleCard
                key={book.id}
                id={book.id}
                title={book.title}
                year={book.releaseDate}
                image={book.posterPath}
                summary={book.overview}
                position={book.position}
                mediaType={'book'}
                status={book.mediaInfo?.status}
                canExpand
              />
            </li>
          );
        })}
      </ul>
      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default SeriesDetails;

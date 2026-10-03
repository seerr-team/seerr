import BlocklistModal from '@app/components/BlocklistModal';
import Button from '@app/components/Common/Button';
import ButtonWithDropdown from '@app/components/Common/ButtonWithDropdown';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import Slider from '@app/components/Slider';
import StatusBadge, { getStatusLabel } from '@app/components/StatusBadge';
import TitleCard from '@app/components/TitleCard';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import {
  getLabelledServices,
  getMediaServiceStatus,
} from '@app/utils/serviceRequestStatus';
import {
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import type { ServiceCommonServer } from '@server/interfaces/api/serviceInterfaces';
import type { Collection } from '@server/models/Collection';
import type { MovieResult } from '@server/models/Search';
import axios from 'axios';
import { uniq } from 'lodash';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.CollectionDetails', {
  overview: 'Overview',
  numberofmovies: '{count} Movies',
  removefromblocklistpartialcount:
    '{removeLabel} ({count, plural, one {# movie} other {# movies}})',
  requestcollection: 'Request Collection',
  requestcollection4k: 'Request Collection in 4K',
  requestcollectioninservice: 'Request Collection in {label}',
  statusinservice: '{status} in {label}',
});

interface CollectionDetailsProps {
  collection?: Collection;
}

const CollectionDetails = ({ collection }: CollectionDetailsProps) => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { user, hasPermission } = useUser();
  const [requestModal, setRequestModal] = useState<{
    show: boolean;
    is4k: boolean;
    serverId?: number;
  }>({ show: false, is4k: false });
  const [showBlocklistModal, setShowBlocklistModal] = useState(false);
  const [isBlocklistUpdating, setIsBlocklistUpdating] = useState(false);
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

  const { data: radarrServices } = useSWR<ServiceCommonServer[]>(
    '/api/v1/service/radarr'
  );

  const onClickHideItemBtn = async (): Promise<void> => {
    setIsBlocklistUpdating(true);

    try {
      await axios.post(`/api/v1/blocklist/collection/${data?.id}`);

      addToast(
        <span>
          {intl.formatMessage(globalMessages.blocklistSuccess, {
            title: data?.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } catch {
      addToast(intl.formatMessage(globalMessages.blocklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    setIsBlocklistUpdating(false);
    setShowBlocklistModal(false);
  };

  const onClickUnblocklistBtn = async (): Promise<void> => {
    if (!data) return;

    setIsBlocklistUpdating(true);

    try {
      await axios.delete(`/api/v1/blocklist/collection/${data.id}`);

      addToast(
        <span>
          {intl.formatMessage(globalMessages.removeFromBlocklistSuccess, {
            title: data.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } catch {
      addToast(intl.formatMessage(globalMessages.blocklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    setIsBlocklistUpdating(false);
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
    return <ErrorPage statusCode={404} />;
  }

  let collectionStatus = MediaStatus.UNKNOWN;
  let collectionStatus4k = MediaStatus.UNKNOWN;

  const blocklistedParts = data.parts.filter(
    (part) =>
      part.mediaInfo && part.mediaInfo.status === MediaStatus.BLOCKLISTED
  );
  const isCollectionBlocklisted = blocklistedParts.length > 0;
  const isCollectionPartiallyBlocklisted =
    blocklistedParts.length > 0 && blocklistedParts.length < data.parts.length;

  if (isCollectionBlocklisted) {
    collectionStatus = MediaStatus.BLOCKLISTED;
  } else if (
    data.parts.length > 0 &&
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
    data.parts.length > 0 &&
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

  const canRequestMovies = hasPermission(
    [Permission.REQUEST, Permission.REQUEST_MOVIE],
    { type: 'or' }
  );
  const collectionServices = getLabelledServices(radarrServices).filter(
    (service) => !service.animeOnly
  );
  const restrictToServices =
    !hasPermission(Permission.MANAGE_REQUESTS) &&
    (radarrServices
      ? collectionServices.some((service) =>
          (user?.requestServices ?? []).includes(`radarr:${service.id}`)
        )
      : (user?.requestServices ?? []).some((service) =>
          service.startsWith('radarr:')
        ));

  const hasRequestable =
    !restrictToServices &&
    canRequestMovies &&
    data.parts.filter(
      (part) =>
        !part.mediaInfo ||
        part.mediaInfo.status === MediaStatus.DELETED ||
        part.mediaInfo.status === MediaStatus.UNKNOWN
    ).length > 0;

  const hasRequestable4k =
    !restrictToServices &&
    settings.currentSettings.movie4kEnabled &&
    hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_MOVIE], {
      type: 'or',
    }) &&
    data.parts.filter(
      (part) =>
        !part.mediaInfo ||
        part.mediaInfo.status4k === MediaStatus.DELETED ||
        part.mediaInfo.status4k === MediaStatus.UNKNOWN
    ).length > 0;

  const requestableServices = canRequestMovies
    ? collectionServices.filter(
        (service) =>
          (hasPermission(Permission.MANAGE_REQUESTS) ||
            (user?.requestServices ?? []).includes(`radarr:${service.id}`)) &&
          data.parts.some(
            (part) =>
              part.mediaInfo?.status !== MediaStatus.BLOCKLISTED &&
              getMediaServiceStatus(part.mediaInfo, service.id).status ===
                MediaStatus.UNKNOWN
          )
      )
    : [];

  const requestOptions: {
    id: string;
    text: string;
    is4k: boolean;
    serverId?: number;
  }[] = [];

  if (hasRequestable) {
    requestOptions.push({
      id: 'request',
      text: intl.formatMessage(messages.requestcollection),
      is4k: false,
    });
  }

  if (hasRequestable4k) {
    requestOptions.push({
      id: 'request-4k',
      text: intl.formatMessage(messages.requestcollection4k),
      is4k: true,
    });
  }

  for (const service of requestableServices) {
    requestOptions.push({
      id: `request-service-${service.id}`,
      text: intl.formatMessage(messages.requestcollectioninservice, {
        label: service.buttonLabel,
      }),
      is4k: false,
      serverId: service.id,
    });
  }

  const [primaryRequestOption, ...otherRequestOptions] = requestOptions;

  const getPartServiceStatuses = (part: MovieResult) =>
    getLabelledServices(radarrServices)
      .map((service) => ({
        service,
        ...getMediaServiceStatus(part.mediaInfo, service.id),
      }))
      .filter(({ status }) => status !== MediaStatus.UNKNOWN);

  const collectionServiceStatuses = getLabelledServices(radarrServices)
    .map((service) => {
      const partStatuses = data.parts
        .filter((part) => part.mediaInfo?.status !== MediaStatus.BLOCKLISTED)
        .map((part) => ({
          title: part.title,
          ...getMediaServiceStatus(part.mediaInfo, service.id),
        }));
      const availableCount = partStatuses.filter(
        ({ status }) => status === MediaStatus.AVAILABLE
      ).length;
      const downloading = partStatuses.filter(
        ({ downloadItem }) => downloadItem.length > 0
      );

      return {
        service,
        status:
          partStatuses.length > 0 && availableCount === partStatuses.length
            ? MediaStatus.AVAILABLE
            : availableCount > 0
              ? MediaStatus.PARTIALLY_AVAILABLE
              : partStatuses.some(
                    ({ status }) => status === MediaStatus.PROCESSING
                  )
                ? MediaStatus.PROCESSING
                : partStatuses.some(
                      ({ status }) => status === MediaStatus.PENDING
                    )
                  ? MediaStatus.PENDING
                  : MediaStatus.UNKNOWN,
        downloadItem: downloading.flatMap(({ downloadItem }) => downloadItem),
        titles: downloading.map(({ title }) => title),
      };
    })
    .filter(({ status }) => status !== MediaStatus.UNKNOWN);

  const isCoveredByCollectionServiceStatus = (is4k: boolean) => {
    const defaultServiceId = radarrServices?.find(
      (service) => service.isDefault && service.is4k === is4k
    )?.id;

    return collectionServiceStatuses.some(
      ({ service }) => service.id === defaultServiceId
    );
  };

  const blocklistVisibility = hasPermission(
    [Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST],
    { type: 'or' }
  );

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
          <Fragment key={`${prev.key}-${curr.key}`}>
            {intl.formatMessage(globalMessages.delimitedlist, {
              a: prev,
              b: curr,
            })}
          </Fragment>
        ))
    );
  }

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
        show={requestModal.show}
        type="collection"
        is4k={requestModal.is4k}
        serverId={requestModal.serverId}
        onComplete={() => {
          revalidate();
          setRequestModal((current) => ({ ...current, show: false }));
        }}
        onCancel={() =>
          setRequestModal((current) => ({ ...current, show: false }))
        }
      />
      <BlocklistModal
        tmdbId={data.id}
        type="collection"
        show={showBlocklistModal}
        onCancel={() => setShowBlocklistModal(false)}
        onComplete={onClickHideItemBtn}
        isUpdating={isBlocklistUpdating}
      />

      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="tmdb"
            src={
              data.posterPath
                ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.posterPath}`
                : '/images/seerr_poster_not_found.png'
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
            {!isCollectionBlocklisted &&
              collectionServiceStatuses.map(
                ({ service, status, downloadItem, titles }) => (
                  <StatusBadge
                    key={`service-status-${service.id}`}
                    status={status}
                    downloadItem={downloadItem}
                    title={titles}
                    inProgress={downloadItem.length > 0}
                    statusLabelOverride={intl.formatMessage(
                      messages.statusinservice,
                      {
                        status: getStatusLabel(
                          intl,
                          status,
                          downloadItem.length > 0
                        ),
                        label: service.buttonLabel ?? service.name,
                      }
                    )}
                  />
                )
              )}
            {(isCollectionBlocklisted ||
              !isCoveredByCollectionServiceStatus(false)) && (
              <StatusBadge
                status={collectionStatus}
                downloadItem={downloadStatus}
                title={titles}
                statusLabelOverride={
                  isCollectionPartiallyBlocklisted
                    ? intl.formatMessage(globalMessages.partiallyblocklisted)
                    : undefined
                }
                inProgress={data.parts.some(
                  (part) => (part.mediaInfo?.downloadStatus ?? []).length > 0
                )}
              />
            )}
            {!isCoveredByCollectionServiceStatus(true) &&
              settings.currentSettings.movie4kEnabled &&
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
                  <Fragment key={`${prev.key}-${curr.key}`}>
                    {prev}
                    <span>|</span>
                    {curr}
                  </Fragment>
                ))}
          </span>
        </div>
        <div className="media-actions">
          {hasPermission([Permission.MANAGE_BLOCKLIST], { type: 'or' }) &&
            (isCollectionBlocklisted ? (
              <Tooltip
                content={
                  blocklistedParts.length === data.parts.length
                    ? intl.formatMessage(globalMessages.removefromBlocklist)
                    : intl.formatMessage(
                        messages.removefromblocklistpartialcount,
                        {
                          removeLabel: intl.formatMessage(
                            globalMessages.removefromBlocklist
                          ),
                          count: blocklistedParts.length,
                        }
                      )
                }
              >
                <Button
                  buttonType="ghost"
                  className="z-40 mr-2"
                  buttonSize="md"
                  onClick={onClickUnblocklistBtn}
                  disabled={isBlocklistUpdating}
                >
                  <EyeIcon />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip
                content={intl.formatMessage(globalMessages.addToBlocklist)}
              >
                <Button
                  buttonType="ghost"
                  className="z-40 mr-2"
                  buttonSize="md"
                  onClick={() => setShowBlocklistModal(true)}
                  disabled={isBlocklistUpdating}
                >
                  <EyeSlashIcon />
                </Button>
              </Tooltip>
            ))}
          {primaryRequestOption && (
            <ButtonWithDropdown
              buttonType="primary"
              onClick={() =>
                setRequestModal({
                  show: true,
                  is4k: primaryRequestOption.is4k,
                  serverId: primaryRequestOption.serverId,
                })
              }
              text={
                <>
                  <ArrowDownTrayIcon />
                  <span>{primaryRequestOption.text}</span>
                </>
              }
            >
              {otherRequestOptions.length > 0
                ? otherRequestOptions.map((option) => (
                    <ButtonWithDropdown.Item
                      key={`collection-${option.id}`}
                      buttonType="primary"
                      onClick={() =>
                        setRequestModal({
                          show: true,
                          is4k: option.is4k,
                          serverId: option.serverId,
                        })
                      }
                    >
                      <ArrowDownTrayIcon />
                      <span>{option.text}</span>
                    </ButtonWithDropdown.Item>
                  ))
                : null}
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
            if (!blocklistVisibility) {
              return title.mediaInfo?.status !== MediaStatus.BLOCKLISTED;
            }
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
              mutateParent={revalidate}
              serviceStatuses={getPartServiceStatuses(title).map(
                ({ service, status, downloadItem }) => ({
                  serviceId: service.id,
                  label: service.buttonLabel ?? service.name,
                  status,
                  inProgress: downloadItem.length > 0,
                })
              )}
            />
          ))}
      />
      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default CollectionDetails;

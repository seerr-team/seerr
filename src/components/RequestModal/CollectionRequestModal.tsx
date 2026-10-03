import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import type { RequestOverrides } from '@app/components/RequestModal/AdvancedRequester';
import AdvancedRequester from '@app/components/RequestModal/AdvancedRequester';
import QuotaDisplay from '@app/components/RequestModal/QuotaDisplay';
import { getStatusLabel } from '@app/components/StatusBadge';
import useToasts from '@app/hooks/useToasts';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  getLabelledServices,
  getMediaServiceStatus,
} from '@app/utils/serviceRequestStatus';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { ServiceCommonServer } from '@server/interfaces/api/serviceInterfaces';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { Permission } from '@server/lib/permissions';
import type { Collection } from '@server/models/Collection';
import type { MovieResult } from '@server/models/Search';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestModal', {
  requestadmin: 'This request will be approved automatically.',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestcollectiontitle: 'Request Collection',
  requestcollection4ktitle: 'Request Collection in 4K',
  requestcollectioninservicetitle: 'Request Collection in {label}',
  requesterror: 'Something went wrong while submitting the request.',
  selectmovies: 'Select Movie(s)',
  requestmovies: 'Request {count} {count, plural, one {Movie} other {Movies}}',
  requestmovies4k:
    'Request {count} {count, plural, one {Movie} other {Movies}} in 4K',
  requestmoviesinservice:
    'Request {count} {count, plural, one {Movie} other {Movies}} in {label}',
  statusinservice: '{status} in {label}',
});

interface RequestModalProps extends React.HTMLAttributes<HTMLDivElement> {
  tmdbId: number;
  is4k?: boolean;
  serverId?: number;
  onCancel?: () => void;
  onComplete?: (newStatus: MediaStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
}

const CollectionRequestModal = ({
  onCancel,
  onComplete,
  tmdbId,
  onUpdating,
  is4k = false,
  serverId,
}: RequestModalProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [requestOverrides, setRequestOverrides] =
    useState<RequestOverrides | null>(null);
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const { addToast } = useToasts();
  const { data, error } = useSWR<Collection>(`/api/v1/collection/${tmdbId}`, {
    revalidateOnMount: true,
  });
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { data: quota } = useSWR<QuotaResponse>(
    user &&
      (!requestOverrides?.user?.id || hasPermission(Permission.MANAGE_USERS))
      ? `/api/v1/user/${requestOverrides?.user?.id ?? user.id}/quota`
      : null
  );

  const { data: services } = useSWR<ServiceCommonServer[]>(
    '/api/v1/service/radarr'
  );
  const selectedService =
    serverId != null ? services?.find((s) => s.id === serverId) : undefined;
  const serviceLabel = selectedService?.buttonLabel ?? selectedService?.name;

  const currentlyRemaining =
    (quota?.movie.remaining ?? 0) - selectedParts.length;

  const getPartStatus = (part: MovieResult): MediaStatus | undefined =>
    serverId != null
      ? (part.mediaInfo?.serviceStatuses?.find(
          (ss) => ss.serviceId === serverId
        )?.status ?? MediaStatus.UNKNOWN)
      : part.mediaInfo?.[is4k ? 'status4k' : 'status'];

  const getPartRequest = (tmdbId: number): MediaRequest | undefined => {
    const part = (data?.parts ?? []).find((part) => part.id === tmdbId);

    return (part?.mediaInfo?.requests ?? []).find(
      (request) =>
        (serverId != null
          ? request.isServiceRequest && request.serverId === serverId
          : !request.isServiceRequest && request.is4k === is4k) &&
        request.status !== MediaRequestStatus.DECLINED &&
        request.status !== MediaRequestStatus.COMPLETED
    );
  };

  const getAllParts = (): number[] => {
    return (data?.parts ?? [])
      .filter((part) => part.mediaInfo?.status !== MediaStatus.BLOCKLISTED)
      .map((part) => part.id);
  };

  const getAllRequestedParts = (): number[] => {
    const requestedParts = (data?.parts ?? [])
      .filter((part) => getPartRequest(part.id))
      .map((part) => part.id);

    const availableParts = (data?.parts ?? [])
      .filter(
        (part) =>
          (getPartStatus(part) === MediaStatus.AVAILABLE ||
            getPartStatus(part) === MediaStatus.PROCESSING) &&
          !requestedParts.includes(part.id)
      )
      .map((part) => part.id);

    return [...requestedParts, ...availableParts];
  };

  const isSelectedPart = (tmdbId: number): boolean =>
    selectedParts.includes(tmdbId);

  const togglePart = (tmdbId: number): void => {
    // If this part already has a pending request, don't allow it to be toggled
    if (getAllRequestedParts().includes(tmdbId)) {
      return;
    }

    // If there are no more remaining requests available, block toggle
    if (
      quota?.movie.limit &&
      currentlyRemaining <= 0 &&
      !isSelectedPart(tmdbId)
    ) {
      return;
    }

    if (selectedParts.includes(tmdbId)) {
      setSelectedParts((parts) => parts.filter((partId) => partId !== tmdbId));
    } else {
      setSelectedParts((parts) => [...parts, tmdbId]);
    }
  };

  const unrequestedParts = getAllParts().filter(
    (tmdbId) => !getAllRequestedParts().includes(tmdbId)
  );

  const toggleAllParts = (): void => {
    // If the user has a quota and not enough requests for all parts, block toggleAllParts
    if (
      quota?.movie.limit &&
      (quota?.movie.remaining ?? 0) < unrequestedParts.length
    ) {
      return;
    }

    if (
      data &&
      selectedParts.length >= 0 &&
      selectedParts.length < unrequestedParts.length
    ) {
      setSelectedParts(unrequestedParts);
    } else {
      setSelectedParts([]);
    }
  };

  const isAllParts = (): boolean => {
    if (!data) {
      return false;
    }

    return (
      selectedParts.length ===
      getAllParts().filter((part) => !getAllRequestedParts().includes(part))
        .length
    );
  };

  useEffect(() => {
    if (onUpdating) {
      onUpdating(isUpdating);
    }
  }, [isUpdating, onUpdating]);

  const sendRequest = useCallback(async () => {
    setIsUpdating(true);

    try {
      let overrideParams = {};
      if (requestOverrides) {
        overrideParams = {
          serverId: requestOverrides.server,
          profileId: requestOverrides.profile,
          rootFolder: requestOverrides.folder,
          userId: requestOverrides.user?.id,
          tags: requestOverrides.tags,
        };
      }

      await Promise.all(
        (
          data?.parts.filter((part) => selectedParts.includes(part.id)) ?? []
        ).map(async (part) => {
          await axios.post<MediaRequest>('/api/v1/request', {
            mediaId: part.id,
            mediaType: 'movie',
            is4k,
            ...(serverId != null ? { serverId, isServiceRequest: true } : {}),
            ...overrideParams,
          });
        })
      );

      if (onComplete) {
        onComplete(
          selectedParts.length === (data?.parts ?? []).length
            ? MediaStatus.UNKNOWN
            : MediaStatus.PARTIALLY_AVAILABLE
        );
        mutate('/api/v1/request/count');
      }

      addToast(
        <span>
          {intl.formatMessage(messages.requestSuccess, {
            title: data?.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );
    } catch {
      addToast(intl.formatMessage(messages.requesterror), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [
    requestOverrides,
    data?.parts,
    data?.name,
    onComplete,
    addToast,
    intl,
    selectedParts,
    is4k,
    serverId,
  ]);

  const hasAutoApprove = hasPermission(
    [
      Permission.MANAGE_REQUESTS,
      is4k ? Permission.AUTO_APPROVE_4K : Permission.AUTO_APPROVE,
      is4k ? Permission.AUTO_APPROVE_4K_MOVIE : Permission.AUTO_APPROVE_MOVIE,
    ],
    { type: 'or' }
  );

  const blocklistVisibility = hasPermission(
    [Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST],
    { type: 'or' }
  );

  return (
    <Modal
      loading={(!data && !error) || !quota}
      backgroundClickable
      onCancel={onCancel}
      onOk={sendRequest}
      title={
        serverId != null
          ? intl.formatMessage(messages.requestcollectioninservicetitle, {
              label: serviceLabel ?? '',
            })
          : intl.formatMessage(
              is4k
                ? messages.requestcollection4ktitle
                : messages.requestcollectiontitle
            )
      }
      subTitle={data?.name}
      okText={
        isUpdating
          ? intl.formatMessage(globalMessages.requesting)
          : selectedParts.length === 0
            ? intl.formatMessage(messages.selectmovies)
            : serverId != null
              ? intl.formatMessage(messages.requestmoviesinservice, {
                  count: selectedParts.length,
                  label: serviceLabel ?? '',
                })
              : intl.formatMessage(
                  is4k ? messages.requestmovies4k : messages.requestmovies,
                  {
                    count: selectedParts.length,
                  }
                )
      }
      okDisabled={selectedParts.length === 0}
      okButtonType={'primary'}
      backdrop={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data?.backdropPath}`}
    >
      {hasAutoApprove && !quota?.movie.restricted && (
        <div className="mt-6">
          <Alert
            title={intl.formatMessage(messages.requestadmin)}
            type="info"
          />
        </div>
      )}
      {(quota?.movie.limit ?? 0) > 0 && (
        <QuotaDisplay
          mediaType="movie"
          quota={quota?.movie}
          remaining={currentlyRemaining}
          userOverride={
            requestOverrides?.user && requestOverrides.user.id !== user?.id
              ? requestOverrides?.user?.id
              : undefined
          }
        />
      )}
      <div className="flex flex-col">
        <div className="-mx-4 sm:mx-0">
          <div className="inline-block min-w-full py-2 align-middle">
            <div className="overflow-hidden border border-gray-700 backdrop-blur sm:rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="w-16 bg-gray-700/80 px-4 py-3">
                      <span
                        role="checkbox"
                        tabIndex={0}
                        aria-checked={isAllParts()}
                        onClick={() => toggleAllParts()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Space') {
                            toggleAllParts();
                          }
                        }}
                        className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none ${
                          quota?.movie.limit &&
                          (quota.movie.remaining ?? 0) < unrequestedParts.length
                            ? 'opacity-50'
                            : ''
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`${
                            isAllParts() ? 'bg-indigo-500' : 'bg-gray-800'
                          } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                        />
                        <span
                          aria-hidden="true"
                          className={`${
                            isAllParts() ? 'translate-x-5' : 'translate-x-0'
                          } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                        />
                      </span>
                    </th>
                    <th className="bg-gray-700/80 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.movie)}
                    </th>
                    <th className="bg-gray-700/80 px-2 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.status)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data?.parts
                    .filter((part) => {
                      if (!blocklistVisibility)
                        return (
                          part.mediaInfo?.status !== MediaStatus.BLOCKLISTED
                        );
                      return part;
                    })
                    .map((part) => {
                      const partRequest = getPartRequest(part.id);
                      const partStatus = getPartStatus(part);
                      const isBlocklisted =
                        part.mediaInfo?.status === MediaStatus.BLOCKLISTED;
                      const isInLibrary =
                        !isBlocklisted &&
                        partStatus !== undefined &&
                        partStatus !== MediaStatus.UNKNOWN &&
                        partStatus !== MediaStatus.DELETED;
                      const serviceStatuses = getLabelledServices(services)
                        .filter((service) => service.id !== serverId)
                        .map((service) => ({
                          service,
                          status: getMediaServiceStatus(
                            part.mediaInfo,
                            service.id
                          ).status,
                        }))
                        .filter(({ status }) => status !== MediaStatus.UNKNOWN);

                      return (
                        <tr key={`part-${part.id}`}>
                          <td
                            className={`whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100 ${
                              isBlocklisted && 'pointer-events-none opacity-50'
                            }`}
                          >
                            <span
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={
                                isInLibrary || isSelectedPart(part.id)
                              }
                              onClick={() => togglePart(part.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Space') {
                                  togglePart(part.id);
                                }
                              }}
                              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none ${
                                isInLibrary ||
                                partRequest ||
                                (quota?.movie.limit &&
                                  currentlyRemaining <= 0 &&
                                  !isSelectedPart(part.id))
                                  ? 'opacity-50'
                                  : ''
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  isInLibrary ||
                                  partRequest ||
                                  isSelectedPart(part.id)
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-700'
                                } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                              />
                              <span
                                aria-hidden="true"
                                className={`${
                                  isInLibrary ||
                                  partRequest ||
                                  isSelectedPart(part.id)
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                              />
                            </span>
                          </td>
                          <td
                            className={`flex items-center px-1 py-4 text-sm font-medium leading-5 text-gray-100 md:px-6 ${
                              isBlocklisted && 'pointer-events-none opacity-50'
                            }`}
                          >
                            <div className="relative h-auto w-10 flex-shrink-0 overflow-hidden rounded-md">
                              <CachedImage
                                type="tmdb"
                                src={
                                  part.posterPath
                                    ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${part.posterPath}`
                                    : '/images/seerr_poster_not_found.png'
                                }
                                alt=""
                                sizes="100vw"
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  objectFit: 'cover',
                                }}
                                width={600}
                                height={900}
                              />
                            </div>
                            <div className="flex flex-col justify-center pl-2">
                              <div className="text-xs font-medium">
                                {part.releaseDate?.slice(0, 4)}
                              </div>
                              <div className="text-base font-bold">
                                {part.title}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-4 pr-2 text-sm leading-5 text-gray-200 md:px-6">
                            <div className="flex flex-col items-start gap-1">
                              {!isBlocklisted &&
                                !isInLibrary &&
                                !partRequest && (
                                  <Badge>
                                    {intl.formatMessage(
                                      globalMessages.notrequested
                                    )}
                                  </Badge>
                                )}
                              {(partStatus === MediaStatus.PENDING ||
                                (!isInLibrary &&
                                  partRequest?.status ===
                                    MediaRequestStatus.PENDING)) && (
                                <Badge badgeType="warning">
                                  {intl.formatMessage(globalMessages.pending)}
                                </Badge>
                              )}
                              {(partStatus === MediaStatus.PROCESSING ||
                                (!isInLibrary &&
                                  partRequest?.status ===
                                    MediaRequestStatus.APPROVED)) && (
                                <Badge badgeType="primary">
                                  {intl.formatMessage(globalMessages.requested)}
                                </Badge>
                              )}
                              {partStatus === MediaStatus.AVAILABLE && (
                                <Badge badgeType="success">
                                  {intl.formatMessage(globalMessages.available)}
                                </Badge>
                              )}
                              {isBlocklisted && (
                                <Badge badgeType="danger">
                                  {intl.formatMessage(
                                    globalMessages.blocklisted
                                  )}
                                </Badge>
                              )}
                              {serviceStatuses.map(({ service, status }) => (
                                <Badge
                                  key={`part-${part.id}-service-${service.id}`}
                                  badgeType={
                                    status === MediaStatus.AVAILABLE ||
                                    status === MediaStatus.PARTIALLY_AVAILABLE
                                      ? 'success'
                                      : status === MediaStatus.PENDING
                                        ? 'warning'
                                        : 'primary'
                                  }
                                >
                                  {intl.formatMessage(
                                    messages.statusinservice,
                                    {
                                      status: getStatusLabel(intl, status),
                                      label:
                                        service.buttonLabel ?? service.name,
                                    }
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {hasPermission(
        [Permission.REQUEST_ADVANCED, Permission.MANAGE_REQUESTS],
        { type: 'or' }
      ) && (
        <AdvancedRequester
          type="movie"
          is4k={is4k}
          serverFixed={serverId != null}
          defaultOverrides={serverId != null ? { server: serverId } : undefined}
          onChange={(overrides) => {
            setRequestOverrides(overrides);
          }}
        />
      )}
    </Modal>
  );
};

export default CollectionRequestModal;

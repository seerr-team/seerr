import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import ToggleSwitch from '@app/components/Common/ToggleSwitch';
import type { RequestOverrides } from '@app/components/RequestModal/AdvancedRequester';
import AdvancedRequester from '@app/components/RequestModal/AdvancedRequester';
import QuotaDisplay from '@app/components/RequestModal/QuotaDisplay';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { Permission } from '@server/lib/permissions';
import type { Collection } from '@server/models/Collection';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestModal', {
  requestadmin: 'This request will be approved automatically.',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestcollectiontitle: 'Request Collection',
  requestcollection4ktitle: 'Request Collection in 4K',
  requesterror: 'Something went wrong while submitting the request.',
  selectmovies: 'Select Movie(s)',
  requestmovies: 'Request {count} {count, plural, one {Movie} other {Movies}}',
  requestmovies4k:
    'Request {count} {count, plural, one {Movie} other {Movies}} in 4K',
});

interface RequestModalProps extends React.HTMLAttributes<HTMLDivElement> {
  tmdbId: number;
  is4k?: boolean;
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

  const currentlyRemaining =
    (quota?.movie.remaining ?? 0) - selectedParts.length;

  const getAllParts = (): number[] => {
    return (data?.parts ?? [])
      .filter((part) => part.mediaInfo?.status !== MediaStatus.BLACKLISTED)
      .map((part) => part.id);
  };

  const getAllRequestedParts = (): number[] => {
    const requestedParts = (data?.parts ?? []).reduce(
      (requestedParts, part) => {
        return [
          ...requestedParts,
          ...(part.mediaInfo?.requests ?? [])
            .filter(
              (request) =>
                request.is4k === is4k &&
                request.status !== MediaRequestStatus.DECLINED &&
                request.status !== MediaRequestStatus.COMPLETED
            )
            .map((part) => part.id),
        ];
      },
      [] as number[]
    );

    const availableParts = (data?.parts ?? [])
      .filter(
        (part) =>
          part.mediaInfo &&
          (part.mediaInfo[is4k ? 'status4k' : 'status'] ===
            MediaStatus.AVAILABLE ||
            part.mediaInfo[is4k ? 'status4k' : 'status'] ===
              MediaStatus.PROCESSING) &&
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

  const getPartRequest = (tmdbId: number): MediaRequest | undefined => {
    const part = (data?.parts ?? []).find((part) => part.id === tmdbId);

    return (part?.mediaInfo?.requests ?? []).find(
      (request) =>
        request.is4k === is4k &&
        request.status !== MediaRequestStatus.DECLINED &&
        request.status !== MediaRequestStatus.COMPLETED
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
    } catch (e) {
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
  ]);

  const hasAutoApprove = hasPermission(
    [
      Permission.MANAGE_REQUESTS,
      is4k ? Permission.AUTO_APPROVE_4K : Permission.AUTO_APPROVE,
      is4k ? Permission.AUTO_APPROVE_4K_MOVIE : Permission.AUTO_APPROVE_MOVIE,
    ],
    { type: 'or' }
  );

  const blacklistVisibility = hasPermission(
    [Permission.MANAGE_BLACKLIST, Permission.VIEW_BLACKLIST],
    { type: 'or' }
  );

  return (
    <Modal
      loading={(!data && !error) || !quota}
      backgroundClickable
      onCancel={onCancel}
      onOk={sendRequest}
      title={intl.formatMessage(
        is4k
          ? messages.requestcollection4ktitle
          : messages.requestcollectiontitle
      )}
      subTitle={data?.name}
      okText={
        isUpdating
          ? intl.formatMessage(globalMessages.requesting)
          : selectedParts.length === 0
          ? intl.formatMessage(messages.selectmovies)
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
                    <th className="w-16 bg-gray-700 bg-opacity-80 px-4 py-3">
                      <ToggleSwitch
                        isToggled={isAllParts()}
                        onToggle={() => toggleAllParts()}
                      />
                    </th>
                    <th className="bg-gray-700 bg-opacity-80 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.movie)}
                    </th>
                    <th className="bg-gray-700 bg-opacity-80 px-2 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.status)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data?.parts
                    .filter((part) => {
                      if (!blacklistVisibility)
                        return (
                          part.mediaInfo?.status !== MediaStatus.BLACKLISTED
                        );
                      return part;
                    })
                    .map((part) => {
                      const partRequest = getPartRequest(part.id);
                      const partMedia =
                        part.mediaInfo &&
                        part.mediaInfo[is4k ? 'status4k' : 'status'] !==
                          MediaStatus.UNKNOWN &&
                        part.mediaInfo[is4k ? 'status4k' : 'status'] !==
                          MediaStatus.DELETED
                          ? part.mediaInfo
                          : undefined;

                      return (
                        <tr key={`part-${part.id}`}>
                          <td
                            className={`whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100 ${
                              partMedia?.status === MediaStatus.BLACKLISTED &&
                              'pointer-events-none opacity-50'
                            }`}
                          >
                            <ToggleSwitch
                              isToggled={
                                (!!partMedia &&
                                  partMedia.status !==
                                    MediaStatus.BLACKLISTED) ||
                                partRequest !== undefined ||
                                isSelectedPart(part.id)
                              }
                              onToggle={() => togglePart(part.id)}
                              disabled={
                                (!!partMedia &&
                                  partMedia.status !==
                                    MediaStatus.BLACKLISTED) ||
                                partRequest ||
                                (quota?.movie.limit &&
                                  currentlyRemaining <= 0 &&
                                  !isSelectedPart(part.id))
                              }
                              highContrast
                            />
                          </td>
                          <td
                            className={`flex items-center px-1 py-4 text-sm font-medium leading-5 text-gray-100 md:px-6 ${
                              partMedia?.status === MediaStatus.BLACKLISTED &&
                              'pointer-events-none opacity-50'
                            }`}
                          >
                            <div className="relative h-auto w-10 flex-shrink-0 overflow-hidden rounded-md">
                              <CachedImage
                                type="tmdb"
                                src={
                                  part.posterPath
                                    ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${part.posterPath}`
                                    : '/images/jellyseerr_poster_not_found.png'
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
                            {!partMedia && !partRequest && (
                              <Badge>
                                {intl.formatMessage(
                                  globalMessages.notrequested
                                )}
                              </Badge>
                            )}
                            {!partMedia &&
                              partRequest?.status ===
                                MediaRequestStatus.PENDING && (
                                <Badge badgeType="warning">
                                  {intl.formatMessage(globalMessages.pending)}
                                </Badge>
                              )}
                            {((!partMedia &&
                              partRequest?.status ===
                                MediaRequestStatus.APPROVED) ||
                              partMedia?.[is4k ? 'status4k' : 'status'] ===
                                MediaStatus.PROCESSING) && (
                              <Badge badgeType="primary">
                                {intl.formatMessage(globalMessages.requested)}
                              </Badge>
                            )}
                            {partMedia?.[is4k ? 'status4k' : 'status'] ===
                              MediaStatus.AVAILABLE && (
                              <Badge badgeType="success">
                                {intl.formatMessage(globalMessages.available)}
                              </Badge>
                            )}
                            {partMedia?.status === MediaStatus.BLACKLISTED && (
                              <Badge badgeType="danger">
                                {intl.formatMessage(globalMessages.blacklisted)}
                              </Badge>
                            )}
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
      {(hasPermission(Permission.REQUEST_ADVANCED) ||
        hasPermission(Permission.MANAGE_REQUESTS)) && (
        <AdvancedRequester
          type="movie"
          is4k={is4k}
          onChange={(overrides) => {
            setRequestOverrides(overrides);
          }}
        />
      )}
    </Modal>
  );
};

export default CollectionRequestModal;

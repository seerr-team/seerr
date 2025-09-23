import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import CachedImage from '@app/components/Common/CachedImage';
import Modal from '@app/components/Common/Modal';
import type { RequestOverrides } from '@app/components/RequestModal/AdvancedRequester';
import AdvancedRequester from '@app/components/RequestModal/AdvancedRequester';
import QuotaDisplay from '@app/components/RequestModal/QuotaDisplay';
import { useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { Permission } from '@server/lib/permissions';
import type { Series } from '@server/models/Series';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestModal', {
  requestadmin: 'This request will be approved automatically.',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestseriestitle: 'Request Series',
  requestseriesaudiotitle: 'Request Series in Audiobook',
  requesterror: 'Something went wrong while submitting the request.',
  selectbooks: 'Select Book(s)',
  requestbooks: 'Request {count} {count, plural, one {Book} other {Books}}',
  requestbooksaudio:
    'Request {count} {count, plural, one {Book} other {Books}} in Audiobook',
});

interface RequestModalProps extends React.HTMLAttributes<HTMLDivElement> {
  seriesId?: number;
  isAudio?: boolean;
  onCancel?: () => void;
  onComplete?: (newStatus: MediaStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
}

const SeriesRequestModal = ({
  onCancel,
  onComplete,
  seriesId,
  onUpdating,
  isAudio = false,
}: RequestModalProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [requestOverrides, setRequestOverrides] =
    useState<RequestOverrides | null>(null);
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const { addToast } = useToasts();
  const { data, error } = useSWR<Series>(`/api/v1/series/${seriesId}`, {
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
    (quota?.book.remaining ?? 0) - selectedParts.length;

  const getAllParts = (): number[] => {
    return (data?.books ?? [])
      .filter((book) => book.mediaInfo?.status !== MediaStatus.BLACKLISTED)
      .map((book) => book.id);
  };

  const getAllRequestedParts = (): number[] => {
    const requestedParts = (data?.books ?? []).reduce(
      (requestedParts, book) => {
        return [
          ...requestedParts,
          ...(book.mediaInfo?.requests ?? [])
            .filter(
              (request) =>
                request.isAlt === isAudio &&
                request.status !== MediaRequestStatus.DECLINED &&
                request.status !== MediaRequestStatus.COMPLETED
            )
            .map((book) => book.id),
        ];
      },
      [] as number[]
    );

    const availableParts = (data?.books ?? [])
      .filter(
        (book) =>
          book.mediaInfo &&
          (book.mediaInfo[isAudio ? 'statusAlt' : 'status'] ===
            MediaStatus.AVAILABLE ||
            book.mediaInfo[isAudio ? 'statusAlt' : 'status'] ===
              MediaStatus.PROCESSING) &&
          !requestedParts.includes(book.id)
      )
      .map((book) => book.id);

    return [...requestedParts, ...availableParts];
  };

  const isSelectedPart = (bookId: number): boolean =>
    selectedParts.includes(bookId);

  const togglePart = (bookId: number): void => {
    // If this part already has a pending request, don't allow it to be toggled
    if (getAllRequestedParts().includes(bookId)) {
      return;
    }

    // If there are no more remaining requests available, block toggle
    if (
      quota?.book.limit &&
      currentlyRemaining <= 0 &&
      !isSelectedPart(bookId)
    ) {
      return;
    }

    if (selectedParts.includes(bookId)) {
      setSelectedParts((parts) => parts.filter((partId) => partId !== bookId));
    } else {
      setSelectedParts((parts) => [...parts, bookId]);
    }
  };

  const unrequestedParts = getAllParts().filter(
    (bookId) => !getAllRequestedParts().includes(bookId)
  );

  const toggleAllParts = (): void => {
    // If the user has a quota and not enough requests for all parts, block toggleAllParts
    if (
      quota?.book.limit &&
      (quota?.book.remaining ?? 0) < unrequestedParts.length
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
      getAllParts().filter((book) => !getAllRequestedParts().includes(book))
        .length
    );
  };

  const getPartRequest = (bookId: number): MediaRequest | undefined => {
    const book = (data?.books ?? []).find((book) => book.id === bookId);

    return (book?.mediaInfo?.requests ?? []).find(
      (request) =>
        request.isAlt === isAudio &&
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
          data?.books.filter((book) => selectedParts.includes(book.id)) ?? []
        ).map(async (book) => {
          await axios.post<MediaRequest>('/api/v1/request', {
            mediaId: book.id,
            mediaType: MediaType.BOOK,
            isAlt: isAudio,
            ...overrideParams,
          });
        })
      );

      if (onComplete) {
        onComplete(
          selectedParts.length === (data?.books ?? []).length
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
    data?.books,
    data?.name,
    onComplete,
    addToast,
    intl,
    selectedParts,
    isAudio,
  ]);

  const hasAutoApprove = hasPermission(
    [
      Permission.MANAGE_REQUESTS,
      isAudio ? Permission.AUTO_APPROVE_ALT : Permission.AUTO_APPROVE,
      isAudio
        ? Permission.AUTO_APPROVE_AUDIO_BOOK
        : Permission.AUTO_APPROVE_BOOK,
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
        isAudio ? messages.requestseriesaudiotitle : messages.requestseriestitle
      )}
      subTitle={data?.name}
      okText={
        isUpdating
          ? intl.formatMessage(globalMessages.requesting)
          : selectedParts.length === 0
          ? intl.formatMessage(messages.selectbooks)
          : intl.formatMessage(
              isAudio ? messages.requestbooksaudio : messages.requestbooks,
              {
                count: selectedParts.length,
              }
            )
      }
      okDisabled={selectedParts.length === 0}
      okButtonType={'primary'}
      backdrop={undefined}
    >
      {hasAutoApprove && !quota?.book.restricted && (
        <div className="mt-6">
          <Alert
            title={intl.formatMessage(messages.requestadmin)}
            type="info"
          />
        </div>
      )}
      {(quota?.book.limit ?? 0) > 0 && (
        <QuotaDisplay
          mediaType="book"
          quota={quota?.book}
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
                          quota?.book.limit &&
                          (quota.book.remaining ?? 0) < unrequestedParts.length
                            ? 'opacity-50'
                            : ''
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`${
                            isAllParts() ? 'bg-indigo-500' : 'bg-gray-800'
                          } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                        ></span>
                        <span
                          aria-hidden="true"
                          className={`${
                            isAllParts() ? 'translate-x-5' : 'translate-x-0'
                          } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                        ></span>
                      </span>
                    </th>
                    <th className="bg-gray-700 bg-opacity-80 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.book)}
                    </th>
                    <th className="bg-gray-700 bg-opacity-80 px-2 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.status)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data?.books
                    .filter((book) => {
                      if (!blacklistVisibility)
                        return (
                          book.mediaInfo?.status !== MediaStatus.BLACKLISTED
                        );
                      return book;
                    })
                    .map((book) => {
                      const partRequest = getPartRequest(book.id);
                      const partMedia =
                        book.mediaInfo &&
                        book.mediaInfo[isAudio ? 'statusAlt' : 'status'] !==
                          MediaStatus.UNKNOWN &&
                        book.mediaInfo[isAudio ? 'statusAlt' : 'status'] !==
                          MediaStatus.DELETED
                          ? book.mediaInfo
                          : undefined;

                      return (
                        <tr key={`book-${book.id}`}>
                          <td
                            className={`whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100 ${
                              partMedia?.status === MediaStatus.BLACKLISTED &&
                              'pointer-events-none opacity-50'
                            }`}
                          >
                            <span
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={
                                (!!partMedia &&
                                  partMedia.status !==
                                    MediaStatus.BLACKLISTED) ||
                                isSelectedPart(book.id)
                              }
                              onClick={() => togglePart(book.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Space') {
                                  togglePart(book.id);
                                }
                              }}
                              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none ${
                                (!!partMedia &&
                                  partMedia.status !==
                                    MediaStatus.BLACKLISTED) ||
                                partRequest ||
                                (quota?.book.limit &&
                                  currentlyRemaining <= 0 &&
                                  !isSelectedPart(book.id))
                                  ? 'opacity-50'
                                  : ''
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  (!!partMedia &&
                                    partMedia.status !==
                                      MediaStatus.BLACKLISTED) ||
                                  partRequest ||
                                  isSelectedPart(book.id)
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-700'
                                } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                              ></span>
                              <span
                                aria-hidden="true"
                                className={`${
                                  (!!partMedia &&
                                    partMedia.status !==
                                      MediaStatus.BLACKLISTED) ||
                                  partRequest ||
                                  isSelectedPart(book.id)
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                              ></span>
                            </span>
                          </td>
                          <td
                            className={`flex items-center px-1 py-4 text-sm font-medium leading-5 text-gray-100 md:px-6 ${
                              partMedia?.status === MediaStatus.BLACKLISTED &&
                              'pointer-events-none opacity-50'
                            }`}
                          >
                            <div className="relative h-auto w-10 flex-shrink-0 overflow-hidden rounded-md">
                              <CachedImage
                                type="hardcover"
                                src={
                                  book.posterPath
                                    ? book.posterPath
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
                                {book.releaseDate?.slice(0, 4)}
                                {book.position && ` - #${book.position}`}
                              </div>
                              <div className="text-base font-bold">
                                {book.title}
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
                              partMedia?.[isAudio ? 'statusAlt' : 'status'] ===
                                MediaStatus.PROCESSING) && (
                              <Badge badgeType="primary">
                                {intl.formatMessage(globalMessages.requested)}
                              </Badge>
                            )}
                            {partMedia?.[isAudio ? 'statusAlt' : 'status'] ===
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
          type={MediaType.BOOK}
          isAlt={isAudio}
          onChange={(overrides) => {
            setRequestOverrides(overrides);
          }}
        />
      )}
    </Modal>
  );
};

export default SeriesRequestModal;

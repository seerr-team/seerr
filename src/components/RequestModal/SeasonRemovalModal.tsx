import Badge from '@app/components/Common/Badge';
import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  MediaRemovalRequestStatus,
  MediaStatus,
} from '@server/constants/media';
import type { TvDetails } from '@server/models/Tv';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RequestModal.SeasonRemovalModal', {
  title: 'Request Season Removal',
  season: 'Season',
  numberofepisodes: '# of Episodes',
  seasonnumber: 'Season {number}',
  removeseasons:
    'Remove {seasonCount} {seasonCount, plural, one {Season} other {Seasons}}',
  selectseason: 'Select Season(s)',
  removalPending: 'Removal Pending',
  selectallseasons: 'Select all seasons',
  selectseasonnumber: 'Select Season {number}',
});

interface SeasonRemovalModalProps {
  data: TvDetails;
  onCancel: () => void;
  onComplete: (seasons: number[]) => void;
  is4k?: boolean;
  currentUserId?: number;
}

const SeasonRemovalModal = ({
  data,
  onCancel,
  onComplete,
  is4k = false,
  currentUserId,
}: SeasonRemovalModalProps) => {
  const intl = useIntl();
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);

  const statusKey = is4k ? 'status4k' : 'status';

  // Seasons the CURRENT user already has an active removal request for. Other
  // users' active requests must NOT disable selection — a co-requester needs to
  // be able to request the same seasons to reach full multi-user consent.
  const userPendingSeasons = new Set(
    (data.mediaInfo?.removalRequests ?? [])
      .filter(
        (rr) =>
          rr.requestedBy?.id === currentUserId &&
          rr.is4k === is4k &&
          (rr.status === MediaRemovalRequestStatus.PENDING ||
            rr.status === MediaRemovalRequestStatus.APPROVED ||
            rr.status === MediaRemovalRequestStatus.PARTIALLY_REMOVED)
      )
      .flatMap((rr) => rr.seasons ?? [])
  );

  // The rendered rows are the source of truth for what can be selected, so the
  // "select all" toggle can never select a season that has no visible row.
  const seasonData =
    data.seasons?.filter((s) => s.seasonNumber !== 0 && s.episodeCount !== 0) ??
    [];

  const seasonStatus = (seasonNumber: number): MediaStatus | undefined =>
    data.mediaInfo?.seasons?.find((sn) => sn.seasonNumber === seasonNumber)?.[
      statusKey
    ];

  const isAvailable = (seasonNumber: number): boolean => {
    const status = seasonStatus(seasonNumber);
    return (
      status === MediaStatus.AVAILABLE ||
      status === MediaStatus.PARTIALLY_AVAILABLE
    );
  };

  const isPendingRemoval = (seasonNumber: number): boolean =>
    userPendingSeasons.has(seasonNumber);

  const isSelectable = (seasonNumber: number): boolean =>
    isAvailable(seasonNumber) && !isPendingRemoval(seasonNumber);

  const selectableSeasonNumbers = seasonData
    .map((s) => s.seasonNumber)
    .filter((n) => isSelectable(n));

  const isSelectedSeason = (seasonNumber: number): boolean =>
    selectedSeasons.includes(seasonNumber);

  const toggleSeason = (seasonNumber: number): void => {
    if (!isSelectable(seasonNumber)) return;
    if (selectedSeasons.includes(seasonNumber)) {
      setSelectedSeasons((prev) => prev.filter((s) => s !== seasonNumber));
    } else {
      setSelectedSeasons((prev) => [...prev, seasonNumber]);
    }
  };

  const isAllSeasons = (): boolean =>
    selectableSeasonNumbers.length > 0 &&
    selectedSeasons.length === selectableSeasonNumbers.length;

  const toggleAllSeasons = (): void => {
    if (selectedSeasons.length < selectableSeasonNumbers.length) {
      setSelectedSeasons(selectableSeasonNumbers);
    } else {
      setSelectedSeasons([]);
    }
  };

  return (
    <Modal
      backgroundClickable
      onCancel={onCancel}
      onOk={() => onComplete(selectedSeasons)}
      title={intl.formatMessage(messages.title)}
      subTitle={data.name}
      okText={
        selectedSeasons.length === 0
          ? intl.formatMessage(messages.selectseason)
          : intl.formatMessage(messages.removeseasons, {
              seasonCount: selectedSeasons.length,
            })
      }
      okDisabled={selectedSeasons.length === 0}
      okButtonType="danger"
      cancelText={intl.formatMessage(globalMessages.cancel)}
      backdrop={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data.backdropPath}`}
    >
      <div className="flex flex-col">
        <div className="-mx-4 sm:mx-0">
          <div className="inline-block min-w-full py-2 align-middle">
            <div className="overflow-hidden border border-gray-700 shadow backdrop-blur sm:rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="w-16 bg-gray-700/80 px-4 py-3">
                      <span
                        role="checkbox"
                        tabIndex={0}
                        aria-checked={isAllSeasons()}
                        aria-label={intl.formatMessage(
                          messages.selectallseasons
                        )}
                        aria-disabled={selectableSeasonNumbers.length === 0}
                        onClick={() => toggleAllSeasons()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleAllSeasons();
                          }
                        }}
                        className="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none"
                      >
                        <span
                          aria-hidden="true"
                          className={`${
                            isAllSeasons() ? 'bg-indigo-500' : 'bg-gray-800'
                          } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                        />
                        <span
                          aria-hidden="true"
                          className={`${
                            isAllSeasons() ? 'translate-x-5' : 'translate-x-0'
                          } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                        />
                      </span>
                    </th>
                    <th className="bg-gray-700/80 px-1 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(messages.season)}
                    </th>
                    <th className="bg-gray-700/80 px-5 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(messages.numberofepisodes)}
                    </th>
                    <th className="bg-gray-700/80 px-2 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 md:px-6">
                      {intl.formatMessage(globalMessages.status)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {seasonData.map((season) => {
                    const status = seasonStatus(season.seasonNumber);
                    const pendingRemoval = isPendingRemoval(
                      season.seasonNumber
                    );
                    const disabled = !isSelectable(season.seasonNumber);

                    return (
                      <tr key={`season-${season.id}`}>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100">
                          <span
                            role="checkbox"
                            tabIndex={disabled ? -1 : 0}
                            aria-checked={
                              isSelectedSeason(season.seasonNumber) ||
                              pendingRemoval
                            }
                            aria-disabled={disabled}
                            aria-label={intl.formatMessage(
                              messages.selectseasonnumber,
                              { number: season.seasonNumber }
                            )}
                            onClick={() => toggleSeason(season.seasonNumber)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleSeason(season.seasonNumber);
                              }
                            }}
                            className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center justify-center pt-2 focus:outline-none ${
                              disabled
                                ? 'cursor-default opacity-50'
                                : 'cursor-pointer'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`${
                                isSelectedSeason(season.seasonNumber) ||
                                pendingRemoval
                                  ? 'bg-indigo-500'
                                  : 'bg-gray-700'
                              } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                            />
                            <span
                              aria-hidden="true"
                              className={`${
                                isSelectedSeason(season.seasonNumber) ||
                                pendingRemoval
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              } absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out group-focus:border-blue-300 group-focus:ring`}
                            />
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-1 py-4 text-sm font-medium leading-5 text-gray-100 md:px-6">
                          {intl.formatMessage(messages.seasonnumber, {
                            number: season.seasonNumber,
                          })}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm leading-5 text-gray-200 md:px-6">
                          {season.episodeCount}
                        </td>
                        <td className="whitespace-nowrap py-4 pr-2 text-sm leading-5 text-gray-200 md:px-6">
                          {pendingRemoval ? (
                            <Badge badgeType="warning">
                              {intl.formatMessage(messages.removalPending)}
                            </Badge>
                          ) : status === MediaStatus.AVAILABLE ? (
                            <Badge badgeType="success">
                              {intl.formatMessage(globalMessages.available)}
                            </Badge>
                          ) : status === MediaStatus.PARTIALLY_AVAILABLE ? (
                            <Badge badgeType="success">
                              {intl.formatMessage(
                                globalMessages.partiallyavailable
                              )}
                            </Badge>
                          ) : status === MediaStatus.PROCESSING ? (
                            <Badge badgeType="primary">
                              {intl.formatMessage(globalMessages.requested)}
                            </Badge>
                          ) : (
                            <Badge>
                              {intl.formatMessage(globalMessages.notrequested)}
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
    </Modal>
  );
};

export default SeasonRemovalModal;

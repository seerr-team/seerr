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
});

interface SeasonRemovalModalProps {
  data: TvDetails;
  onCancel: () => void;
  onComplete: (seasons: number[]) => void;
  is4k?: boolean;
}

const SeasonRemovalModal = ({
  data,
  onCancel,
  onComplete,
  is4k = false,
}: SeasonRemovalModalProps) => {
  const intl = useIntl();
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([]);

  const availableSeasons =
    data.mediaInfo?.seasons?.filter(
      (s) =>
        s.seasonNumber !== 0 &&
        (s[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
          s[is4k ? 'status4k' : 'status'] === MediaStatus.PARTIALLY_AVAILABLE)
    ) ?? [];

  const pendingSeasonRemovals = (seasonNumber: number) =>
    data.mediaInfo?.removalRequests?.some(
      (rr) =>
        (rr.status === MediaRemovalRequestStatus.PENDING ||
          rr.status === MediaRemovalRequestStatus.PARTIALLY_REMOVED) &&
        !rr.is4k === !is4k &&
        rr.seasons?.includes(seasonNumber)
    );

  const selectableSeasons = availableSeasons.filter(
    (s) => !pendingSeasonRemovals(s.seasonNumber)
  );

  const isSelectedSeason = (seasonNumber: number): boolean =>
    selectedSeasons.includes(seasonNumber);

  const toggleSeason = (seasonNumber: number): void => {
    if (pendingSeasonRemovals(seasonNumber)) return;
    if (!selectableSeasons.some((s) => s.seasonNumber === seasonNumber)) return;
    if (selectedSeasons.includes(seasonNumber)) {
      setSelectedSeasons((prev) => prev.filter((s) => s !== seasonNumber));
    } else {
      setSelectedSeasons((prev) => [...prev, seasonNumber]);
    }
  };

  const isAllSeasons = (): boolean => {
    return (
      selectableSeasons.length > 0 &&
      selectedSeasons.length === selectableSeasons.length
    );
  };

  const toggleAllSeasons = (): void => {
    if (selectedSeasons.length < selectableSeasons.length) {
      setSelectedSeasons(selectableSeasons.map((s) => s.seasonNumber));
    } else {
      setSelectedSeasons([]);
    }
  };

  const seasonData = data.seasons?.filter((s) => s.seasonNumber !== 0) ?? [];

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
                  {seasonData
                    .filter((season) => season.episodeCount !== 0)
                    .map((season) => {
                      const mediaSeason = data.mediaInfo?.seasons?.find(
                        (sn) => sn.seasonNumber === season.seasonNumber
                      );
                      const isAvailable =
                        mediaSeason?.[is4k ? 'status4k' : 'status'] ===
                          MediaStatus.AVAILABLE ||
                        mediaSeason?.[is4k ? 'status4k' : 'status'] ===
                          MediaStatus.PARTIALLY_AVAILABLE;
                      const isPendingRemoval = pendingSeasonRemovals(
                        season.seasonNumber
                      );
                      const isDisabled = !isAvailable || !!isPendingRemoval;

                      return (
                        <tr key={`season-${season.id}`}>
                          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium leading-5 text-gray-100">
                            <span
                              role="checkbox"
                              tabIndex={0}
                              aria-checked={
                                isSelectedSeason(season.seasonNumber) ||
                                !!isPendingRemoval
                              }
                              onClick={() => toggleSeason(season.seasonNumber)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleSeason(season.seasonNumber);
                                }
                              }}
                              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none ${
                                isDisabled ? 'opacity-50' : ''
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`${
                                  isSelectedSeason(season.seasonNumber) ||
                                  isPendingRemoval
                                    ? 'bg-indigo-500'
                                    : 'bg-gray-700'
                                } absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
                              />
                              <span
                                aria-hidden="true"
                                className={`${
                                  isSelectedSeason(season.seasonNumber) ||
                                  isPendingRemoval
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
                            {isPendingRemoval ? (
                              <Badge badgeType="warning">
                                {intl.formatMessage(messages.removalPending)}
                              </Badge>
                            ) : mediaSeason?.[is4k ? 'status4k' : 'status'] ===
                              MediaStatus.AVAILABLE ? (
                              <Badge badgeType="success">
                                {intl.formatMessage(globalMessages.available)}
                              </Badge>
                            ) : mediaSeason?.[is4k ? 'status4k' : 'status'] ===
                              MediaStatus.PARTIALLY_AVAILABLE ? (
                              <Badge badgeType="success">
                                {intl.formatMessage(
                                  globalMessages.partiallyavailable
                                )}
                              </Badge>
                            ) : mediaSeason?.[is4k ? 'status4k' : 'status'] ===
                              MediaStatus.PROCESSING ? (
                              <Badge badgeType="primary">
                                {intl.formatMessage(globalMessages.requested)}
                              </Badge>
                            ) : (
                              <Badge>
                                {intl.formatMessage(
                                  globalMessages.notrequested
                                )}
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

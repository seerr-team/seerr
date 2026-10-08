import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { TvdbOfficialSeason } from '@server/api/tvdb/interfaces';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.RequestModal.SeasonOverrideModal', {
  title: 'Map Seasons',
  description:
    'Choose which season of the confirmed series matches each season you requested.',
  requestedseason: 'Requested Season {seasonNumber}',
  chooseseason: 'Select a season',
  seasonwithyear: 'Season {seasonNumber} ({year})',
  season: 'Season {seasonNumber}',
  noseasons: 'No seasons are available for this series.',
  loadfailed: 'Could not load the season list for this series.',
  confirm: 'Save and Retry',
  failed: 'Something went wrong while applying the season mapping.',
});

interface SeasonOverrideModalProps {
  requestId: number;
  tvdbId: number;
  seasonNumbers: number[];
  onComplete: () => void;
  onCancel: () => void;
}

const SeasonOverrideModal = ({
  requestId,
  tvdbId,
  seasonNumbers,
  onComplete,
  onCancel,
}: SeasonOverrideModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: seasons, error } = useSWR<TvdbOfficialSeason[]>(
    `/api/v1/service/tvdb/${tvdbId}/seasons`
  );

  const allMapped = seasonNumbers.every(
    (seasonNumber) => overrides[seasonNumber] !== undefined
  );

  const submit = async () => {
    setIsSubmitting(true);

    try {
      await axios.post(`/api/v1/request/${requestId}/retry`, {
        tvdbId,
        seasonOverrides: seasonNumbers.map((seasonNumber) => ({
          seasonNumber,
          dispatchedSeasonNumber: overrides[seasonNumber],
        })),
      });

      onComplete();
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
      setIsSubmitting(false);
    }
  };

  const seasonLabel = (season: TvdbOfficialSeason) =>
    season.year
      ? intl.formatMessage(messages.seasonwithyear, {
          seasonNumber: season.seasonNumber,
          year: season.year,
        })
      : intl.formatMessage(messages.season, {
          seasonNumber: season.seasonNumber,
        });

  // a failed lookup and a series with no official seasons are different
  // problems, and reporting them the same way hides the former
  if (error || (seasons && !seasons.length)) {
    return (
      <Modal
        title={intl.formatMessage(messages.title)}
        onOk={onCancel}
        okText={intl.formatMessage(globalMessages.close)}
        backgroundClickable
      >
        {error ? (
          <Alert title={intl.formatMessage(messages.loadfailed)} type="error" />
        ) : (
          <Alert title={intl.formatMessage(messages.noseasons)} type="info" />
        )}
      </Modal>
    );
  }

  return (
    <Modal
      loading={!seasons}
      title={intl.formatMessage(messages.title)}
      onOk={submit}
      okText={intl.formatMessage(messages.confirm)}
      okDisabled={!allMapped || isSubmitting}
      onCancel={onCancel}
      cancelText={intl.formatMessage(globalMessages.cancel)}
      backgroundClickable
    >
      <div className="mb-4 text-sm text-gray-300">
        {intl.formatMessage(messages.description)}
      </div>
      <div className="space-y-3">
        {seasonNumbers.map((seasonNumber) => (
          <div key={`requested-season-${seasonNumber}`}>
            <label htmlFor={`season-${seasonNumber}`}>
              {intl.formatMessage(messages.requestedseason, { seasonNumber })}
            </label>
            <select
              id={`season-${seasonNumber}`}
              name={`season-${seasonNumber}`}
              value={overrides[seasonNumber] ?? ''}
              onChange={(e) =>
                setOverrides({
                  ...overrides,
                  [seasonNumber]: Number(e.target.value),
                })
              }
              className="border-gray-700 bg-gray-800"
            >
              <option value="" disabled>
                {intl.formatMessage(messages.chooseseason)}
              </option>
              {(seasons ?? []).map((season) => (
                <option
                  key={`tvdb-season-${season.seasonNumber}`}
                  value={season.seasonNumber}
                >
                  {seasonLabel(season)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SeasonOverrideModal;

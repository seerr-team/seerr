import Badge from '@app/components/Common/Badge';
import defineMessages from '@app/utils/defineMessages';
import { FormattedRelativeTime, useIntl } from 'react-intl';

const messages = defineMessages('components.AirDateBadge', {
  airedrelative: 'Aired {relativeTime}',
  airsrelative: 'Airing {relativeTime}',
});

type AirDateBadgeProps = {
  airDate: string;
};

const AirDateBadge = ({ airDate }: AirDateBadgeProps) => {
  const DAY_MS = 1000 * 60 * 60 * 24;
  const RELATIVE_WINDOW_MS = DAY_MS * 8;
  const intl = useIntl();
  // TMDB air_date has no time/tz, it's just the origin country's local date.
  // We pin it to UTC anyway for consistency.
  // https://www.themoviedb.org/talk/6365be67d7107e008d777337
  const dAirDate = new Date(airDate);
  dAirDate.setUTCHours(0, 0, 0, 0);
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const diffMs = dAirDate.getTime() - todayUtc.getTime();
  // The air date itself counts as "Airing" and "Aired" starts the next UTC day.
  const alreadyAired = diffMs < 0;
  const showRelative = Math.abs(diffMs) <= RELATIVE_WINDOW_MS;
  const diffInDays = diffMs / DAY_MS;

  return (
    <div className="flex items-center space-x-2">
      <Badge badgeType="light">
        {intl.formatDate(dAirDate, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        })}
      </Badge>
      {showRelative && (
        <Badge badgeType="light">
          {intl.formatMessage(
            alreadyAired ? messages.airedrelative : messages.airsrelative,
            {
              relativeTime: (
                <FormattedRelativeTime
                  value={diffInDays}
                  unit="day"
                  numeric="auto"
                />
              ),
            }
          )}
        </Badge>
      )}
    </div>
  );
};

export default AirDateBadge;

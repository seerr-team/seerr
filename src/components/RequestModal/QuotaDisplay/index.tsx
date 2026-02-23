import ProgressCircle from '@app/components/Common/ProgressCircle';
import defineMessages from '@app/utils/defineMessages';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';
import type { QuotaStatus } from '@server/interfaces/api/userInterfaces';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RequestModal.QuotaDisplay', {
  requestsremaining:
    '{remaining, plural, =0 {No} other {<strong>#</strong>}} {type} {remaining, plural, one {request} other {requests}} remaining',
  movielimit: '{limit, plural, one {movie} other {movies}}',
  seasonlimit: '{limit, plural, one {season} other {seasons}}',
  musiclimit: '{limit, plural, one {album} other {albums}}',
  allowedRequests:
    'You are allowed to request <strong>{limit}</strong> {type} every <strong>{days}</strong> days.',
  allowedRequestsUser:
    'This user is allowed to request <strong>{limit}</strong> {type} every <strong>{days}</strong> days.',
  quotaLink:
    'You can view a summary of your request limits on your <ProfileLink>profile page</ProfileLink>.',
  quotaLinkUser:
    "You can view a summary of this user's request limits on their <ProfileLink>profile page</ProfileLink>.",
  movie: 'movie',
  season: 'season',
  album: 'album',
  notenoughseasonrequests: 'Not enough season requests remaining',
  requiredquota:
    'You need to have at least <strong>{seasons}</strong> {seasons, plural, one {season request} other {season requests}} remaining in order to submit a request for this series.',
  requiredquotaUser:
    'This user needs to have at least <strong>{seasons}</strong> {seasons, plural, one {season request} other {season requests}} remaining in order to submit a request for this series.',
});

interface QuotaDisplayProps {
  quota?: QuotaStatus;
  mediaType: 'movie' | 'tv' | 'music';
  userOverride?: number | null;
  remaining?: number;
  overLimit?: number;
}

const QuotaDisplay = ({
  quota,
  mediaType,
  userOverride,
  remaining,
  overLimit,
}: QuotaDisplayProps) => {
  const intl = useIntl();
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div
      className="my-4 flex flex-col rounded-md border border-gray-700 p-4 backdrop-blur"
      onClick={() => setShowDetails((s) => !s)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setShowDetails((s) => !s);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center">
        <ProgressCircle
          className="h-8 w-8"
          progress={Math.round(
            ((remaining ?? quota?.remaining ?? 0) / (quota?.limit ?? 1)) * 100
          )}
          useHeatLevel
        />
        <div
          className={`flex items-end ${
            (remaining ?? quota?.remaining ?? 0) <= 0 || quota?.restricted
              ? 'text-red-500'
              : ''
          }`}
        >
          <div className="ml-2 text-lg">
            {overLimit !== undefined
              ? intl.formatMessage(messages.notenoughseasonrequests)
              : intl.formatMessage(messages.requestsremaining, {
                  remaining: remaining ?? quota?.remaining ?? 0,
                  type: intl.formatMessage(
                    mediaType === 'movie' ? messages.movie : messages.season
                  ),
                  strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                })}
          </div>
        </div>
        <div className="flex flex-1 justify-end">
          {showDetails ? (
            <ChevronUpIcon className="h-6 w-6" />
          ) : (
            <ChevronDownIcon className="h-6 w-6" />
          )}
        </div>
      </div>
      {showDetails && (
        <div className="mt-4">
          {overLimit !== undefined && (
            <div className="mb-2">
              {intl.formatMessage(
                userOverride
                  ? messages.requiredquotaUser
                  : messages.requiredquota,
                {
                  seasons: overLimit,
                  strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                }
              )}
            </div>
          )}
          <div>
            {intl.formatMessage(
              userOverride
                ? messages.allowedRequestsUser
                : messages.allowedRequests,
              {
                limit: quota?.limit,
                days: quota?.days,
                type: intl.formatMessage(
                  mediaType === 'movie'
                    ? messages.movielimit
                    : mediaType === 'tv'
                    ? messages.seasonlimit
                    : messages.musiclimit,
                  { limit: quota?.limit }
                ),
                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
              }
            )}
          </div>
          <div className="mt-2">
            {intl.formatMessage(
              userOverride ? messages.quotaLinkUser : messages.quotaLink,
              {
                ProfileLink: (msg: React.ReactNode) => (
                  <Link
                    href={userOverride ? `/users/${userOverride}` : '/profile'}
                    className="text-white transition duration-300 hover:underline"
                  >
                    {msg}
                  </Link>
                ),
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaDisplay;

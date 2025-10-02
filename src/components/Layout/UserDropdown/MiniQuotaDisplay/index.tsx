import Infinity from '@app/assets/infinity.svg';
import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import ProgressCircle from '@app/components/Common/ProgressCircle';
import defineMessages from '@app/utils/defineMessages';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.Layout.UserDropdown.MiniQuotaDisplay',
  {
    movierequests: 'Movie Requests',
    seriesrequests: 'Series Requests',
  }
);

type MiniQuotaDisplayProps = {
  userId: number;
};

const MiniQuotaDisplay = ({ userId }: MiniQuotaDisplayProps) => {
  const intl = useIntl();
  const { data, error } = useSWR<QuotaResponse>(`/api/v1/user/${userId}/quota`);

  if (error) {
    return null;
  }

  if (!data && !error) {
    return <SmallLoadingSpinner />;
  }

  if (data?.mode === 'combined') {
    if ((data.combined.limit ?? 0) === 0) {
      return null;
    }

    return (
      <div className="flex">
        <div className="flex w-full flex-col space-y-2">
          <div className="text-sm text-gray-200">Requests</div>
          <div className="flex h-full items-center space-x-2 text-gray-200">
            {data.combined.limit ? (
              <>
                <ProgressCircle
                  className="h-8 w-8"
                  progress={Math.round(
                    ((data.combined.remaining ?? 0) /
                      (data.combined.limit ?? 1)) *
                      100
                  )}
                  useHeatLevel
                />
                <span className="text-lg font-bold text-gray-200">
                  {data.combined.remaining} / {data.combined.limit}
                </span>
              </>
            ) : (
              <>
                <Infinity className="w-7" />
                <span className="font-bold">Unlimited</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if ((data?.movie.limit ?? 0) === 0 && (data?.tv.limit ?? 0) === 0) {
    return null;
  }

  return (
    <div className="flex">
      <div className="flex basis-1/2 flex-col space-y-2">
        <div className="text-sm text-gray-200">
          {intl.formatMessage(messages.movierequests)}
        </div>
        <div className="flex h-full items-center space-x-2 text-gray-200">
          {data?.movie.limit ? (
            <>
              <ProgressCircle
                className="h-8 w-8"
                progress={Math.round(
                  ((data?.movie.remaining ?? 0) / (data?.movie.limit ?? 1)) *
                    100
                )}
                useHeatLevel
              />
              <span className="text-lg font-bold">
                {data?.movie.remaining} / {data?.movie.limit}
              </span>
            </>
          ) : (
            <>
              <Infinity className="w-7" />
              <span className="font-bold">Unlimited</span>
            </>
          )}
        </div>
      </div>
      <div className="flex basis-1/2 flex-col space-y-2">
        <div className="text-sm text-gray-200">
          {intl.formatMessage(messages.seriesrequests)}
        </div>
        <div className="flex h-full items-center space-x-2 text-gray-200">
          {data?.tv.limit ? (
            <>
              <ProgressCircle
                className="h-8 w-8"
                progress={Math.round(
                  ((data?.tv.remaining ?? 0) / (data?.tv.limit ?? 1)) * 100
                )}
                useHeatLevel
              />
              <span className="text-lg font-bold text-gray-200">
                {data?.tv.remaining} / {data?.tv.limit}
              </span>
            </>
          ) : (
            <>
              <Infinity className="w-7" />
              <span className="font-bold">Unlimited</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiniQuotaDisplay;

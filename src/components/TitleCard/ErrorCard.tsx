import Button from '@app/components/Common/Button';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { CheckIcon, TrashIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useIntl } from 'react-intl';
import { mutate } from 'swr';

interface ErrorCardProps {
  id: number;
  tmdbId: number;
  tvdbId?: number;
  type: 'movie' | 'tv';
  canExpand?: boolean;
}

const messages = defineMessages('components.TitleCard', {
  mediaerror: '{mediaType} Not Found',
  tmdbid: 'TMDB ID',
  tvdbid: 'TheTVDB ID',
  cleardata: 'Clear Data',
});

const ErrorCard = ({ id, tmdbId, tvdbId, type, canExpand }: ErrorCardProps) => {
  const intl = useIntl();

  const deleteMedia = async () => {
    await axios.delete(`/api/v1/media/${id}`);
    mutate('/api/v1/media?filter=allavailable&take=20&sort=mediaAdded');
    mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');
  };

  return (
    <div
      className={canExpand ? 'w-full' : 'w-36 sm:w-36 md:w-44'}
      data-testid="title-card"
    >
      <div
        className="relative transform-gpu cursor-default overflow-hidden rounded-xl bg-gray-800 bg-cover shadow outline-none ring-1 ring-gray-700  transition duration-300"
        style={{
          paddingBottom: '150%',
        }}
      >
        <div className="absolute inset-0 h-full w-full overflow-hidden">
          <div className="absolute left-0 right-0 flex items-center justify-between p-2">
            <div
              className={`pointer-events-none z-40 rounded-full shadow ${
                type === 'movie' ? 'bg-blue-500' : 'bg-purple-600'
              }`}
            >
              <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                {type === 'movie'
                  ? intl.formatMessage(globalMessages.movie)
                  : intl.formatMessage(globalMessages.tvshow)}
              </div>
            </div>
            <div className="pointer-events-none z-40">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-400 text-white shadow sm:h-5 sm:w-5">
                <CheckIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
            </div>
          </div>

          <div className="flex h-full w-full items-end">
            <div className="px-2 pb-11 text-white">
              <h1
                className="whitespace-normal text-xl font-bold leading-tight"
                style={{
                  WebkitLineClamp: 3,
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                }}
                data-testid="title-card-title"
              >
                {intl.formatMessage(messages.mediaerror, {
                  mediaType: intl.formatMessage(
                    type === 'movie'
                      ? globalMessages.movie
                      : globalMessages.tvshow
                  ),
                })}
              </h1>
              <div
                className="whitespace-normal text-xs"
                style={{
                  WebkitLineClamp: 3,
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                }}
              >
                <div className="flex items-center">
                  <span className="mr-2 font-bold text-gray-400">
                    {intl.formatMessage(messages.tmdbid)}
                  </span>
                  {tmdbId}
                </div>
                {!!tvdbId && (
                  <div className="mt-2 flex items-center sm:mt-1">
                    <span className="mr-2 font-bold text-gray-400">
                      {intl.formatMessage(messages.tvdbid)}
                    </span>
                    {tvdbId}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-2">
            <Button
              buttonType="danger"
              buttonSize="sm"
              onClick={(e) => {
                e.preventDefault();
                deleteMedia();
              }}
              className="h-7 w-full"
            >
              <TrashIcon />
              <span>{intl.formatMessage(messages.cleardata)}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ErrorCard;

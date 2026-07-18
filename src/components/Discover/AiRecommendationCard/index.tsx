import Button from '@app/components/Common/Button';
import Tooltip from '@app/components/Common/Tooltip';
import TitleCard from '@app/components/TitleCard';
import useAiFeedback, { type FeedbackType } from '@app/hooks/useAiFeedback';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckIcon,
  EyeIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';
import { MediaType } from '@server/constants/media';
import type { MovieResult, TvResult } from '@server/models/Search';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.AiRecommendationCard', {
  like: 'More like this',
  dislike: 'Not interested',
  seen: 'Already watched',
  why: 'Why this was recommended',
  feedbackError: 'Could not save feedback. Please try again.',
});

interface AiRecommendationCardProps {
  item: MovieResult | TvResult;
  rationale?: string | null;
  onRemove?: (tmdbId: number) => void;
}

/**
 * Wraps a standard TitleCard and overlays small feedback buttons in the
 * TitleCard's own visual language (ghost, sm icon buttons that reveal on
 * hover) — the same pattern the blocklist/watchlist buttons use inside
 * TitleCard. Keeps the card clean instead of a separate button row.
 */
const AiRecommendationCard = ({
  item,
  rationale,
  onRemove,
}: AiRecommendationCardProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { submit, remove } = useAiFeedback();
  const [active, setActive] = useState<FeedbackType | null>(null);

  // Rationale button placement — flip to true to show the ✨ button.
  const SHOW_RATIONALE_BUTTON = false;

  const mediaType = item.mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE;

  const handleClick = async (type: FeedbackType) => {
    const previous = active;
    setActive(type);

    try {
      if (previous === type) {
        await remove(item.id, mediaType);
        setActive(null);
        return;
      }
      await submit(item.id, mediaType, type);
      // Dislike / seen remove the card from the current view since it won't be
      // recommended again; like just marks it.
      if ((type === 'dislike' || type === 'seen') && onRemove) {
        onRemove(item.id);
      }
    } catch {
      setActive(previous);
      addToast(intl.formatMessage(messages.feedbackError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const iconBtn = (
    type: FeedbackType,
    Icon: typeof HandThumbUpIcon,
    label: string,
    activeClass: string
  ) => (
    <Tooltip content={label}>
      <Button
        buttonType="ghost"
        buttonSize="sm"
        className={`z-50 ${active === type ? activeClass : ''}`}
        onClick={() => handleClick(type)}
      >
        {active === type && type === 'seen' ? (
          <CheckIcon className="h-3" />
        ) : (
          <Icon className="h-3" />
        )}
      </Button>
    </Tooltip>
  );

  return (
    <div className="group relative">
      <TitleCard
        id={item.id}
        image={item.posterPath}
        status={item.mediaInfo?.status}
        summary={item.overview}
        title={item.mediaType === 'movie' ? item.title : item.name}
        userScore={item.voteAverage}
        year={item.mediaType === 'movie' ? item.releaseDate : item.firstAirDate}
        mediaType={item.mediaType}
        inProgress={(item.mediaInfo?.downloadStatus ?? []).length > 0}
        canExpand
      />
      {/* Feedback row — 👍/👁️/👎 just below the top MOVIE/blocklist row,
          reveals on hover. */}
      <div className="pointer-events-none absolute left-2 top-9 z-50 flex gap-1 opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="pointer-events-auto flex gap-1">
          {iconBtn(
            'like',
            HandThumbUpIcon,
            intl.formatMessage(messages.like),
            '!bg-green-600 !text-white'
          )}
          {iconBtn(
            'seen',
            EyeIcon,
            intl.formatMessage(messages.seen),
            '!bg-blue-600 !text-white'
          )}
          {iconBtn(
            'dislike',
            HandThumbDownIcon,
            intl.formatMessage(messages.dislike),
            '!bg-red-600 !text-white'
          )}
        </div>
        {SHOW_RATIONALE_BUTTON && rationale && (
          <div className="pointer-events-auto">
            <Tooltip
              className="max-w-xs whitespace-normal break-words"
              content={
                <>
                  <span className="font-semibold">
                    {intl.formatMessage(messages.why)}
                  </span>
                  <div>{rationale}</div>
                </>
              }
            >
              <Button buttonType="ghost" buttonSize="sm" className="z-50">
                <SparklesIcon className="h-3 text-indigo-300" />
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiRecommendationCard;

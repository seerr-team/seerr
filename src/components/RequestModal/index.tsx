import BookRequestModal from '@app/components/RequestModal/BookRequestModal';
import CollectionRequestModal from '@app/components/RequestModal/CollectionRequestModal';
import MovieRequestModal from '@app/components/RequestModal/MovieRequestModal';
import SeriesRequestModal from '@app/components/RequestModal/SeriesRequestModal';
import TvRequestModal from '@app/components/RequestModal/TvRequestModal';
import { Transition } from '@headlessui/react';
import type { MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';

interface RequestModalProps {
  show: boolean;
  type: 'movie' | 'tv' | 'book' | 'collection' | 'series';
  mediaId?: number;
  isAlt?: boolean;
  editRequest?: NonFunctionProperties<MediaRequest>;
  onComplete?: (newStatus: MediaStatus) => void;
  onCancel?: () => void;
  onUpdating?: (isUpdating: boolean) => void;
}

const RequestModal = ({
  type,
  show,
  mediaId,
  isAlt,
  editRequest,
  onComplete,
  onUpdating,
  onCancel,
}: RequestModalProps) => {
  return (
    <Transition
      as="div"
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-300"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      show={show}
    >
      {type === 'movie' ? (
        <MovieRequestModal
          onComplete={onComplete}
          onCancel={onCancel}
          tmdbId={mediaId}
          onUpdating={onUpdating}
          is4k={isAlt}
          editRequest={editRequest}
        />
      ) : type === 'tv' ? (
        <TvRequestModal
          onComplete={onComplete}
          onCancel={onCancel}
          tmdbId={mediaId}
          onUpdating={onUpdating}
          is4k={isAlt}
          editRequest={editRequest}
        />
      ) : type === 'book' ? (
        <BookRequestModal
          onComplete={onComplete}
          onCancel={onCancel}
          hcId={mediaId}
          onUpdating={onUpdating}
          isAudio={isAlt}
          editRequest={editRequest}
        />
      ) : type === 'series' ? (
        <SeriesRequestModal
          onComplete={onComplete}
          onCancel={onCancel}
          seriesId={mediaId}
          onUpdating={onUpdating}
          isAudio={isAlt}
        />
      ) : (
        <CollectionRequestModal
          onComplete={onComplete}
          onCancel={onCancel}
          tmdbId={mediaId}
          onUpdating={onUpdating}
          is4k={isAlt}
        />
      )}
    </Transition>
  );
};

export default RequestModal;

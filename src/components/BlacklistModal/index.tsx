import Modal from '@app/components/Common/Modal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';

import type { Collection } from '@server/models/Collection';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

interface BlacklistModalProps {
  tmdbId: number;
  type: 'movie' | 'tv' | 'collection';
  show: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
  isUpdating?: boolean;
}

const messages = defineMessages('component.BlacklistModal', {
  blacklisting: 'Blacklisting',
});

const isMovie = (
  movie: MovieDetails | TvDetails | Collection | null
): movie is MovieDetails => {
  if (!movie) return false;
  return (movie as MovieDetails).title !== undefined;
};

const isCollection = (
  data: MovieDetails | TvDetails | Collection | null
): data is Collection => {
  return (
    data !== null &&
    data !== undefined &&
    (data as Collection).parts !== undefined
  );
};

const BlacklistModal = ({
  tmdbId,
  type,
  show,
  onComplete,
  onCancel,
  isUpdating,
}: BlacklistModalProps) => {
  const intl = useIntl();
  const [data, setData] = useState<
    TvDetails | MovieDetails | Collection | null
  >(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      if (!show) return;
      try {
        setError(null);
        const response = await axios.get(`/api/v1/${type}/${tmdbId}`);
        setData(response.data);
      } catch (err) {
        setError(err);
      }
    })();
  }, [show, tmdbId, type]);

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
      <Modal
        loading={!data && !error}
        backgroundClickable
        title={`${intl.formatMessage(globalMessages.blacklist)} ${
          type === 'collection'
            ? intl.formatMessage(globalMessages.collection)
            : isMovie(data)
            ? intl.formatMessage(globalMessages.movie)
            : intl.formatMessage(globalMessages.tvshow)
        }`}
        subTitle={`${
          isCollection(data)
            ? data.name
            : isMovie(data)
            ? data.title
            : data?.name
        }`}
        onCancel={onCancel}
        onOk={onComplete}
        okText={
          isUpdating
            ? intl.formatMessage(messages.blacklisting)
            : intl.formatMessage(globalMessages.blacklist)
        }
        okButtonType="danger"
        okDisabled={isUpdating}
        backdrop={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data?.backdropPath}`}
      />
    </Transition>
  );
};

export default BlacklistModal;
